import type { Env, } from "./env";
import { HttpError } from "./env";
import type { Member, Operation, OperationResult } from "../shared/types";
import { MAX_FILE_SIZE, isOperationAction } from "../shared/types";

// ---------- helpers ----------

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function str(v: unknown, field: string, max = 10000): string {
  if (typeof v !== "string") throw new HttpError(400, `Campo ${field} inválido.`, "invalid");
  if (v.length > max) throw new HttpError(400, `Campo ${field} demasiado longo.`, "invalid");
  return v;
}

function strOrNull(v: unknown, field: string, max = 100): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" || v.length > max) throw new HttpError(400, `Campo ${field} inválido.`, "invalid");
  return v;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function dueFields(payload: Record<string, unknown>) {
  const dueDate = strOrNull(payload.dueDate, "dueDate", 10);
  const dueTime = strOrNull(payload.dueTime, "dueTime", 5);
  if (dueDate && !DATE_RE.test(dueDate)) throw new HttpError(400, "Data inválida.", "invalid");
  if (dueTime && !(dueDate && TIME_RE.test(dueTime)))
    throw new HttpError(400, "Hora requer uma data válida.", "invalid");
  return { dueDate, dueTime };
}

function checkIds(v: unknown, field: string): string[] {
  if (!Array.isArray(v)) throw new HttpError(400, `Campo ${field} inválido.`, "invalid");
  return v.map((x) => str(x, field, 64));
}

function checklist(v: unknown): { id: string; text: string; done: boolean }[] {
  if (!Array.isArray(v)) throw new HttpError(400, "Checklist inválida.", "invalid");
  if (v.length > 200) throw new HttpError(400, "Checklist demasiado longa.", "invalid");
  return v.map((item) => {
    const o = item as Record<string, unknown>;
    return { id: str(o.id, "id", 64), text: str(o.text, "text", 500), done: !!o.done };
  });
}

function tiptapDoc(v: unknown): string {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new HttpError(400, "Conteúdo inválido.", "invalid");
  return JSON.stringify(v);
}

// ---------- row mappers ----------

type Row = Record<string, any>;

export function taskFromRow(r: Row) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    title: r.title,
    description: r.description,
    checklist: JSON.parse(r.checklist),
    responsibleIds: JSON.parse(r.responsible_ids),
    dueDate: r.due_date,
    dueTime: r.due_time,
    urgency: r.urgency,
    reminderEnabled: !!r.reminder_enabled,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
  };
}

export function noteFromRow(r: Row) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    space: r.space,
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    title: r.title,
    content: JSON.parse(r.content),
  };
}

export function folderFromRow(r: Row) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    parentId: r.parent_id,
    name: r.name,
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function fileFromRow(r: Row) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    folderId: r.folder_id,
    name: r.name,
    mime: r.mime,
    size: r.size,
    r2Key: r.r2_key,
    status: r.status,
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function pinFromRow(r: Row) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    entryId: r.entry_id,
    summary: r.summary,
    active: !!r.active,
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

// ---------- revision-guarded mutation ----------

const TABLES = {
  task: { name: "tasks", fromRow: taskFromRow },
  note: { name: "notes", fromRow: noteFromRow },
  folder: { name: "folders", fromRow: folderFromRow },
  file: { name: "files", fromRow: fileFromRow },
  pin: { name: "pins", fromRow: pinFromRow },
} as const;

type Kind = keyof typeof TABLES;

function kindOf(action: string): Kind {
  return action.split(".")[0] as Kind;
}

async function recordHistory(env: Env, batch: D1PreparedStatement[], entityId: string, revision: number, data: unknown, memberId: string) {
  batch.push(
    env.DB.prepare("INSERT INTO history(id, entity_id, revision, data, changed_by, changed_at) VALUES(?,?,?,?,?,?)")
      .bind(newId("h"), entityId, revision, JSON.stringify(data), memberId, nowIso()),
  );
}

