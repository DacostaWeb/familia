import { db } from "../../lib/db";
import { enqueue, upsertLocal } from "../../lib/sync";
import type { Task, ChecklistItem } from "../../../shared/types";

export function newTask(partial: Partial<Task> & { title: string }): Task {
  const now = new Date().toISOString();
  return {
    id: "t-" + crypto.randomUUID(),
    ownerId: "",
    revision: 0, // ainda não confirmado pelo servidor
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    title: partial.title,
    description: partial.description ?? "",
    checklist: partial.checklist ?? [],
    responsibleIds: partial.responsibleIds ?? [],
    dueDate: partial.dueDate ?? null,
    dueTime: partial.dueTime ?? null,
    urgency: partial.urgency ?? "normal",
    reminderEnabled: partial.reminderEnabled ?? false,
    completedAt: null,
    completedBy: null,
  };
}

export function taskPayload(t: Task) {
  return {
    title: t.title,
    description: t.description,
    checklist: t.checklist,
    responsibleIds: t.responsibleIds,
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    urgency: t.urgency,
    reminderEnabled: t.reminderEnabled,
  };
}

export async function createTask(title: string): Promise<Task | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const task = newTask({ title: trimmed });
  try {
    await db.tasks.put(task);
  } catch (e) {
    // falha de gravação local: conservar o texto no campo
    throw e;
  }
  await enqueue(task.id, 0, "task.create", taskPayload(task));
  return task;
}

export async function updateTask(existing: Task, patch: Partial<Task>) {
  const next: Task = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "task");
  await enqueue(next.id, existing.revision, "task.update", taskPayload(next));
}

export async function completeTask(existing: Task, memberId: string) {
  const next: Task = { ...existing, completedAt: new Date().toISOString(), completedBy: memberId, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "task");
  await enqueue(next.id, existing.revision, "task.complete", {});
}

export async function reopenTask(existing: Task) {
  const next: Task = { ...existing, completedAt: null, completedBy: null, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "task");
  await enqueue(next.id, existing.revision, "task.reopen", {});
}

export async function deleteTask(existing: Task) {
  const next: Task = { ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await upsertLocal(next, "task");
  await enqueue(next.id, existing.revision, "task.delete", {});
}

export async function restoreTask(existing: Task) {
  const next: Task = { ...existing, deletedAt: null, updatedAt: new Date().toISOString() };
  await upsertLocal(next, "task");
  await enqueue(next.id, existing.revision, "task.restore", {});
}

export function updateChecklist(task: Task, checklist: ChecklistItem[]): Promise<void> {
  return updateTask(task, { checklist });
}
