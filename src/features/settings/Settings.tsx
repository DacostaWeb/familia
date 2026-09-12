import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { syncStatus, onSyncChange, resolveConflictApplyMine, resolveConflictKeepServer, resolveConflictCopy } from "../../lib/sync";
import { db, getMember } from "../../lib/db";
import { enableNotifications, sendTestNotification, registerServiceWorker } from "../../lib/notify";
import type { Member } from "../../../shared/types";

export function Settings({ member, onLogout, onBack }: { member: Member; onLogout: () => void; onBack: () => void }) {
  const [estado, setEstado] = useState<Awaited<ReturnType<typeof syncStatus>> | null>(null);
  const [permissoes, setPermissoes] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [textoMaior, setTextoMaior] = useState(document.documentElement.classList.contains("texto-maior"));
  const [membros, setMembros] = useState<Array<{ id: string; email: string; name: string; role: string; active: boolean }> | null>(null);

  useEffect(() => {
    const refresh = () => void syncStatus().then(setEstado);
    refresh();
    const un = onSyncChange(refresh);
    const t = setInterval(refresh, 3000);
    return () => {
      un();
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (member.role === "admin") {
      void api<{ members: NonNullable<typeof membros> }>("/api/members").then((r) => setMembros(r.members)).catch(() => setMembros(null));
    }
    void registerServiceWorker();
  }, [member.role]);

  return (
    <div>
      <button className="ligacao" onClick={onBack}>
        ← Voltar
      </button>

      <section>
        <h2>Conta</h2>
        <p>
          {member.name} · <span className="mono">{member.email}</span>
          {member.role === "admin" && " · administradora"}
        </p>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Notificações neste dispositivo</h2>
        <p className="mini">Estado: {permissoes === "granted" ? "ativadas" : permissoes === "denied" ? "recusadas nas definições do navegador" : "desativadas"}</p>
        <div className="linha">
          <button
            className="primario"
            onClick={async () => {
              const r = await enableNotifications();
              setMensagem(r.message);
              setPermissoes(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
            }}
          >
            Ativar notificações
          </button>
          <button
            onClick={async () => {
              setMensagem("A enviar…");
              const r = await sendTestNotification();
              setMensagem(r.result === "ok" ? "Notificação de teste enviada." : r.result === "empty" ? "Sem dispositivos com notificações." : "Falha ao enviar notificação de teste.");
            }}
          >
            Enviar notificação de teste
          </button>
        </div>
        {mensagem && <p className="mini">{mensagem}</p>}
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Sincronização</h2>
        <p className="mini">
          {estado?.pending ? `${estado.pending} alteração(ões) por enviar. ` : "Tudo sincronizado. "}
          {estado?.lastSync ? `Última sincronização: ${new Date(estado.lastSync).toLocaleTimeString("pt-PT")}.` : "Ainda não sincronizou."}
        </p>
        {estado?.error && <p className="aviso amarelo">{estado.error}</p>}
        {membros === null && member.role === "admin" && <p className="mini">Sem ligação à gestão de membros.</p>}
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Aparência</h2>
        <button
          onClick={() => {
            const novo = !textoMaior;
            setTextoMaior(novo);
            document.documentElement.classList.toggle("texto-maior", novo);
            localStorage.setItem("familia-texto-maior", novo ? "1" : "0");
          }}
        >
          Texto maior: {textoMaior ? "ligado" : "desligado"}
        </button>
      </section>

      {member.role === "admin" && membros && (
        <section style={{ marginTop: 20 }}>
          <h2>Membros</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Papel</th>
                <th>Ativo</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="mono">{m.email}</td>
                  <td>{m.role === "admin" ? "administrador" : "membro"}</td>
                  <td>
                    <button
                      onClick={async () => {
                        try {
                          await api("/api/members/" + m.id, { method: "PATCH", body: JSON.stringify({ active: !m.active }) });
                          const r = await api<{ members: NonNullable<typeof membros> }>("/api/members");
                          setMembros(r.members);
                        } catch (e) {
                          setMensagem(e instanceof Error ? e.message : "Erro");
                        }
                      }}
                      disabled={m.id === member.id}
                    >
                      {m.active ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <AddMemberForm onAdded={async () => setMembros((await api<{ members: NonNullable<typeof membros> }>("/api/members")).members)} />
        </section>
      )}

      <section style={{ marginTop: 28, borderTop: "3px double #000", paddingTop: 12 }}>
        <button className="perigo" onClick={onLogout}>
          Terminar sessão
        </button>
      </section>
    </div>
  );
}

function AddMemberForm({ onAdded }: { onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  return (
    <form
      className="linha"
      style={{ marginTop: 12 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        try {
          await api("/api/members", { method: "POST", body: JSON.stringify({ email }) });
          setEmail("");
          onAdded();
        } catch (err) {
          setErro(err instanceof Error ? err.message : "Erro ao adicionar.");
        }
      }}
    >
      <input type="email" className="cresce" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email do novo membro" />
      <button type="submit" className="primario">
        Convidar
      </button>
      {erro && <p className="mini">{erro}</p>}
    </form>
  );
}