async function cancelReminderJobs(env: Env, batch: D1PreparedStatement[], taskId: string) {
  batch.push(env.DB.prepare("DELETE FROM jobs WHERE type='reminder' AND status='pending' AND json_extract(payload,'$.taskId')=?").bind(taskId));
}

async function scheduleReminder(env: Env, batch: D1PreparedStatement[], taskId: string, dueDate: string, dueTime: string) {
  // Europe/Lisbon offset: computar timestamp do due em Lisboa.
  const runAt = lisbonTimestamp(dueDate, dueTime);
  if (runAt === null) return;
  batch.push(
    env.DB.prepare("INSERT OR IGNORE INTO jobs(id, type, run_at, payload, status, attempts, created_at) VALUES(?,?,?,?, 'pending', 0, ?)")
      .bind(newId("j"), "reminder", runAt, JSON.stringify({ taskId }), nowIso()),
  );
}

function lisbonTimestamp(date: string, time: string): number | null {
  // Converte YYYY-MM-DD HH:mm em Europe/Lisbon para epoch ms.
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // encontrar offset de Lisboa para essa data
  const guessUtc = Date.UTC(y, m - 1, d, hh, mm);
  for (let candidate = guessUtc; ; candidate -= 1800000) {
    const off = lisbonOffsetMinutes(new Date(candidate));
    const utc = Date.UTC(y, m - 1, d, hh, mm) - off * 60000;
    if (utc === candidate) return utc;
    if (guessUtc - candidate > 36 * 3600000) return null;
  }
}

function lisbonOffsetMinutes(at: Date): number {
  // offset em minutos (positivo a leste). Lisboa: 0 (inverno) / 60 (verão)
  const year = at.getUTCFullYear();
  // último domingo de março 01:00 UTC → verão; último domingo de outubro 01:00 UTC → inverno
  const lastSunday = (month: number) => {
    const d = new Date(Date.UTC(year, month + 1, 0, 1, 0)); // dia 1h UTC do último dia do mês
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.getTime();
  };
  const summerStart = lastSunday(2); // março
  const summerEnd = lastSunday(9); // outubro
  const t = at.getTime();
  return t >= summerStart && t < summerEnd ? 60 : 0;
}

async function getRow(env: Env, kind: Kind, id: string): Promise<Row | null> {
  const table = TABLES[kind].name;
  const r = await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();
  return r ?? null;
}

function deletePinsForEntry(env: Env, batch: D1PreparedStatement[], entryId: string) {
  batch.push(
    env.DB.prepare("UPDATE pins SET active=0, deleted_at=?, revision=revision+1, updated_at=? WHERE entry_id=? AND active=1")
      .bind(nowIso(), nowIso(), entryId),
  );
}

// valida acesso a pastas/arquivo (comum a toda a família) e notas privadas
function checkAccess(kind: Kind, row: Row, member: Member) {
  if (kind === "note" && row.space === "private" && row.owner_id !== member.id) {
    throw new HttpError(404, "Recurso inexistente.", "not_found");
  }
}

// ---------- operações ----------

