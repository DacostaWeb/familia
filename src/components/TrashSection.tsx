import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import type { Task, Note, Folder, ArchiveFile } from "../../shared/types";
import { restoreTask, deleteTask } from "../features/tasks/taskActions";
import { restoreNote, deleteNote } from "../features/notes/noteActions";
import { restoreFolder, deleteFolder, restoreFile, deleteFile } from "../features/archive/archiveActions";

export function TrashSection({ kind }: { kind: "task" | "note" | "archive" | "all" }) {
  const [aberto, setAberto] = useState(false);
  const tasks = useLiveQuery(() => db.tasks.where("deletedAt").notEqual("").toArray().then((r) => r.filter((t) => t.deletedAt)), [], [] as Task[]);
  const notes = useLiveQuery(() => db.notes.toArray().then((r) => r.filter((n) => n.deletedAt)), [], [] as Note[]);
  const folders = useLiveQuery(() => db.folders.toArray().then((r) => r.filter((f) => f.deletedAt)), [], [] as Folder[]);
  const files = useLiveQuery(() => db.files.toArray().then((r) => r.filter((f) => f.deletedAt)), [], [] as ArchiveFile[]);
  const total =
    (kind === "task" || kind === "all" ? tasks.length : 0) +
    (kind === "note" || kind === "all" ? notes.length : 0) +
    (kind === "archive" || kind === "all" ? folders.length + files.length : 0);
  if (total === 0) return null;

  return (
    <div className="detalhe-caixote">
      <button className="ligacao" onClick={() => setAberto((v) => !v)}>
        {aberto ? "Fechar caixote" : `Caixote (${total})`}
      </button>
      {aberto && (
        <div>
          {(kind === "task" || kind === "all") &&
            tasks.map((t) => (
              <div className="linha" key={t.id} style={{ borderBottom: "1px solid #000", padding: "4px 0" }}>
                <span className="cresce">{t.title}</span>
                <button onClick={() => void restoreTask(t)}>Restaurar</button>
                <button onClick={() => void deleteTask(t)}>Apagar definitivamente</button>
              </div>
            ))}
          {(kind === "note" || kind === "all") &&
            notes.map((n) => (
              <div className="linha" key={n.id} style={{ borderBottom: "1px solid #000", padding: "4px 0" }}>
                <span className="cresce">{n.title || "Sem título"}</span>
                <button onClick={() => void restoreNote(n)}>Restaurar</button>
                <button onClick={() => void deleteNote(n)}>Apagar definitivamente</button>
              </div>
            ))}
          {(kind === "archive" || kind === "all") && (
            <>
              {folders.map((f) => (
                <div className="linha" key={f.id} style={{ borderBottom: "1px solid #000", padding: "4px 0" }}>
                  <span className="cresce">Pasta: {f.name}</span>
                  <button onClick={() => void restoreFolder(f)}>Restaurar</button>
                  <button onClick={() => void deleteFolder(f)}>Apagar definitivamente</button>
                </div>
              ))}
              {files.map((f) => (
                <div className="linha" key={f.id} style={{ borderBottom: "1px solid #000", padding: "4px 0" }}>
                  <span className="cresce">{f.name}</span>
                  <button onClick={() => void restoreFile(f)}>Restaurar</button>
                  <button onClick={() => void deleteFile(f)}>Apagar definitivamente</button>
                </div>
              ))}
            </>
          )}
          {kind === "task" && null}
        </div>
      )}
    </div>
  );
}
