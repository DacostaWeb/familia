import { db } from "../../lib/db";
import { enqueue, upsertLocal } from "../../lib/sync";
import type { ArchiveFile, Folder } from "../../../shared/types";

export function filePayload(f: ArchiveFile) {
  return {};
}

export async function renameFolder(existing: Folder, name: string) {
  const next: Folder = { ...existing, name, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "folder");
  await enqueue(next.id, existing.revision, "folder.rename", { name });
}

export async function moveFolder(existing: Folder, parentId: string | null) {
  const next: Folder = { ...existing, parentId, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "folder");
  await enqueue(next.id, existing.revision, "folder.move", { parentId });
}

export async function deleteFolder(existing: Folder) {
  const next: Folder = { ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await upsertLocal(next, "folder");
  await enqueue(next.id, existing.revision, "folder.delete", {});
}

export async function restoreFolder(existing: Folder) {
  const next: Folder = { ...existing, deletedAt: null, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "folder");
  await enqueue(next.id, existing.revision, "folder.restore", {});
}

export async function createFolder(name: string, parentId: string | null): Promise<Folder> {
  const now = new Date().toISOString();
  const folder: Folder = {
    id: "f-" + crypto.randomUUID(),
    ownerId: "",
    parentId,
    name,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await upsertLocal(folder, "folder");
  await enqueue(folder.id, 0, "folder.create", { parentId, name });
  return folder;
}

export async function renameFile(existing: ArchiveFile, name: string) {
  const next: ArchiveFile = { ...existing, name, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "file");
  await enqueue(next.id, existing.revision, "file.rename", { name });
}

export async function moveFile(existing: ArchiveFile, folderId: string | null) {
  const next: ArchiveFile = { ...existing, folderId, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "file");
  await enqueue(next.id, existing.revision, "file.move", { folderId });
}

export async function deleteFile(existing: ArchiveFile) {
  const next: ArchiveFile = { ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await upsertLocal(next, "file");
  await enqueue(next.id, existing.revision, "file.delete", {});
}

export async function restoreFile(existing: ArchiveFile) {
  const next: ArchiveFile = { ...existing, deletedAt: null, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "file");
  await enqueue(next.id, existing.revision, "file.restore", {});
}

export async function pinEntry(entryId: string, summary: string) {
  const now = new Date().toISOString();
  const pin = {
    id: "p-" + crypto.randomUUID(),
    ownerId: "",
    entryId,
    summary,
    active: true,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await upsertLocal(pin, "pin");
  await enqueue(pin.id, 0, "pin.create", { entryId, summary });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
