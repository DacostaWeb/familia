// Tipos partilhados entre worker e cliente (Família da Costa)

export type MemberRole = "admin" | "member";

export type Member = {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  active: boolean;
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Task = {
  id: string;
  ownerId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  responsibleIds: string[];
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:mm
  urgency: "normal" | "high";
  reminderEnabled: boolean;
  completedAt: string | null;
  completedBy: string | null;
};

// Tiptap JSON document (plain object tree)
export type TiptapDoc = Record<string, unknown>;

export type Note = {
  id: string;
  ownerId: string; // autor; notas privadas só são visíveis ao autor
  space: "private" | "archive";
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  title: string;
  content: TiptapDoc;
};

export type Folder = {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ArchiveFile = {
  id: string;
  ownerId: string;
  folderId: string | null;
  name: string;
  mime: string;
  size: number;
  r2Key: string;
  status: "pending" | "ready";
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Pin = {
  id: string;
  ownerId: string;
  entryId: string; // file ou nota de arquivo
  summary: string;
  active: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Operation = {
  operationId: string;
  entityId: string;
  expectedRevision: number;
  action: string;
  payload: unknown;
};

export type OperationResult =
  | { operationId: string; ok: true; entity: Task | Note | Folder | ArchiveFile | Pin }
  | { operationId: string; ok: false; code: string; message: string };

export type Bootstrap = {
  serverTime: string;
  members: Member[];
  tasks: Task[];
  notes: Note[]; // privadas do próprio + notas de arquivo
  folders: Folder[];
  files: ArchiveFile[];
  pins: Pin[];
};

export type SessionInfo = {
  member: Member;
};

export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};

// Ações aceites pelo servidor
export const OPERATIONS = [
  "task.create",
  "task.update",
  "task.complete",
  "task.reopen",
  "task.delete",
  "task.restore",
  "note.create",
  "note.update",
  "note.delete",
  "note.restore",
  "folder.create",
  "folder.rename",
  "folder.move",
  "folder.delete",
  "folder.restore",
  "file.create",
  "file.rename",
  "file.move",
  "file.delete",
  "file.restore",
  "pin.create",
  "pin.remove",
] as const;

export type OperationAction = (typeof OPERATIONS)[number];

export function isOperationAction(a: string): a is OperationAction {
  return (OPERATIONS as readonly string[]).includes(a);
}
