import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { saveNote } from "./noteActions";
import { markdownToTiptap } from "./markdown";
import type { Note } from "../../../shared/types";

export function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const [titulo, setTitulo] = useState(note.title);
  const [estado, setEstado] = useState<"guardado" | "a gravar" | "por enviar" | "erro">("a gravar");
  const [confirmarAtualizacao, setConfirmarAtualizacao] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<{ note: Note }>({ note });
  const markdownInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: note.content,
    editorProps: {
      attributes: { class: "tiptap" },
    },
    onUpdate: ({ editor }) => {
      pendente.current.note = { ...note, title: titulo, content: editor.getJSON() };
      setEstado("a gravar");
      if (timer.current) clearTimeout(timer.current);
      // gravação local imediata (atraso curto)
      timer.current = setTimeout(() => {
        void guardar();
      }, 600);
    },
  });

  async function guardar() {
    setEstado("a gravar");
    try {
      await saveNote(pendente.current.note, {});
      setEstado("por enviar");
      // descarregar imediatamente a fila local ao sair do editor também acontece no onClose
      setTimeout(() => setEstado((e) => (e === "por enviar" ? "por enviar" : e)), 0);
    } catch {
      setEstado("erro");
    }
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      // descarregar a fila ao sair do editor
      void saveNote(pendente.current.note, {}).catch(() => undefined);
    };
  }, []);

  function importarMarkdown() {
    markdownInput.current?.click();
  }

  async function lerMarkdown(file: File) {
    const text = await file.text();
    const doc = markdownToTiptap(text);
    editor?.commands.setContent(doc);
    setTitulo(file.name.replace(/\.md$/i, ""));
    pendente.current.note = { ...note, title: file.name.replace(/\.md$/i, ""), content: doc };
    await guardar();
  }

  if (!editor) return null;

  return (
    <div className="veu" role="dialog" aria-label="Editor de nota">
      <div className="interior">
        <div className="cabecalho">
          <h2>{note.space === "archive" ? "Nota de arquivo" : "Nota privada"}</h2>
          <span className={`estado-gravacao ${estado === "por enviar" ? "pendente" : ""}`}>
            {estado === "guardado" ? "Guardado" : estado === "a gravar" ? "A gravar…" : estado === "por enviar" ? "Guardado · a sincronizar" : estado === "erro" ? "Erro ao gravar" : ""}
          </span>
          <button className="ligacao" onClick={onClose}>
            Fechar
          </button>
        </div>

        <input
          className="editor-titulo"
          type="text"
          placeholder="Título"
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            pendente.current.note = { ...pendente.current.note, title: e.target.value };
            setEstado("a gravar");
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => void guardar(), 600);
          }}
        />

        <div className="linha" style={{ margin: "12px 0" }} role="toolbar" aria-label="Formatação">
          <button onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Negrito">
            <strong>N</strong>
          </button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Itálico">
            <em>I</em>
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Título</button>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()}>Lista</button>
          <button onClick={() => editor.chain().focus().toggleTaskList().run()}>Checklist</button>
          <button
            onClick={() => {
              const url = window.prompt("Endereço do link:");
              if (url) editor.chain().focus().setLink({ href: url }).run();
              else editor.chain().focus().unsetLink().run();
            }}
          >
            Link
          </button>
          <button onClick={importarMarkdown}>Importar .md</button>
          <button
            onClick={() => {
              void import("./markdown").then((m) => {
                const md = `# ${titulo || "Sem título"}\n\n${m.tiptapToMarkdown(editor.getJSON())}`;
                const blob = new Blob([md], { type: "text/markdown" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${titulo || "nota"}.md`;
                a.click();
                URL.revokeObjectURL(a.href);
              });
            }}
          >
            Exportar .md
          </button>
          <input
            ref={markdownInput}
            type="file"
            accept=".md,text/markdown"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void lerMarkdown(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="prosa">
          <EditorContent editor={editor} />
        </div>

        {confirmarAtualizacao && (
          <div className="aviso amarelo">
            Este conteúdo também foi alterado noutro dispositivo.
            <div className="linha" style={{ marginTop: 8 }}>
              <button>Usar versão atual</button>
              <button>Aplicar a minha versão</button>
              <button>Guardar como cópia</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
