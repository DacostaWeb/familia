import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { scheduleSync } from "../../lib/sync";
import type { Member, Note } from "../../../shared/types";
import { newNote } from "./noteActions";
import { NoteEditor } from "./NoteEditor";
import { TrashSection } from "../../components/TrashSection";

export function Privado({ member }: { member: Member }) {
  const [aberta, setAberta] = useState<Note | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [creating, setCreating] = useState(false);

  const notas = useLiveQuery(async () => {
    const all = await db.notes.where("space").equals("private").toArray();
    const ativas = all.filter((n) => !n.deletedAt && n.ownerId === member.id);
    ativas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (!pesquisa.trim()) return ativas;
    const q = pesquisa.toLowerCase();
    return ativas.filter(
      (n) => n.title.toLowerCase().includes(q) || JSON.stringify(n.content).toLowerCase().includes(q),
    );
  }, [pesquisa, member.id], [] as Note[]);

  async function novaNota() {
    if (creating) return;
    setCreating(true);
    try {
      const nota = newNote("private");
      nota.ownerId = member.id;
      await db.notes.put(nota);
      setAberta(nota);
      void scheduleSync(0);
    } finally {
      setCreating(false);
    }
  }

  if (aberta) {
    return (
      <NoteEditor
        note={aberta}
        onClose={() => {
          setAberta(null);
          void scheduleSync(0);
        }}
      />
    );
  }

  return (
    <div>
      <div className="linha" style={{ marginBottom: 12 }}>
        <input
          type="search"
          className="cresce"
          placeholder="Pesquisar notas"
          aria-label="Pesquisar notas"
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
        />
        <button className="primario" onClick={() => void novaNota()}>
          Nova nota
        </button>
      </div>

      {notas && notas.length === 0 && <p>Sem notas ainda. Crie a primeira com “Nova nota”.</p>}

      {notas?.map((n) => (
        <div
          key={n.id}
          className="cartao"
          role="button"
          tabIndex={0}
          onClick={() => setAberta(n)}
          onKeyDown={(e) => e.key === "Enter" && setAberta(n)}
          style={{ cursor: "pointer" }}
        >
          <strong>{n.title || "Sem título"}</strong>
          <div className="mini" style={{ color: "inherit" }}>
            {n.revision === 0 ? "Por sincronizar · " : ""}atualizada a {new Date(n.updatedAt).toLocaleDateString("pt-PT")}
          </div>
        </div>
      ))}

      <TrashSection kind="note" />
    </div>
  );
}
