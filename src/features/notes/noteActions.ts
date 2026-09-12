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
