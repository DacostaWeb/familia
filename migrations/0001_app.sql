-- Família da Costa: tabelas da aplicação
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  checklist TEXT NOT NULL DEFAULT '[]',
  responsible_ids TEXT NOT NULL DEFAULT '[]',
  due_date TEXT,
  due_time TEXT,
  urgency TEXT NOT NULL DEFAULT 'normal',
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  completed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks (updated_at);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  space TEXT NOT NULL DEFAULT 'private',
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes (updated_at);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  folder_id TEXT,
  name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files (folder_id);

CREATE TABLE IF NOT EXISTS pins (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS operations_seen (
  operation_id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  data TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_entity ON history (entity_id, revision);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  run_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs (status, run_at);

-- Membros iniciais (Eduardo admin; Pedro, Lucinda e Hugo membros)
INSERT OR IGNORE INTO members (id, email, name, role, active, created_at) VALUES
  ('m-eduardo', 'atelierdacostafinanceiro@gmail.com', 'Eduardo', 'admin', 1, '2026-09-12T00:00:00.000Z'),
  ('m-pedro', 'dacostaarquitectos@gmail.com', 'Pedro', 'member', 1, '2026-09-12T00:00:00.000Z'),
  ('m-lucinda', 'lucindabc@gmail.com', 'Lucinda', 'member', 1, '2026-09-12T00:00:00.000Z'),
  ('m-hugo', 'hugo.barrosferreira@gmail.com', 'Hugo', 'member', 1, '2026-09-12T00:00:00.000Z');

-- Pastas iniciais do arquivo comum
INSERT OR IGNORE INTO folders (id, owner_id, parent_id, name, revision, created_at, updated_at, deleted_at) VALUES
  ('f-casa', 'm-eduardo', NULL, 'Casa', 1, '2026-09-12T00:00:00.000Z', '2026-09-12T00:00:00.000Z', NULL),
  ('f-documentos', 'm-eduardo', NULL, 'Documentos da família', 1, '2026-09-12T00:00:00.000Z', '2026-09-12T00:00:00.000Z', NULL);
