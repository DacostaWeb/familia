import { useEffect, useState } from "react";
import { useMembers } from "./TaskCard";
import { updateTask, deleteTask, restoreTask, completeTask, reopenTask } from "./taskActions";
import type { ChecklistItem, Member, Task } from "../../../shared/types";
import { formatDue } from "../../lib/tasks";

export function TaskDetail({
  task: initial,
  member,
  onClose,
}: {
  task: Task;
  member: Member;
  onClose: () => void;
}) {
  const members = useMembers();
  const [task, setTask] = useState<Task>(initial);
  const [maisOpcoes, setMaisOpcoes] = useState(false);

  useEffect(() => setTask(initial), [initial]);

  // manter em sync com alterações locais (ex.: sincronização em curso)
  function commit(patch: Partial<Task>) {
    setTask((t) => ({ ...t, ...patch }));
    void updateTask(initial, patch);
  }

  const isNew = task.revision === 0;
  const due = formatDue(task);

  return (
    <div className="veu" role="dialog" aria-label="Detalhe da tarefa">
      <div className="interior">
        <div className="cabecalho">
          <h2>Tarefa</h2>
          <button className="ligacao" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="campo">
          <label htmlFor="td-titulo">Título</label>
          <input
            id="td-titulo"
            type="text"
            value={task.title}
            onChange={(e) => setTask((t) => ({ ...t, title: e.target.value }))}
            onBlur={() => {
              if (task.title.trim() && task.title !== initial.title) commit({ title: task.title.trim() });
            }}
          />
        </div>

        <div className="campo">
          <label htmlFor="td-data">Quando?</label>
          <div className="linha">
            <input
              id="td-data"
              type="date"
              value={task.dueDate ?? ""}
              onChange={(e) => commit({ dueDate: e.target.value || null, dueTime: e.target.value ? task.dueTime : null })}
            />
            {task.dueDate && (
              <input
                type="time"
                aria-label="Hora"
                value={task.dueTime ?? ""}
                onChange={(e) => commit({ dueTime: e.target.value || null })}
              />
            )}
            {task.dueDate && (
              <button onClick={() => commit({ dueDate: null, dueTime: null })}>Remover prazo</button>
            )}
          </div>
          {due && <p className="mini">{due}</p>}
        </div>

        <div className="campo">
          <label>Quem?</label>
          <div className="linha" role="group" aria-label="Responsáveis">
            {members.map((m) => {
              const checked = task.responsibleIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  style={checked ? { background: "#000", color: "#fff" } : undefined}
                  onClick={() =>
                    commit({
                      responsibleIds: checked
                        ? task.responsibleIds.filter((id) => id !== m.id)
                        : [...task.responsibleIds, m.id],
                    })
                  }
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <p className="mini">Sem responsável também está bem.</p>
        </div>

        <button className="ligacao" onClick={() => setMaisOpcoes((v) => !v)}>
          {maisOpcoes ? "Menos opções" : "Mais opções"}
        </button>

        {maisOpcoes && (
          <div style={{ marginTop: 12 }}>
            <div className="campo">
              <label htmlFor="td-desc">Descrição</label>
              <textarea
                id="td-desc"
                value={task.description}
                onChange={(e) => setTask((t) => ({ ...t, description: e.target.value }))}
                onBlur={() => task.description !== initial.description && commit({ description: task.description })}
              />
            </div>

            <div className="campo">
              <label>Checklist</label>
              {task.checklist.map((item) => (
                <div className="linha" key={item.id} style={{ marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) =>
                      commit({
                        checklist: task.checklist.map((c) => (c.id === item.id ? { ...c, done: e.target.checked } : c)),
                      })
                    }
                    style={{ width: 24, height: 24 }}
                  />
                  <input
                    type="text"
                    className="cresce"
                    value={item.text}
                    onChange={(e) =>
                      commit({
                        checklist: task.checklist.map((c) => (c.id === item.id ? { ...c, text: e.target.value } : c)),
                      })
                    }
                  />
                  <button
                    onClick={() => commit({ checklist: task.checklist.filter((c) => c.id !== item.id) })}
                    aria-label="Remover item"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  commit({ checklist: [...task.checklist, { id: crypto.randomUUID(), text: "", done: false } as ChecklistItem] })
                }
              >
                Adicionar item
              </button>
            </div>

            <div className="campo">
              <label>Urgência</label>
              <div className="linha">
                <button
                  style={task.urgency === "normal" ? { background: "#000", color: "#fff" } : undefined}
                  onClick={() => commit({ urgency: "normal" })}
                >
                  Normal
                </button>
                <button
                  style={task.urgency === "high" ? { background: "#000", color: "#fff" } : undefined}
                  onClick={() => commit({ urgency: "high" })}
                >
                  Urgente
                </button>
              </div>
            </div>

            <div className="campo">
              <label>Lembrete</label>
              <button
                style={task.reminderEnabled ? { background: "#000", color: "#fff" } : undefined}
                onClick={() => commit({ reminderEnabled: !task.reminderEnabled })}
              >
                {task.reminderEnabled ? "Lembrete ligado" : "Lembrete desligado"}
              </button>
              <p className="mini">O lembrete precisa de data e hora.</p>
            </div>
          </div>
        )}

        <div className="linha" style={{ marginTop: 24 }}>
          {task.completedAt ? (
            <button className="primario" onClick={() => void reopenTask(initial)}>
              Reabrir
            </button>
          ) : (
            <button
              className="primario"
              onClick={() => {
                void completeTask(initial, member.id);
                onClose();
              }}
            >
              Concluir
            </button>
          )}
          {task.deletedAt ? (
            <button onClick={() => void restoreTask(initial)}>Restaurar</button>
          ) : (
            <button
              className="perigo"
              onClick={() => {
                void deleteTask(initial);
                onClose();
              }}
            >
              Apagar
            </button>
          )}
          <span className="mini" style={{ marginLeft: "auto" }}>
            {isNew ? "Por sincronizar" : "Sincronizado"}
          </span>
        </div>
      </div>
    </div>
  );
}
