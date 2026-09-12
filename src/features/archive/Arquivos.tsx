import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { scheduleSync } from "../../lib/sync";
import { api, ApiError } from "../../lib/api";
import type { ArchiveFile, Folder, Member, Note } from "../../../shared/types";
import { createFolder, deleteFile, deleteFolder, moveFile, moveFolder, renameFile, renameFolder, restoreFile, restoreFolder, pinEntry, formatSize } from "./archiveActions";
import { NoteEditor } from "../notes/NoteEditor";
import { newNote } from "../notes/noteActions";
import { TrashSection } from "../../components/TrashSection";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export function Arquivos({ member }: { member: Member }) {
  const [caminho, setCaminho] = useState<string[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [notaAberta, setNotaAberta] = useState<Note | null>(null);
  const [detalhe, setDetalhe] = useState<ArchiveFile | null>(null);
  const inputFicheiro = useRef<HTMLInputElement>(null);

  const folders = useLiveQuery(() => db.folders.toArray(), [], [] as Folder[]);
  const files = useLiveQuery(() => db.files.toArray(), [], [] as ArchiveFile[]);
  const notes = useLiveQuery(() => db.notes.where("space").equals("archive").toArray(), [], [] as Note[]);

  const pastaAtual = caminho.length ? caminho[caminho.length - 1] : null;
  const pastasVisiveis = (folders ?? []).filter((f) => !f.deletedAt && (f.parentId ?? null) === pastaAtual);
  const ficheirosVisiveis = (files ?? []).filter((f) => !f.deletedAt && (f.folderId ?? null) === pastaAtual);
  const notasVisiveis = (notes ?? []).filter((n) => !n.deletedAt);

  async function carregarFicheiros(lista: FileList | null) {
    if (!lista?.length) return;
    setErro(null);
    for (const file of Array.from(lista)) {
      if (file.size > MAX_FILE_SIZE) {
        setErro(`“${file.name}” excede o limite de 15 MB.`);
        continue;
      }
      setUploading(file.name);
      try {
        const id = "ar-" + crypto.randomUUID();
        // 1. criar registo pendente
        await api("/api/uploads", {
          method: "POST",
          body: JSON.stringify({ id, name: file.name, mime: file.type || "application/octet-stream", size: file.size, folderId: pastaAtual }),
        });
        // 2. enviar bytes
        await fetch(`/api/uploads/${id}/content`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        });
        // 3. finalizar
        await api(`/api/uploads/${id}/complete`, { method: "POST" });
        await scheduleSync(0);
      } catch (e) {
        if (e instanceof ApiError && e.status === 413) setErro(`“${file.name}” excede o limite de 15 MB.`);
        else setErro(`Falha ao carregar “${file.name}”.`);
      } finally {
        setUploading(null);
      }
    }
  }

  async function novaPasta() {
    const name = window.prompt("Nome da pasta:");
    if (!name?.trim()) return;
    await createFolder(name.trim(), pastaAtual);
    void scheduleSync(0);
  }

  async function novaNotaArquivo() {
    const nota = newNote("archive");
    nota.ownerId = member.id;
    await db.notes.put(nota);
    setNotaAberta(nota);
    void scheduleSync(0);
  }

  if (notaAberta) {
    return (
      <NoteEditor
        note={notaAberta}
        onClose={() => {
          setNotaAberta(null);
          void scheduleSync(0);
        }}
      />
    );
  }

  return (
    <div>
      <p className="mini">Partilhado com a família</p>

      <div className="caminho" aria-label="Caminho">
        <button onClick={() => setCaminho([])}>Arquivos</button>
        {caminho.map((id, idx) => {
          const f = (folders ?? []).find((x) => x.id === id);
          return (
            <span key={id}>
              <span aria-hidden> / </span>
              <button onClick={() => setCaminho(caminho.slice(0, idx + 1))}>{f?.name ?? "…"}</button>
            </span>
          );
        })}
      </div>

      <div className="linha" style={{ marginBottom: 16 }}>
        <button className="primario" onClick={() => inputFicheiro.current?.click()} disabled={!!uploading}>
          {uploading ? `A carregar ${uploading}…` : "Carregar ficheiros"}
        </button>
        <button onClick={() => void novaPasta()}>Nova pasta</button>
        <button onClick={() => void novaNotaArquivo()}>Nova nota</button>
        <input
          ref={inputFicheiro}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            void carregarFicheiros(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {erro && <p className="aviso amarelo">{erro}</p>}

      {pastasVisiveis.map((f) => (
        <div
          key={f.id}
          className="entrada"
          role="button"
          tabIndex={0}
          onClick={() => setCaminho([...caminho, f.id])}
          onKeyDown={(e) => e.key === "Enter" && setCaminho([...caminho, f.id])}
        >
          <span className="icone" aria-hidden>
            ▤
          </span>
          <div style={{ flex: 1 }}>
            <div className="nome">{f.name}</div>
            <div className="mini">Pasta</div>
          </div>
          <button
            className="ligacao"
            onClick={(e) => {
              e.stopPropagation();
              const name = window.prompt("Novo nome:", f.name);
              if (name?.trim()) void renameFolder(f, name.trim());
            }}
          >
            Renomear
          </button>
          <button
            className="ligacao"
            onClick={(e) => {
              e.stopPropagation();
              const destino = window.prompt("ID da pasta destino (vazio = raiz):", "");
              if (destino !== null) void moveFolder(f, destino.trim() || null);
            }}
          >
            Mover
          </button>
          <button
            className="ligacao"
            onClick={(e) => {
              e.stopPropagation();
              void deleteFolder(f);
            }}
          >
            Apagar
          </button>
        </div>
      ))}

      {ficheirosVisiveis.map((f) => {
        const imagem = /^image\//.test(f.mime);
        return (
          <div
            key={f.id}
            className="entrada"
            role="button"
            tabIndex={0}
            onClick={() => setDetalhe(f)}
            onKeyDown={(e) => e.key === "Enter" && setDetalhe(f)}
          >
            {imagem ? (
              <img className="miniatura" src={`/api/files/${f.id}/content`} alt="" />
            ) : (
              <span className="icone" aria-hidden>
                {f.mime === "application/pdf" ? "§" : "▪"}
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nome">{f.name}</div>
              <div className="detalhe">
                {formatSize(f.size)}
                {f.revision === 0 ? " · por sincronizar" : ""}
              </div>
            </div>
            <a
              href={`/api/files/${f.id}/content`}
              download={f.name}
              onClick={(e) => e.stopPropagation()}
              className="ligacao"
              style={{ textDecoration: "none" }}
            >
              <button className="ligacao">Descarregar</button>
            </a>
          </div>
        );
      })}

      {notasVisiveis.map((n) => (
        <div
          key={n.id}
          className="entrada"
          role="button"
          tabIndex={0}
          onClick={() => setNotaAberta(n)}
          onKeyDown={(e) => e.key === "Enter" && setNotaAberta(n)}
        >
          <span className="icone" aria-hidden>
            ✎
          </span>
          <div style={{ flex: 1 }}>
            <div className="nome">{n.title || "Nota sem título"}</div>
            <div className="mini">Nota de arquivo</div>
          </div>
        </div>
      ))}

      {!pastasVisiveis.length && !ficheirosVisiveis.length && !notasVisiveis.length && <p>Pasta vazia.</p>}

      <TrashSection kind="archive" />

      {detalhe && <FileDetail file={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  );
}

function FileDetail({ file, onClose }: { file: ArchiveFile; onClose: () => void }) {
  return (
    <div className="veu" role="dialog" aria-label="Detalhe do ficheiro">
      <div className="interior">
        <div className="cabecalho">
          <h2 style={{ overflowWrap: "anywhere" }}>{file.name}</h2>
          <button className="ligacao" onClick={onClose}>
            Fechar
          </button>
        </div>
        <p className="mini mono">
          {file.mime} · {formatSize(file.size)}
        </p>
        {file.mime === "application/pdf" || /^image\//.test(file.mime) ? (
          <p>
            <a href={`/api/files/${file.id}/content`} target="_blank" rel="noreferrer">
              Abrir pré-visualização
            </a>
          </p>
        ) : null}
        <div className="linha" style={{ marginTop: 16 }}>
          <button
            className="primario"
            onClick={() => {
              void pinEntry(file.id, file.name);
              onClose();
            }}
          >
            Afixar na Casa
          </button>
          <button
            onClick={() => {
              const name = window.prompt("Novo nome:", file.name);
              if (name?.trim()) void renameFile(file, name.trim());
            }}
          >
            Renomear
          </button>
          <button
            onClick={() => {
              const destino = window.prompt("ID da pasta destino (vazio = raiz):", file.folderId ?? "");
              if (destino !== null) void moveFile(file, destino.trim() || null);
            }}
          >
            Mover
          </button>
          <button
            className="perigo"
            onClick={() => {
              void deleteFile(file);
              onClose();
            }}
          >
            Apagar
          </button>
        </div>
        <p className="mini" style={{ marginTop: 16 }}>
          “Afixar na Casa” cria um post-it amarelo na Casa para toda a família.
        </p>
      </div>
    </div>
  );
}

export { restoreFile, restoreFolder };
