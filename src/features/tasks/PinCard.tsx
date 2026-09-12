import { useState } from "react";
import { db } from "../../lib/db";
import { enqueue, upsertLocal } from "../../lib/sync";
import type { Member, Pin } from "../../../shared/types";

export function PinCard({ pin, member }: { pin: Pin & { title?: string }; member: Member }) {
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <div
      className="postit"
      role="button"
      tabIndex={0}
      onClick={() => setAberto(pin.entryId)}
      onKeyDown={(e) => {
        if (e.key === "Enter") setAberto(pin.entryId);
      }}
    >
      <span className="pin" aria-hidden />
      <div className="titulo">{pin.title ?? "Arquivo"}</div>
      {pin.summary && <div className="resumo">{pin.summary}</div>}
      {pin.ownerId === member.id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const next = { ...pin, active: false, deletedAt: new Date().toISOString(), revision: pin.revision };
            void upsertLocal(next, "pin");
            void enqueue(pin.id, pin.revision, "pin.remove", {});
          }}
        >
          Retirar da Casa
        </button>
      )}
      {aberto && <PinTarget entryId={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

function PinTarget({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  void db.files.get(entryId).then((f) => {
    if (f) {
      location.hash = "#/arquivos";
      // detalhe de arquivo abre por caminho; simples: abrir conteúdo
      window.open(`/api/files/${f.id}/content`, "_blank");
      onClose();
    }
  });
  void db.notes.get(entryId).then((n) => {
    if (n) {
      location.hash = "#/arquivos";
      onClose();
    }
  });
  return null;
}