export async function applyOperation(member: Member, env: Env, op: Operation): Promise<OperationResult> {
  const fail = (code: string, message: string): OperationResult => ({ operationId: op.operationId, ok: false, code, message });

  if (!isOperationAction(op.action)) return fail("invalid_action", "Ação desconhecida.");
  if (typeof op.operationId !== "string" || op.operationId.length > 100 || !/^[A-Za-z0-9_-]+$/.test(op.operationId))
    return fail("invalid_operation_id", "ID de operação inválido.");
  if (typeof op.entityId !== "string" || op.entityId.length > 100) return fail("invalid_entity", "ID inválido.");
  if (!Number.isInteger(op.expectedRevision) || op.expectedRevision < 0) return fail("invalid_revision", "Revisão inválida.");
  const payload = (op.payload ?? {}) as Record<string, unknown>;

  // idempotência: mesma operação reenviada devolve o estado atual
  const seen = await env.DB.prepare("SELECT entity_id FROM operations_seen WHERE operation_id=?")
    .bind(op.operationId)
    .first();
  if (seen) {
    const row = await getRow(env, kindOf(op.action), op.entityId);
    if (row) return { operationId: op.operationId, ok: true, entity: TABLES[kindOf(op.action)].fromRow(row) };
    return fail("gone", "Operação já processada.");
  }

  const kind = kindOf(op.action);
  const table = TABLES[kind].name;
  const ts = nowIso();

  try {
    if (op.action.endsWith(".create")) {
      if (op.expectedRevision !== 0) return fail("conflict", "Revisão em conflito.");
      const existing = await getRow(env, kind, op.entityId);
      if (existing) return fail("already_exists", "Já existe.");
      let entity: unknown;
      const batch: D1PreparedStatement[] = [];

      if (op.action === "task.create") {
        const title = str(payload.title, "title", 500).trim();
        if (!title) return fail("invalid", "O título é obrigatório.");
        const { dueDate, dueTime } = dueFields(payload);
        const task = {
          id: op.entityId,
          ownerId: member.id,
          revision: 1,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
          title,
          description: str(payload.description ?? "", "description", 20000),
          checklist: checklist(payload.checklist ?? []),
          responsibleIds: checkIds(payload.responsibleIds ?? [], "responsibleIds"),
          dueDate,
          dueTime,
          urgency: payload.urgency === "high" ? "high" : "normal",
          reminderEnabled: !!payload.reminderEnabled && !!dueDate && !!dueTime,
          completedAt: null,
          completedBy: null,
        };
        entity = task;
        batch.push(
          env.DB.prepare(
            "INSERT INTO tasks(id,owner_id,revision,created_at,updated_at,deleted_at,title,description,checklist,responsible_ids,due_date,due_time,urgency,reminder_enabled,completed_at,completed_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          ).bind(task.id, task.ownerId, 1, ts, ts, null, task.title, task.description, JSON.stringify(task.checklist), JSON.stringify(task.responsibleIds), task.dueDate, task.dueTime, task.urgency, task.reminderEnabled ? 1 : 0, null, null),
        );
        if (task.reminderEnabled && task.dueDate && task.dueTime)
          await scheduleReminder(env, batch, task.id, task.dueDate, task.dueTime);
      } else if (op.action === "note.create") {
        const space = payload.space === "archive" ? "archive" : "private";
        const note = {
          id: op.entityId,
          ownerId: member.id,
          space,
          revision: 1,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
          title: str(payload.title ?? "", "title", 500),
          content: JSON.parse(tiptapDoc(payload.content ?? { type: "doc", content: [] })),
        };
        entity = note;
        batch.push(
          env.DB.prepare("INSERT INTO notes(id,owner_id,space,revision,created_at,updated_at,deleted_at,title,content) VALUES(?,?,?,?,?,?,?,?,?)")
            .bind(note.id, note.ownerId, note.space, 1, ts, ts, null, note.title, tiptapDoc(payload.content ?? { type: "doc", content: [] })),
        );
      } else if (op.action === "folder.create") {
        const name = str(payload.name, "name", 200).trim();
        if (!name) return fail("invalid", "Nome inválido.");
        const parentId = strOrNull(payload.parentId ?? null, "parentId", 64);
        if (parentId) {
          const parent = await getRow(env, "folder", parentId);
          if (!parent || parent.deleted_at) return fail("invalid_parent", "Pasta pai inválida.");
        }
        const folder = { id: op.entityId, ownerId: member.id, parentId, name, revision: 1, createdAt: ts, updatedAt: ts, deletedAt: null };
        entity = folder;
        batch.push(
          env.DB.prepare("INSERT INTO folders(id,owner_id,parent_id,name,revision,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?)")
            .bind(folder.id, folder.ownerId, folder.parentId, folder.name, 1, ts, ts, null),
        );
      } else if (op.action === "pin.create") {
        const entryId = str(payload.entryId, "entryId", 64);
        const entry =
          (await getRow(env, "file", entryId)) ?? (await getRow(env, "note", entryId));
        if (!entry || entry.deleted_at) return fail("invalid_entry", "Entrada de arquivo inválida.");
        if (entry.space === "private") return fail("forbidden", "Só se afixam entradas comuns.");
        const pin = {
          id: op.entityId,
          ownerId: member.id,
          entryId,
          summary: str(payload.summary ?? "", "summary", 500),
          active: true,
          revision: 1,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
        };
        entity = pin;
        batch.push(
          env.DB.prepare("INSERT INTO pins(id,owner_id,entry_id,summary,active,revision,created_at,updated_at,deleted_at) VALUES(?,?,?,?,1,?,?,?,?)")
            .bind(pin.id, pin.ownerId, pin.entryId, pin.summary, 1, ts, ts, null),
        );
      } else {
        return fail("invalid_action", "Ação desconhecida.");
      }

      await recordHistory(env, batch, op.entityId, 1, entity, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      await env.DB.batch(batch);
      return { operationId: op.operationId, ok: true, entity: entity as never };
    }

    // ações sobre entidades existentes
    const row = await getRow(env, kind, op.entityId);
    if (!row) return fail("not_found", "Recurso inexistente.");
    checkAccess(kind, row, member);

    if (op.action === "task.complete") {
      if (row.completed_at) {
        // concluir é idempotente
        return { operationId: op.operationId, ok: true, entity: taskFromRow(row) };
      }
      const upd = env.DB.prepare("UPDATE tasks SET completed_at=?, completed_by=?, revision=revision+1, updated_at=? WHERE id=? AND revision=? AND completed_at IS NULL")
        .bind(ts, member.id, ts, op.entityId, row.revision);
      const after = { ...taskFromRow(row), completedAt: ts, completedBy: member.id };
      const batch: D1PreparedStatement[] = [upd];
      await cancelReminderJobs(env, batch, op.entityId);
      await recordHistory(env, batch, op.entityId, row.revision + 1, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    if (op.action === "task.reopen") {
      if (!row.completed_at) return { operationId: op.operationId, ok: true, entity: taskFromRow(row) };
      const upd = env.DB.prepare("UPDATE tasks SET completed_at=NULL, completed_by=NULL, revision=revision+1, updated_at=? WHERE id=? AND revision=?")
        .bind(ts, op.entityId, row.revision);
      const after = { ...taskFromRow(row), completedAt: null, completedBy: null };
      const batch: D1PreparedStatement[] = [upd];
      await recordHistory(env, batch, op.entityId, row.revision + 1, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    if (op.action === "task.update") {
      const after: Row = taskFromRow(row);
      if ("title" in payload) {
        const t = str(payload.title, "title", 500).trim();
        if (!t) return fail("invalid", "O título é obrigatório.");
        after.title = t;
      }
      if ("description" in payload) after.description = str(payload.description ?? "", "description", 20000);
      if ("checklist" in payload) after.checklist = checklist(payload.checklist ?? []);
      if ("responsibleIds" in payload) after.responsibleIds = checkIds(payload.responsibleIds ?? [], "responsibleIds");
      if ("urgency" in payload) after.urgency = payload.urgency === "high" ? "high" : "normal";
      if ("dueDate" in payload || "dueTime" in payload) {
        const { dueDate, dueTime } = dueFields(payload);
        if (!("dueDate" in payload)) after.dueDate = dueTime ? after.dueDate : dueDate;
        else after.dueDate = dueDate;
        after.dueTime = dueTime;
      }
      if ("reminderEnabled" in payload) after.reminderEnabled = !!payload.reminderEnabled;
      after.reminderEnabled = after.reminderEnabled && !!after.dueDate && !!after.dueTime && !after.completedAt;
      after.updatedAt = ts;
      after.revision = row.revision + 1;

      const upd = env.DB.prepare(
        "UPDATE tasks SET title=?, description=?, checklist=?, responsible_ids=?, due_date=?, due_time=?, urgency=?, reminder_enabled=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?",
      ).bind(after.title, after.description, JSON.stringify(after.checklist), JSON.stringify(after.responsibleIds), after.dueDate, after.dueTime, after.urgency, after.reminderEnabled ? 1 : 0, ts, op.entityId, row.revision);
      const batch: D1PreparedStatement[] = [upd];
      await cancelReminderJobs(env, batch, op.entityId);
      if (after.reminderEnabled && after.dueDate && after.dueTime && !after.completedAt)
        await scheduleReminder(env, batch, op.entityId, after.dueDate, after.dueTime);
      await recordHistory(env, batch, op.entityId, after.revision, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    if (op.action === "note.update") {
      if (row.owner_id !== member.id) return fail("forbidden", "Sem permissão.");
      const after: Row = noteFromRow(row);
      if ("title" in payload) after.title = str(payload.title ?? "", "title", 500);
      if ("content" in payload) after.content = JSON.parse(tiptapDoc(payload.content));
      after.updatedAt = ts;
      after.revision = row.revision + 1;
      const upd = env.DB.prepare("UPDATE notes SET title=?, content=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?")
        .bind(after.title, JSON.stringify(after.content), ts, op.entityId, row.revision);
      const batch: D1PreparedStatement[] = [upd];
      await recordHistory(env, batch, op.entityId, after.revision, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    if (op.action === "folder.rename" || op.action === "folder.move") {
      const after: Row = folderFromRow(row);
      if (op.action === "folder.rename") {
        const name = str(payload.name, "name", 200).trim();
        if (!name) return fail("invalid", "Nome inválido.");
        after.name = name;
      }
      if (op.action === "folder.move") {
        const parentId = strOrNull(payload.parentId ?? null, "parentId", 64);
        if (parentId) {
          if (parentId === op.entityId) return fail("cycle", "Não pode mover para dentro de si própria.");
          const parent = await getRow(env, "folder", parentId);
          if (!parent || parent.deleted_at) return fail("invalid_parent", "Pasta pai inválida.");
          // validar ciclos: subir a árvore
          let cursor = parent;
          const guard = new Set<string>();
          while (cursor.parent_id) {
            if (guard.has(cursor.id)) break;
            guard.add(cursor.id);
            if (cursor.id === op.entityId) return fail("cycle", "Movimento cria um ciclo.");
            const next = await getRow(env, "folder", cursor.parent_id);
            if (!next) break;
            cursor = next;
          }
        }
        after.parentId = parentId;
      }
      after.updatedAt = ts;
      after.revision = row.revision + 1;
      const upd = env.DB.prepare("UPDATE folders SET name=?, parent_id=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?")
        .bind(after.name, after.parentId, ts, op.entityId, row.revision);
      const batch: D1PreparedStatement[] = [upd];
      await recordHistory(env, batch, op.entityId, after.revision, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    if (op.action === "file.rename" || op.action === "file.move") {
      const after: Row = fileFromRow(row);
      if (op.action === "file.rename") {
        const name = str(payload.name, "name", 300).trim();
        if (!name) return fail("invalid", "Nome inválido.");
        after.name = name;
      }
      if (op.action === "file.move") {
        const folderId = strOrNull(payload.folderId ?? null, "folderId", 64);
        if (folderId) {
          const folder = await getRow(env, "folder", folderId);
          if (!folder || folder.deleted_at) return fail("invalid_folder", "Pasta inválida.");
        }
        after.folderId = folderId;
      }
      after.updatedAt = ts;
      after.revision = row.revision + 1;
      const upd = env.DB.prepare("UPDATE files SET name=?, folder_id=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?")
        .bind(after.name, after.folderId, ts, op.entityId, row.revision);
      const batch: D1PreparedStatement[] = [upd];
      await recordHistory(env, batch, op.entityId, after.revision, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    if (op.action.endsWith(".delete")) {
      if (row.deleted_at) return { operationId: op.operationId, ok: true, entity: TABLES[kind].fromRow(row) };
      const upd = env.DB.prepare(`UPDATE ${table} SET deleted_at=?, revision=revision+1, updated_at=? WHERE id=? AND revision=? AND deleted_at IS NULL`)
        .bind(ts, ts, op.entityId, row.revision);
      const batch: D1PreparedStatement[] = [upd];
      if (kind === "file" || kind === "note") deletePinsForEntry(env, batch, op.entityId);
      if (kind === "folder") {
        // apagar recursivamente conteúdos e subpastas
        batch.push(env.DB.prepare("UPDATE files SET deleted_at=?, revision=revision+1, updated_at=? WHERE folder_id IN (WITH RECURSIVE sub(id) AS (SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id) SELECT id FROM sub) AND deleted_at IS NULL").bind(ts, ts, op.entityId));
        batch.push(env.DB.prepare("UPDATE folders SET deleted_at=?, revision=revision+1, updated_at=? WHERE id IN (WITH RECURSIVE sub(id) AS (SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id) SELECT id FROM sub) AND deleted_at IS NULL").bind(ts, ts, op.entityId));
        batch.push(env.DB.prepare("UPDATE pins SET active=0, deleted_at=?, revision=revision+1, updated_at=? WHERE entry_id IN (WITH RECURSIVE sub(id) AS (SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id) SELECT f.id FROM files f WHERE f.folder_id IN sub) AND active=1").bind(ts, ts, op.entityId));
      }
      if (kind === "task") await cancelReminderJobs(env, batch, op.entityId);
      const after = { ...TABLES[kind].fromRow(row), deletedAt: ts };
      await recordHistory(env, batch, op.entityId, row.revision + 1, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    if (op.action.endsWith(".restore")) {
      if (!row.deleted_at) return { operationId: op.operationId, ok: true, entity: TABLES[kind].fromRow(row) };
      if (kind === "folder") {
        // restaurar só se a pasta pai existir e não estiver apagada (ou for raiz)
        if (row.parent_id) {
          const parent = await getRow(env, "folder", row.parent_id);
          if (!parent || parent.deleted_at) return fail("invalid_parent", "A pasta pai está apagada.");
        }
      }
      if (kind === "file" && row.folder_id) {
        const folder = await getRow(env, "folder", row.folder_id);
        if (!folder || folder.deleted_at) {
          // restaura para a raiz
          await env.DB.prepare("UPDATE files SET folder_id=NULL WHERE id=?").bind(op.entityId).run();
        }
      }
      const upd = env.DB.prepare(`UPDATE ${table} SET deleted_at=NULL, revision=revision+1, updated_at=? WHERE id=? AND revision=? AND deleted_at IS NOT NULL`)
        .bind(ts, op.entityId, row.revision);
      const after = { ...TABLES[kind].fromRow(row), deletedAt: null };
      const batch: D1PreparedStatement[] = [upd];
      await recordHistory(env, batch, op.entityId, row.revision + 1, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    if (op.action === "pin.remove") {
      const upd = env.DB.prepare("UPDATE pins SET active=0, deleted_at=?, revision=revision+1, updated_at=? WHERE id=? AND revision=? AND active=1")
        .bind(ts, ts, op.entityId, row.revision);
      const after = { ...pinFromRow(row), active: false, deletedAt: ts };
      const batch: D1PreparedStatement[] = [upd];
      await recordHistory(env, batch, op.entityId, row.revision + 1, after, member.id);
      batch.push(env.DB.prepare("INSERT INTO operations_seen(operation_id, entity_id, received_at) VALUES(?,?,?)").bind(op.operationId, op.entityId, ts));
      const results = await env.DB.batch(batch);
      if ((results[0].meta?.changes ?? 0) === 0) return fail("conflict", "Revisão em conflito.");
      return { operationId: op.operationId, ok: true, entity: after as never };
    }

    return fail("invalid_action", "Ação desconhecida.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return fail("server_error", msg);
  }
}

export { MAX_FILE_SIZE };
