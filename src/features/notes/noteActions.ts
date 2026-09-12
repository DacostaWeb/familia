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
  const local = (await db.notes.get(existing.id)) ?? existing;
  const next: Note = { ...local, ...existing, ...patch, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "note");
  // já existe criação pendente ou o servidor já confirma esta nota?
  const pending = await db.outbox.where("entityId").equals(next.id).toArray();
  const hasCreate = pending.some((o) => o.action === "note.create");
  if (hasCreate || (local && local.revision > 0)) {
    await enqueue(next.id, next.revision, "note.update", { title: next.title, content: next.content });
  } else {
    await enqueue(next.id, 0, "note.create", { title: next.title, content: next.content, space: next.space });
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
