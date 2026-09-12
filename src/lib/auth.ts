import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { db, getMember, setMeta } from "./db";
import { syncNow } from "./sync";
import type { Member } from "../../shared/types";

export type AuthState =
  | { status: "checking" }
  | { status: "signedOut" }
  | { status: "ready"; member: Member }
  | { status: "offline"; member: Member }
  | { status: "forbidden"; message: string }
  | { status: "error"; message: string };

export async function signInGoogle() {
  // redirecionamento na mesma janela (Better Auth)
  const { authClient } = await import("./authClient");
  await authClient.signIn.social({ provider: "google", callbackURL: "/" });
}

export async function signOut() {
  const pending = await db.outbox.count();
  if (pending > 0) {
    const ok = window.confirm(`Tem ${pending} alteração(ões) por sincronizar. Sincronizar antes de sair? (Cancelar sai sem sincronizar.)`);
    if (ok) await syncNow();
  }
  const { authClient } = await import("./authClient");
  await authClient.signOut({ fetchOptions: { onSuccess: () => {} } }).catch(() => undefined);
  await db.tasks.clear();
  await db.notes.clear();
  await db.folders.clear();
  await db.files.clear();
  await db.pins.clear();
  await db.outbox.clear();
  await db.conflicts.clear();
  await db.meta.clear();
  location.href = "/";
}

export function useAuth(): AuthState & { reload: () => void; retry: () => void } {
  const [state, setState] = useState<AuthState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ status: "checking" });
      try {
        // /api/session com timeout de 15 s
        const res = await api<{ member: Member }>("/api/session", undefined, 15000);
        if (cancelled) return;
        await setMeta("member", res.member);
        setState({ status: "ready", member: res.member });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setState({ status: "signedOut" });
          return;
        }
        if (e instanceof ApiError && e.status === 403) {
          setState({ status: "forbidden", message: e.message });
          return;
        }
        // falha de rede/timeout/erro: abrir dados locais da conta conhecida
        const member = await getMember();
        if (member && navigator.onLine === false) {
          setState({ status: "offline", member });
          return;
        }
        if (e instanceof ApiError && (e.code === "timeout" || e.code === "network")) {
          // mesmo com rede aparente, se falhou o contacto, tentar dados locais
          if (member) {
            setState({ status: "offline", member });
            return;
          }
        }
        setState({ status: "error", message: e instanceof Error ? e.message : "Erro inesperado." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return {
    ...state,
    reload: () => setAttempt((a) => a + 1),
    retry: () => setAttempt((a) => a + 1),
  };
}
