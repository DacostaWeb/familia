import { betterAuth } from "better-auth";
import type { Env } from "./env";
import { HttpError, json } from "./env";
import type { Member } from "../shared/types";

export function auth(env: Env) {
  return betterAuth({
    database: env.DB,
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    },
    emailAndPassword: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = user.email.toLowerCase();
            const allowed =
              email === env.ADMIN_EMAIL.toLowerCase() ||
              (await env.DB.prepare("SELECT id FROM members WHERE email=? AND active=1")
                .bind(email)
                .first());
            if (!allowed) throw new Error("Esta conta não tem acesso à Família da Costa.");
            return { data: user };
          },
        },
      },
    },
  });
}

export async function requireMember(request: Request, env: Env): Promise<Member> {
  if (!env.GOOGLE_CLIENT_ID || !env.BETTER_AUTH_SECRET || !env.ADMIN_EMAIL)
    throw new HttpError(503, "O administrador precisa de configurar o acesso Google.", "unconfigured");
  const session = await auth(env).api.getSession({ headers: request.headers });
  if (!session?.user || !session.user.emailVerified)
    throw new HttpError(401, "Entre com uma conta Google autorizada.", "unauthenticated");
  const email = session.user.email.toLowerCase();
  if (email === env.ADMIN_EMAIL.toLowerCase()) {
    // criação idempotente do administrador
    const existing = await env.DB.prepare("SELECT id FROM members WHERE email=?").bind(email).first();
    if (!existing) {
      const id = session.user.id || `m-${crypto.randomUUID()}`;
      await env.DB.prepare(
        "INSERT OR IGNORE INTO members(id,email,name,role,active,created_at) VALUES(?,?,?,'admin',1,?)",
      )
        .bind(id, email, session.user.name ?? "Administrador", new Date().toISOString())
        .run();
    }
  }
  const m = await env.DB.prepare("SELECT * FROM members WHERE email=? AND active=1")
    .bind(email)
    .first<{ id: string; email: string; name: string; role: string }>();
  if (!m) throw new HttpError(403, "Esta conta não tem acesso à Família da Costa.", "forbidden");
  return { id: m.id, email: m.email, name: m.name, role: m.role as Member["role"], active: true };
}

export async function listMembers(env: Env): Promise<Member[]> {
  const r = await env.DB.prepare("SELECT id, email, name, role, active FROM members ORDER BY name").all<{
    id: string;
    email: string;
    name: string;
    role: string;
    active: number;
  }>();
  return r.results.map((m) => ({ ...m, role: m.role as Member["role"], active: !!m.active }));
}
