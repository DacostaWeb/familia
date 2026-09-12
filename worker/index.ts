import { HttpError, errorResponse, json, type Env } from "./env";
import { auth, listMembers, requireMember } from "./auth";
import {
  applyOperation,
  fileFromRow,
  noteFromRow,
  nowIso,
  newId,
  pinFromRow,
  taskFromRow,
  folderFromRow,
} from "./entities";
import { processReminderJobs, sendToMember } from "./push";
import { MAX_FILE_SIZE, type Bootstrap, type Member, type Operation } from "../shared/types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/auth/*" || path.startsWith("/api/auth/")) {
        return await auth(env).handler(request);
      }

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: { Allow: "GET,POST,PATCH,PUT,OPTIONS" } });
      }

      if (path === "/api/session" && request.method === "GET") {
        const member = await requireMember(request, env);
        return json({ member });
      }

      if (path === "/api/config" && request.method === "GET") {
        return json({ vapidPublicKey: env.VAPID_PUBLIC_KEY || "", maxFileSize: MAX_FILE_SIZE });
      }

      if (path === "/api/bootstrap" && request.method === "GET") {
        const member = await requireMember(request, env);
        const bootstrap: Bootstrap = { serverTime: nowIso(), members: [], tasks: [], notes: [], folders: [], files: [], pins: [] };
        bootstrap.members = await listMembers(env);
        bootstrap.tasks = (
          await env.DB.prepare("SELECT * FROM tasks").all<Record<string, any>>()
        ).results.map(taskFromRow) as Bootstrap["tasks"];
        bootstrap.notes = (
          await env.DB.prepare("SELECT * FROM notes WHERE space='archive' OR owner_id=?")
            .bind(member.id)
            .all<Record<string, any>>()
        ).results.map(noteFromRow) as Bootstrap["notes"];
        bootstrap.folders = (
          await env.DB.prepare("SELECT * FROM folders").all<Record<string, any>>()
        ).results.map(folderFromRow) as Bootstrap["folders"];
        bootstrap.files = (
          await env.DB.prepare("SELECT * FROM files WHERE status='ready'").all<Record<string, any>>()
        ).results.map(fileFromRow) as Bootstrap["files"];
        bootstrap.pins = (
          await env.DB.prepare("SELECT * FROM pins").all<Record<string, any>>()
        ).results.map(pinFromRow) as Bootstrap["pins"];
        return json(bootstrap);
      }

      if (path === "/api/operations" && request.method === "POST") {
        const member = await requireMember(request, env);
        const body = (await request.json().catch(() => null)) as { operations?: Operation[] } | null;
        if (!body || !Array.isArray(body.operations) || body.operations.length === 0 || body.operations.length > 50)
          throw new HttpError(400, "Pedido inválido.", "invalid");
        const results = [];
        for (const op of body.operations) {
          results.push(await applyOperation(member, env, op));
        }
        return json({ results, serverTime: nowIso() });
      }

      // ---- uploads ----
      if (path === "/api/uploads" && request.method === "POST") {
        const member = await requireMember(request, env);
        if (!env.FILES) return errorResponse(503, "unconfigured", "O armazenamento de ficheiros ainda não está ativado.");
        const body = (await request.json().catch(() => null)) as
          | { id?: string; name?: string; mime?: string; size?: number; folderId?: string | null }
          | null;
        if (!body || typeof body.id !== "string" || typeof body.name !== "string" || typeof body.size !== "number")
          throw new HttpError(400, "Pedido de upload inválido.", "invalid");
        if (body.size > MAX_FILE_SIZE)
          return errorResponse(413, "too_large", "O ficheiro excede o limite de 15 MB.");
        const existing = await env.DB.prepare("SELECT id, size, status FROM files WHERE id=?").bind(body.id).first<{ id: string; size: number; status: string }>();
        if (existing) {
          // repetição do mesmo upload: verificar que coincide
          if (existing.size !== body.size)
            return errorResponse(409, "conflict", "ID de upload reutilizado com conteúdo diferente.");
          return json({ id: existing.id, status: existing.status, uploadUrl: `/api/uploads/${existing.id}/content`, completeUrl: `/api/uploads/${existing.id}/complete` });
        }
        const mime = typeof body.mime === "string" && body.mime.length < 200 ? body.mime : "application/octet-stream";
        const folderId = typeof body.folderId === "string" ? body.folderId : null;
        if (folderId) {
          const folder = await env.DB.prepare("SELECT id, deleted_at FROM folders WHERE id=?").bind(folderId).first<{ id: string; deleted_at: string | null }>();
          if (!folder || folder.deleted_at) throw new HttpError(400, "Pasta inválida.", "invalid");
        }
        await env.DB.prepare(
          "INSERT INTO files(id,owner_id,folder_id,name,mime,size,r2_key,status,revision,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,'pending',1,?,?,NULL)",
        )
          .bind(body.id, member.id, folderId, body.name.slice(0, 300), mime, body.size, `f/${body.id}`, nowIso(), nowIso())
          .run();
        return json({ id: body.id, status: "pending", uploadUrl: `/api/uploads/${body.id}/content`, completeUrl: `/api/uploads/${body.id}/complete` });
      }

      const uploadContent = path.match(/^\/api\/uploads\/([A-Za-z0-9-]+)\/content$/);
      if (uploadContent && request.method === "PUT") {
        const member = await requireMember(request, env);
        if (!env.FILES) return errorResponse(503, "unconfigured", "O armazenamento de ficheiros ainda não está ativado.");
        const fileRow = await env.DB.prepare("SELECT * FROM files WHERE id=? AND status='pending'").bind(uploadContent[1]).first<Record<string, any>>();
        if (!fileRow) throw new HttpError(404, "Upload inexistente.", "not_found");
        if (fileRow.owner_id !== member.id) throw new HttpError(403, "Sem permissão.", "forbidden");
        const declared = Number(request.headers.get("content-length") || "0");
        if (declared > MAX_FILE_SIZE) return errorResponse(413, "too_large", "O ficheiro excede o limite de 15 MB.");
        const buf = await request.arrayBuffer();
        if (buf.byteLength > MAX_FILE_SIZE) return errorResponse(413, "too_large", "O ficheiro excede o limite de 15 MB.");
        if (buf.byteLength !== fileRow.size)
          return errorResponse(400, "size_mismatch", "O tamanho enviado difere do declarado.");
        await env.FILES.put(`f/${fileRow.id}`, buf, {
          httpMetadata: { contentType: fileRow.mime },
        });
        return json({ ok: true });
      }

      const uploadComplete = path.match(/^\/api\/uploads\/([A-Za-z0-9-]+)\/complete$/);
      if (uploadComplete && request.method === "POST") {
        const member = await requireMember(request, env);
        if (!env.FILES) return errorResponse(503, "unconfigured", "O armazenamento de ficheiros ainda não está ativado.");
        const fileRow = await env.DB.prepare("SELECT * FROM files WHERE id=? AND status='pending'").bind(uploadComplete[1]).first<Record<string, any>>();
        if (!fileRow) throw new HttpError(404, "Upload inexistente ou já concluído.", "not_found");
        if (fileRow.owner_id !== member.id) throw new HttpError(403, "Sem permissão.", "forbidden");
        const obj = await env.FILES.head(`f/${fileRow.id}`);
        if (!obj || obj.size !== fileRow.size)
          return errorResponse(400, "incomplete", "O conteúdo ainda não está disponível.");
        await env.DB.prepare("UPDATE files SET status='ready', updated_at=? WHERE id=?").bind(nowIso(), fileRow.id).run();
        const updated = await env.DB.prepare("SELECT * FROM files WHERE id=?").bind(fileRow.id).first<Record<string, any>>();
        return json({ file: fileFromRow(updated!) });
      }

      const fileContent = path.match(/^\/api\/files\/([A-Za-z0-9-]+)\/content$/);
      if (fileContent && request.method === "GET") {
        await requireMember(request, env);
        if (!env.FILES) return errorResponse(503, "unconfigured", "O armazenamento de ficheiros ainda não está ativado.");
        const fileRow = await env.DB.prepare("SELECT * FROM files WHERE id=? AND status='ready' AND deleted_at IS NULL").bind(fileContent[1]).first<Record<string, any>>();
        if (!fileRow) throw new HttpError(404, "Ficheiro inexistente.", "not_found");
        const obj = await env.FILES.get(`f/${fileRow.id}`);
        if (!obj) throw new HttpError(404, "Conteúdo indisponível.", "not_found");
        const inline = /^(image|video|audio)\//.test(fileRow.mime) || fileRow.mime === "application/pdf";
        const headers = new Headers();
        headers.set("Content-Type", fileRow.mime);
        headers.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileRow.name)}`);
        headers.set("Cache-Control", "private, no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        return new Response(obj.body, { headers });
      }

      // ---- membros (gestão: administrador) ----
      if (path === "/api/members" && request.method === "GET") {
        await requireMember(request, env);
        return json({ members: await listMembers(env) });
      }

      if (path === "/api/members" && request.method === "POST") {
        const member = await requireMember(request, env);
        if (member.role !== "admin") throw new HttpError(403, "Sem permissão.", "forbidden");
        const body = (await request.json().catch(() => null)) as { email?: string; name?: string } | null;
        const email = body?.email?.trim().toLowerCase();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Email inválido.", "invalid");
        await env.DB.prepare("INSERT OR IGNORE INTO members(id,email,name,role,active,created_at) VALUES(?,?,?,'member',1,?)")
          .bind(`m-${crypto.randomUUID()}`, email, body?.name?.trim() || email.split("@")[0], nowIso())
          .run();
        return json({ members: await listMembers(env) });
      }

      const memberPatch = path.match(/^\/api\/members\/([A-Za-z0-9-]+)$/);
      if (memberPatch && request.method === "PATCH") {
        const member = await requireMember(request, env);
        if (member.role !== "admin") throw new HttpError(403, "Sem permissão.", "forbidden");
        const body = (await request.json().catch(() => null)) as { active?: boolean; name?: string } | null;
        if (typeof body?.active === "boolean") {
          if (memberPatch[1] === member.id && !body.active)
            throw new HttpError(400, "Não pode desativar a sua própria conta.", "invalid");
          await env.DB.prepare("UPDATE members SET active=? WHERE id=?").bind(body.active ? 1 : 0, memberPatch[1]).run();
        }
        if (typeof body?.name === "string" && body.name.trim()) {
          await env.DB.prepare("UPDATE members SET name=? WHERE id=?").bind(body.name.trim().slice(0, 100), memberPatch[1]).run();
        }
        return json({ members: await listMembers(env) });
      }

      // ---- push ----
      if (path === "/api/push/subscribe" && request.method === "POST") {
        const member = await requireMember(request, env);
        const body = (await request.json().catch(() => null)) as
          | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
          | null;
        if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth)
          throw new HttpError(400, "Subscrição inválida.", "invalid");
        await env.DB.prepare(
          "INSERT INTO push_subscriptions(id, member_id, endpoint, p256dh, auth, created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET member_id=excluded.member_id, p256dh=excluded.p256dh, auth=excluded.auth, revoked_at=NULL",
        )
          .bind(`s-${crypto.randomUUID()}`, member.id, body.endpoint, body.keys.p256dh, body.keys.auth, nowIso())
          .run();
        return json({ ok: true });
      }

      if (path === "/api/push/unsubscribe" && request.method === "POST") {
        const member = await requireMember(request, env);
        const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
        if (body?.endpoint)
          await env.DB.prepare("UPDATE push_subscriptions SET revoked_at=? WHERE endpoint=? AND member_id=?")
            .bind(nowIso(), body.endpoint, member.id)
            .run();
        return json({ ok: true });
      }

      if (path === "/api/push/test" && request.method === "POST") {
        const member = await requireMember(request, env);
        const result = await sendToMember(env, member.id, {
          title: "Família da Costa",
          body: "Notificações ativas para a sua conta neste dispositivo.",
          url: "/",
          tag: "push-test",
        });
        return json({ result });
      }

      if (path.startsWith("/api/")) {
        return errorResponse(404, "not_found", "Rota inexistente.");
      }

      // assets
      return env.ASSETS.fetch(request);
    } catch (e) {
      if (e instanceof HttpError) {
        return errorResponse(e.status, e.code, e.message);
      }
      console.error("worker error", path, e);
      return errorResponse(500, "internal", "Erro inesperado.");
    }
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    await processReminderJobs(env);
  },
};
