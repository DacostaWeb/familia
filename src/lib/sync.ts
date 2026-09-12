import { db, setMeta, getMeta, type OutboxItem } from "./db";
import { api, ApiError } from "./api";
import type { Bootstrap, Operation, Task, Note, Folder, ArchiveFile, Pin } from "../../shared/types";

type SyncStatus = "idle" | "syncing" | "offline" | "error";

let syncing = false;
let queued = false;
const listeners = new Set<() => void>();

export function onSyncChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const fn of listeners) fn();
}

export async function syncStatus(): Promise<{ status: SyncStatus; pending: number; lastSync: string | null; error: string | null }> {
  const pending = await db.outbox.count();
  return {
    status: syncing ? "syncing" : (getMetaSync("status") as SyncStatus | undefined) ?? "idle",
    pending,
    lastSync: (getMetaSync("lastSync") as string | null) ?? null,
    error: (getMetaSync("error") as string | null) ?? null,
  };
}

// espelho em memória para leitura rápida (a base de verdade é a Dexie)
let memStatus: SyncStatus = "idle";
let memError: string | null = null;
function getMetaSync(key: string) {
  if (key === "status") return memStatus;
  if (key === "error") return memError;
  return undefined;
}

export async function enqueue(entityId: string, expectedRevision: number, action: string, payload: unknown) {
  const op: OutboxItem = {
    opId: crypto.randomUUID(),
    entityId,
    expectedRevision,
    action,
    payload,
    createdAt: new Date().toISOString(),
    state: "pending",
  };
  await db.outbox.add(op);
  notify();
  void scheduleSync(0);
  return op;
}

// Tarefas/notas: alterações locais otimistas
export async function upsertLocal(entity: Task | Note | Folder | ArchiveFile | Pin, kind: "task" | "note" | "folder" | "file" | "pin") {
  const table = { task: db.tasks, note: db.notes, folder: db.folders, file: db.files, pin: db.pins }[kind];
  await db.transaction("rw", table, async () => {
    await table.put(entity as never);
  });
  notify();
}

export async function scheduleSync(delayMs = 800) {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    void syncNow();
  }, delayMs);
}

export async function syncNow(): Promise<{ ok: boolean; error?: string }> {
  if (syncing) return { ok: true };
  syncing = true;
  memStatus = "syncing";
  memError = null;
  notify();
  try {
    await flushOutbox();
    await applyBootstrap();
    memStatus = "idle";
    memError = null;
    await setMeta("lastSync", new Date().toISOString());
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      memStatus = "error";
      memError = "Sessão expirada.";
      notify();
      window.dispatchEvent(new CustomEvent("familia:unauthorized"));
      return { ok: false, error: "unauthorized" };
    }
    memStatus = navigator.onLine ? "error" : "offline";
    memError = e instanceof Error ? e.message : "Erro de sincronização.";
    return { ok: false, error: memError };
  } finally {
    syncing = false;
    notify();
  }
}

async function flushOutbox() {
  // por ordem de criação; uma operação de cada vez
  for (;;) {
    const next = await db.outbox.orderBy("createdAt").limit(1).first();
    if (!next) return;
    await sendOne(next);
  }
}

async function sendOne(item: OutboxItem) {
  const op: Operation = {
    operationId: item.opId,
    entityId: item.entityId,
    expectedRevision: item.expectedRevision,
    action: item.action,
    payload: item.payload,
  };
  try {
    await db.outbox.update(item.opId, { state: "sending" });
    const res = await api<{ results: { operationId: string; ok: boolean; entity?: unknown; code?: string; message?: string }[]; serverTime: string }>(
      "/api/operations",
      { method: "POST", body: JSON.stringify({ operations: [op] }) },
    );
    const r = res.results[0];
    if (r.ok) {
      await db.outbox.delete(item.opId);
      const entity = r.entity as Task | Note | Folder | ArchiveFile | Pin;
      const kind = item.action.split(".")[0] as "task" | "note" | "folder" | "file" | "pin";
      const table = { task: db.tasks, note: db.notes, folder: db.folders, file: db.files, pin: db.pins }[kind];
      // só substituir se não houver edições locais mais recentes
      const pendingForEntity = await db.outbox.where("entityId").equals(item.entityId).count();
      if (!pendingForEntity) {
        await table.put(entity as never);
      }
      await db.conflicts.delete(item.entityId);
    } else if (r.code === "conflict" || r.code === "already_exists") {
      await handleConflict(item);
      await db.outbox.delete(item.opId);
    } else {
      // erro definitivo: remover da fila e registar
      await db.outbox.delete(item.opId);
      await setMeta("error", `${r.code}: ${r.message}`);
    }
    notify();
  } catch (e) {
    await db.outbox.update(item.opId, { state: "pending" });
    throw e;
  }
}

