import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { groupOpenTasks, formatDue } from "../../lib/tasks";
import type { Member, Pin, Task } from "../../../shared/types";
import { createTask, completeTask, reopenTask } from "./taskActions";
import { TaskCard, useMembers } from "./TaskCard";
import { TaskDetail } from "./TaskDetail";
import { PinCard } from "./PinCard";
import { TrashSection } from "../../components/TrashSection";

export function Casa({ member }: { member: Member }) {
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Task | null>(null);
  const [tarefaAberta, setTarefaAberta] = useState<Task | null>(null); // pedido de notificação

  // abrir tarefa vinda de notificação
  useMemo(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get("task");
    if (taskId) {
      void db.tasks.get(taskId).then((t) => {
        if (t) setTarefaAberta(t);
      });
    }
  }, []);

  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [] as Task[]);
  const pins = useLiveQuery(
    async () => {
      const active = await db.pins.where("active").equals(1).toArray();
      const result: (Pin & { title?: string })[] = [];
      for (const pin of active) {
        const file = await db.files.get(pin.entryId);
        if (file && !file.deletedAt) {
          result.push({ ...pin, title: file.name });
          continue;
        }
        const note = await db.notes.get(pin.entryId);
        if (note && note.space === "archive" && !note.deletedAt) {
          result.push({ ...pin, title: note.title || "Nota" });
        }
      }
      return result;
    },
    [],
    [] as (Pin & { title?: string })[],
  );

  const grupos = groupOpenTasks(tasks ?? []);
  const members = useMembers();
  const resolvidas = (tasks ?? []).filter((t) => t.completedAt && !t.deletedAt).sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
  const vazias = (tasks ?? []).length === 0;

  async function adicionar() {
    if (!titulo.trim()) return;
    setErro(null);
    try {
      const t = await createTask(titulo);
      if (t) setTitulo("");
    } catch {
      setErro("Não foi possível guardar localmente. O texto foi mantido.");
    }
  }

  return (
    <div>
      {tarefaAberta && <TaskDetail task={tarefaAberta} member={member} onClose={() => setTarefaAberta(null)} />}

      {pins && pins.length > 0 && (
        <section aria-label="Post-its">
          <h2>Afixado na Casa</h2>
          {pins.map((p) => (
            <PinCard key={p.id} pin={p} member={member} />
          ))}
        </section>
      )}

      <section aria-label="Tarefas" style={{ marginTop: pins && pins.length ? 20 : 0 }}>
        <form
          className="criacao-rapida"
          onSubmit={(e) => {
            e.preventDefault();
            void adicionar();
          }}
        >
          <input
            type="text"
            placeholder="O que é preciso fazer?"
            aria-label="Nova tarefa"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <button type="submit" className="primario" disabled={!titulo.trim()}>
            Adicionar
          </button>
        </form>
        {erro && <p className="aviso amarelo">{erro}</p>}

        {vazias && <p>O que é preciso fazer em casa?</p>}

        {grupos.map(([key, list]) => (
          <div key={key}>
            <div className="grupo">{groupLabel(key)}</div>
            {list.map((t) => (
              <TaskCard
                key={t.id}
                members={members}
                task={t}
                onOpen={() => setDetalhe(t)}
                onToggle={() => (t.completedAt ? void reopenTask(t) : void completeTask(t, member.id))}
              />
            ))}
          </div>
        ))}

        <details style={{ marginTop: 20 }} open={false}>
          <summary style={{ fontWeight: 700, cursor: "pointer", minHeight: 48, lineHeight: "48px" }}>
            Resolvidas ({resolvidas.length})
          </summary>
          <div style={{ marginTop: 8 }}>
            {resolvidas.map((t) => (
              <TaskCard
                key={t.id}
                members={members}
                task={t}
                onOpen={() => setDetalhe(t)}
                onToggle={() => void reopenTask(t)}
              />
            ))}
          </div>
        </details>
      </section>

      <TrashSection kind="task" />

      {detalhe && <TaskDetail task={detalhe} member={member} onClose={() => setDetalhe(null)} />}
    </div>
  );
}

function groupLabel(key: string): string {
  const map: Record<string, string> = {
    atraso: "Em atraso",
    hoje: "Hoje",
    amanha: "Amanhã",
    semana: "Esta semana",
    mes: "Este mês",
    ano: "Este ano",
    depois: "Mais tarde",
    semdata: "Sem data",
  };
  return map[key] ?? key;
}

export { formatDue };
