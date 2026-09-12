import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { formatDue } from "../../lib/tasks";
import type { Member, Task } from "../../../shared/types";

export function useMembers(): Member[] {
  const members = useLiveQuery(async () => (await db.meta.get("members"))?.value as Member[] | undefined, [], undefined);
  return members ?? [];
}

export function TaskCard({
  task,
  members,
  onOpen,
  onToggle,
}: {
  task: Task;
  members?: Member[];
  onOpen: () => void;
  onToggle: () => void;
}) {
  const responsible = (members ?? [])
    .filter((m) => task.responsibleIds.includes(m.id))
    .map((m) => m.name)
    .join(", ");
  const due = task.completedAt ? null : formatDue(task);

  return (
    <div className={`cartao tarefa${task.completedAt ? " concluida" : ""}`}>
      <button
        className="checkbox"
        aria-label={task.completedAt ? "Reabrir tarefa" : "Concluir tarefa"}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {task.completedAt ? "✓" : ""}
      </button>
      <div
        style={{ flex: 1, minWidth: 0 }}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpen();
        }}
      >
        <div className="titulo">
          {task.title}
          {task.revision === 0 && <span title="Ainda não sincronizado"> ·</span>}
        </div>
        <div className="meta">
          {due && <span>{due}</span>}
          {responsible && <span>Para: {responsible}</span>}
          {task.urgency === "high" && !task.completedAt && <span className="tag urgente">Urgente</span>}
        </div>
      </div>
    </div>
  );
}
