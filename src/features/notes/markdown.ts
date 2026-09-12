import { db } from "../../lib/db";
import { enqueue, upsertLocal } from "../../lib/sync";
import type { Note } from "../../../shared/types";

export function newNote(space: "private" | "archive"): Note {
  const now = new Date().toISOString();
  return {
    id: "n-" + crypto.randomUUID(),
    ownerId: "",
    space,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    title: "",
    content: { type: "doc", content: [{ type: "paragraph" }] },
  };
}

export async function saveNote(existing: Note, patch: Partial<Note>) {
  const next: Note = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "note");
  if (existing.revision === 0) {
    await enqueue(next.id, 0, "note.create", { title: next.title, content: next.content, space: next.space });
  } else {
    await enqueue(next.id, existing.revision, "note.update", { title: next.title, content: next.content });
  }
}

export async function deleteNote(existing: Note) {
  const next: Note = { ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await upsertLocal(next, "note");
  await enqueue(next.id, existing.revision, "note.delete", {});
}

export async function restoreNote(existing: Note) {
  const next: Note = { ...existing, deletedAt: null, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "note");
  await enqueue(next.id, existing.revision, "note.restore", {});
}

// ---- Markdown (import/export) ----

export function tiptapToMarkdown(doc: any): string {
  return blockNodes(doc?.content ?? []);
}

function blockNodes(nodes: any[]): string {
  const out: string[] = [];
  let listBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const flush = () => {
    if (listBuf.length) {
      out.push(listBuf.map((s, i) => (listType === "ol" ? `${i + 1}. ${s}` : `- ${s}`)).join("\n"));
      listBuf = [];
      listType = null;
    }
  };
  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        flush();
        const level = "#".repeat(Math.min(6, node.attrs?.level ?? 1));
        out.push(`${level} ${inline(node.content ?? [])}`);
        break;
      }
      case "paragraph":
        flush();
        out.push(inline(node.content ?? []));
        break;
      case "blockquote":
        flush();
        out.push(
          blockNodes(node.content ?? [])
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n"),
        );
        break;
      case "codeBlock":
        flush();
        out.push("```\n" + plainText(node.content ?? []) + "\n```");
        break;
      case "bulletList":
        flush();
        listType = "ul";
        for (const li of node.content ?? []) {
          if (li.type === "taskItem") {
            listBuf.push(`${li.attrs?.checked ? "[x]" : "[ ]"} ${inline(li.content ?? [])}`);
          } else {
            listBuf.push(inline(li.content ?? []));
          }
        }
        break;
      case "orderedList":
        flush();
        listType = "ol";
        for (const li of node.content ?? []) listBuf.push(inline(li.content ?? []));
        break;
      case "taskList":
        flush();
        listType = "ul";
        for (const li of node.content ?? []) listBuf.push(`${li.attrs?.checked ? "[x]" : "[ ]"} ${inline(li.content ?? [])}`);
        break;
      case "horizontalRule":
        flush();
        out.push("---");
        break;
      default:
        if (node.content) {
          flush();
          out.push(blockNodes(node.content));
        }
    }
  }
  flush();
  return out.join("\n\n");
}

function inline(nodes: any[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") {
        let t = n.text ?? "";
        const marks = n.marks ?? [];
        for (const m of marks) {
          if (m.type === "bold") t = `**${t}**`;
          if (m.type === "italic") t = `*${t}*`;
          if (m.type === "code") t = `\`${t}\``;
          if (m.type === "link") t = `[${t}](${m.attrs?.href ?? ""})`;
          if (m.type === "strike") t = `~~${t}~~`;
        }
        return t;
      }
      if (n.type === "hardBreak") return "\n";
      if (n.content) return inline(n.content);
      return "";
    })
    .join("");
}

function plainText(nodes: any[]): string {
  return nodes.map((n) => n.text ?? "").join("");
}

export function markdownToTiptap(md: string): Note["content"] {
  const doc: any = { type: "doc", content: [] };
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const paragraph: any[] = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      doc.content.push({ type: "paragraph", content: parseInline(paragraph.join("\n")) });
      paragraph.length = 0;
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushParagraph();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      doc.content.push({ type: "codeBlock", content: [{ type: "text", text: buf.join("\n") }] });
      continue;
    }
    if (/^(#{1,6})\s/.test(line)) {
      flushParagraph();
      const level = line.match(/^#+/)![0].length;
      doc.content.push({ type: "heading", attrs: { level }, content: parseInline(line.replace(/^#+\s/, "")) });
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      doc.content.push({ type: "blockquote", content: [{ type: "paragraph", content: parseInline(buf.join("\n")) }] });
      continue;
    }
    if (/^(-|\d+\.)\s/.test(line)) {
      flushParagraph();
      const ordered = /^\d+\./.test(line);
      const items: any[] = [];
      while (i < lines.length && /^(?:-|\d+\.)\s/.test(lines[i])) {
        const text = lines[i].replace(/^(?:-|\d+\.)\s/, "");
        const task = /^\[([ xX])\]\s?/.exec(text);
        if (task) {
          items.push({
            type: "taskItem",
            attrs: { checked: task[1].toLowerCase() === "x" },
            content: [{ type: "paragraph", content: parseInline(text.replace(/^\[[ xX]\]\s?/, "")) }],
          });
        } else {
          items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline(text) }] });
        }
        i++;
      }
      doc.content.push(ordered ? { type: "orderedList", content: items } : { type: "bulletList", content: items });
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      flushParagraph();
      doc.content.push({ type: "horizontalRule" });
      i++;
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      i++;
      continue;
    }
    paragraph.push(line);
    i++;
  }
  flushParagraph();
  if (!doc.content.length) doc.content.push({ type: "paragraph" });
  return doc;
}

function parseInline(text: string): any[] {
  const nodes: any[] = [];
  let rest = text;
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\)|\n)/;
  while (rest.length) {
    const m = pattern.exec(rest);
    if (!m) {
      pushText(nodes, rest);
      break;
    }
    if (m.index > 0) pushText(nodes, rest.slice(0, m.index));
    const token = m[0];
    if (token === "\n") nodes.push({ type: "hardBreak" });
    else if (token.startsWith("**")) nodes.push({ type: "text", marks: [{ type: "bold" }], text: token.slice(2, -2) });
    else if (token.startsWith("~~")) nodes.push({ type: "text", marks: [{ type: "strike" }], text: token.slice(2, -2) });
    else if (token.startsWith("`")) nodes.push({ type: "text", marks: [{ type: "code" }], text: token.slice(1, -1) });
    else if (token.startsWith("*")) nodes.push({ type: "text", marks: [{ type: "italic" }], text: token.slice(1, -1) });
    else if (token.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)!;
      nodes.push({ type: "text", marks: [{ type: "link", attrs: { href: mm[2] } }], text: mm[1] });
    }
    rest = rest.slice(m.index + token.length);
  }
  return nodes.length ? nodes : [{ type: "text", text: "" }];
}

function pushText(nodes: any[], text: string) {
  if (!text) return;
  nodes.push({ type: "text", text });
}