async function handleConflict(item: OutboxItem) {
  const kind = item.action.split(".")[0] as "task" | "note";
  if (kind !== "task" && kind !== "note") return;
  const table = kind === "task" ? db.tasks : db.notes;
  const local = (await table.get(item.entityId)) as Task | Note | undefined;
  try {
    // obter a versão atual do servidor revalidando
    await applyBootstrap();
    const server = (await table.get(item.entityId)) as Task | Note | undefined;
    if (!server || !local) return;
    await db.conflicts.put({ entityId: item.entityId, kind, server });
  } catch {
    // sem rede: o conflito fica pendente
  }
}

export async function resolveConflictKeepServer(entityId: string) {
  const conflict = await db.conflicts.get(entityId);
  if (!conflict) return;
  const table = conflict.kind === "task" ? db.tasks : db.notes;
  await table.put(conflict.server as never);
  await db.conflicts.delete(entityId);
  notify();
}

export async function resolveConflictApplyMine(entityId: string) {
  const conflict = await db.conflicts.get(entityId);
  if (!conflict) return;
  const table = conflict.kind === "task" ? db.tasks : db.notes;
  const mine = (await table.get(entityId)) as Task | Note | undefined;
  if (!mine) return;
  const payload =
    conflict.kind === "task"
      ? { title: (mine as Task).title, description: (mine as Task).description, checklist: (mine as Task).checklist, responsibleIds: (mine as Task).responsibleIds, dueDate: (mine as Task).dueDate, dueTime: (mine as Task).dueTime, urgency: (mine as Task).urgency, reminderEnabled: (mine as Task).reminderEnabled }
      : { title: (mine as Note).title, content: (mine as Note).content };
  await db.conflicts.delete(entityId);
  await enqueue(entityId, (conflict.server as Task | Note).revision, conflict.kind === "task" ? "task.update" : "note.update", payload);
  notify();
}

export async function resolveConflictCopy(entityId: string) {
  const conflict = await db.conflicts.get(entityId);
  if (!conflict || conflict.kind !== "note") return;
  const mine = (await db.notes.get(entityId)) as Note | undefined;
  if (!mine) return;
  const copy: Note = {
    ...mine,
    id: "n-" + crypto.randomUUID(),
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
  await db.notes.put(copy);
  await enqueue(copy.id, 0, "note.create", { title: copy.title, content: copy.content, space: copy.space });
  await db.conflicts.delete(entityId);
  notify();
}

let lastSnapshotAt = 0;

export async function applyBootstrap() {
  // evitar pedidos repetidos em menos de 2s
  if (Date.now() - lastSnapshotAt < 2000) return;
  const data = await api<Bootstrap>("/api/bootstrap", undefined, 20000);
  lastSnapshotAt = Date.now();

  await db.transaction("rw", [db.tasks, db.notes, db.folders, db.files, db.pins, db.meta], async () => {
    await db.tasks.clear();
    await db.folders.clear();
    await db.files.clear();
    await db.pins.clear();
    // notas: preservar rascunhos locais pendentes
    const pendingNotes = new Set((await db.outbox.toArray()).filter((o) => o.action.startsWith("note.")).map((o) => o.entityId));
    const localNotes = await db.notes.toArray();
    await db.notes.clear();
    await db.notes.bulkPut(data.notes as never);
    for (const n of localNotes) {
      if (pendingNotes.has(n.id)) await db.notes.put(n); // versão local desejada
    }
    // tarefas pendentes: preservar versão local
    const pendingTasks = new Set((await db.outbox.toArray()).filter((o) => o.action.startsWith("task.")).map((o) => o.entityId));
    const localTasks = await db.tasks.toArray();
    await db.tasks.clear();
    await db.tasks.bulkPut(data.tasks as never);
    for (const t of localTasks) {
      if (pendingTasks.has(t.id)) await db.tasks.put(t);
    }
    await db.folders.bulkPut(data.folders as never);
    await db.files.bulkPut(data.files as never);
    await db.pins.bulkPut(data.pins as never);
    await db.meta.put({ key: "members", value: data.members });
    await db.meta.put({ key: "serverTime", value: data.serverTime });
  });
  notify();
}

export async function cachedMembers() {
  return (await db.meta.get("members"))?.value as Bootstrap["members"] | undefined;
}
