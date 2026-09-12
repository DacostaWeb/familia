import { useEffect, useState } from "react";
import { useAuth, signInGoogle, signOut } from "../lib/auth";
import { onSyncChange, scheduleSync, syncNow, syncStatus } from "../lib/sync";
import { registerServiceWorker } from "../lib/notify";
import { Casa } from "../features/tasks/Casa";
import { Privado } from "../features/notes/Privado";
import { Arquivos } from "../features/archive/Arquivos";
import { Settings } from "../features/settings/Settings";
import { LoginScreen } from "./LoginScreen";

type Tab = "casa" | "privado" | "arquivos" | "definicoes";

function tabFromHash(): Tab {
  const h = location.hash.replace("#/", "").replace("#", "");
  if (h === "privado" || h === "arquivos" || h === "definicoes") return h;
  return "casa";
}

export default function App() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>(tabFromHash());
  const [, force] = useState(0);
  const [syncPill, setSyncPill] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSyncChange(() => force((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (auth.status !== "ready" && auth.status !== "offline") return;
    void registerServiceWorker();
    void syncNow();
    const onOnline = () => void syncNow();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void syncNow();
    }, 30000);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const unauthorized = () => auth.reload();
    window.addEventListener("familia:unauthorized", unauthorized);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("familia:unauthorized", unauthorized);
      clearInterval(interval);
    };
  }, [auth.status === "ready" || auth.status === "offline"]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // pílula de sincronização discreta
  useEffect(() => {
    const t = setInterval(async () => {
      const s = await syncStatus();
      if (s.status === "syncing") setSyncPill("A sincronizar…");
      else if (s.pending > 0) setSyncPill(`${s.pending} alteração(ões) por enviar`);
      else if (s.status === "offline") setSyncPill("Sem ligação — as alterações ficam guardadas");
      else if (s.status === "error") setSyncPill("Erro de sincronização");
      else setSyncPill(null);
    }, 1500);
    return () => clearInterval(t);
  }, []);

  if (auth.status === "checking") {
    return (
      <LoginScreen>
        <p>A verificar…</p>
      </LoginScreen>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <LoginScreen>
        <h1 className="logo">Família da Costa</h1>
        <p className="sub">A pequena ferramenta da casa: tarefas, notas e arquivos da família.</p>
        <button className="primario" onClick={() => void signInGoogle()}>
          Entrar com Google
        </button>
      </LoginScreen>
    );
  }

  if (auth.status === "forbidden") {
    return (
      <LoginScreen>
        <h1 className="logo">Família da Costa</h1>
        <p className="aviso amarelo">{auth.message}</p>
        <button className="ligacao" onClick={() => void signOut()}>
          Trocar de conta
        </button>
      </LoginScreen>
    );
  }

  if (auth.status === "error") {
    return (
      <LoginScreen>
        <h1 className="logo">Família da Costa</h1>
        <p className="aviso">{auth.message}</p>
        <button className="primario" onClick={auth.retry}>
          Tentar novamente
        </button>
      </LoginScreen>
    );
  }

  const member = auth.member;

  return (
    <div className="app-col">
      <header className="topo">
        <span className="marca">Família da Costa</span>
        <div className="acoes">
          <button
            className="ligacao"
            onClick={() => {
              location.hash = "#/definicoes";
              setTab("definicoes");
            }}
          >
            Definições
          </button>
        </div>
      </header>

      <main>
        {tab === "casa" && <Casa member={member} />}
        {tab === "privado" && <Privado member={member} />}
        {tab === "arquivos" && <Arquivos member={member} />}
        {tab === "definicoes" && <Settings member={member} onLogout={() => void signOut()} onBack={() => { location.hash = "#/casa"; setTab("casa"); }} />}
      </main>

      {syncPill && <div className="rodape-estado">{syncPill}</div>}

      {tab !== "definicoes" && (
        <nav className="nav-inferior">
          {(
            [
              ["casa", "⌂", "Casa"],
              ["privado", "✎", "Privado"],
              ["arquivos", "▤", "Arquivos"],
            ] as [Tab, string, string][]
          ).map(([key, icon, label]) => (
            <a
              key={key}
              href={`#/${key}`}
              className={tab === key ? "ativo" : ""}
              onClick={() => setTab(key)}
            >
              <span className="icone" aria-hidden>
                {icon}
              </span>
              {label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
