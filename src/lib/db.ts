import Dexie, { type Table } from "dexie";
import type { Task, Note, Folder, ArchiveFile, Pin, Member } from "../../shared/types";

export type OutboxItem = {
  opId: string;
  entityId: string;
  expectedRevision: number;
  action: string;
  payload: unknown;
  createdAt: string;
  state: "pending" | "sending";
};

export type ConflictItem = {
  entityId: string;
  kind: "task" | "note";
  server: Task | Note;
};

export type Meta = { key: string; value: unknown };

export class FamiliaDB extends Dexie {
  tasks!: Table<Task, string>;
  notes!: Table<Note, string>;
  folders!: Table<Folder, string>;
  files!: Table<ArchiveFile, string>;
  pins!: Table<Pin, string>;
  outbox!: Table<OutboxItem, string>;
  conflicts!: Table<ConflictItem, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super("familia-da-costa");
    this.version(1).stores({
      tasks: "id, completedAt, deletedAt, updatedAt",
      notes: "id, space, ownerId, deletedAt, updatedAt",
      folders: "id, parentId, deletedAt, name",
      files: "id, folderId, deletedAt, updatedAt",
      pins: "id, entryId, active, deletedAt",
      outbox: "opId, entityId, createdAt, state",
      conflicts: "entityId, kind",
      meta: "key",
    });
  }
}

export const db = new FamiliaDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

export async function getMember(): Promise<Member | undefined> {
  return getMeta<Member>("member");
}
