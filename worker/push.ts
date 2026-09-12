import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { Env } from "./env";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export async function sendToSubscription(
  env: Env,
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<"ok" | "gone" | "error"> {
  try {
    const request = await buildPushPayload(
      { data: JSON.stringify(payload), options: { ttl: 86400 } },
      { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    );
    const response = await fetch(sub.endpoint, request);
    if (response.status === 404 || response.status === 410) return "gone";
    return response.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function sendToMember(env: Env, memberId: string, payload: PushPayload): Promise<"ok" | "empty" | "error"> {
  const subs = (
    await env.DB.prepare("SELECT * FROM push_subscriptions WHERE member_id=? AND revoked_at IS NULL")
      .bind(memberId)
      .all<{ endpoint: string; p256dh: string; auth: string }>()
  ).results;
  if (!subs.length) return "empty";
  let error = false;
  for (const sub of subs) {
    const result = await sendToSubscription(env, sub, payload);
    if (result === "gone") {
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(sub.endpoint).run();
    } else if (result === "error") {
      error = true;
    }
  }
  return error ? "error" : "ok";
}

// Cron: processar lembretes vencidos
export async function processReminderJobs(env: Env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) return;
  const now = Date.now();
  const jobs = (
    await env.DB.prepare("SELECT * FROM jobs WHERE type='reminder' AND status='pending' AND run_at<=? ORDER BY run_at LIMIT 10")
      .bind(now)
      .all<{ id: string; payload: string; attempts: number; run_at: number }>()
  ).results;

  for (const job of jobs) {
    const { taskId } = JSON.parse(job.payload) as { taskId: string };
    const task = await env.DB.prepare("SELECT * FROM tasks WHERE id=?").bind(taskId).first<Record<string, any>>();
    const invalid =
      !task ||
      task.deleted_at ||
      task.completed_at ||
      !task.reminder_enabled ||
      !task.due_date ||
      !task.due_time;
    if (invalid) {
      await env.DB.prepare("UPDATE jobs SET status='cancelled', finished_at=? WHERE id=?")
        .bind(new Date().toISOString(), job.id)
        .run();
      continue;
    }
    // destinatários: responsáveis; sem responsáveis, o autor
    const recipients: string[] = JSON.parse(task.responsible_ids);
    if (!recipients.length) recipients.push(task.owner_id);
    // confirmar que os destinatários continuam ativos
    const active: string[] = [];
    for (const rid of recipients) {
      const m = await env.DB.prepare("SELECT id FROM members WHERE id=? AND active=1").bind(rid).first();
      if (m) active.push(rid);
    }
    if (!active.length) {
      await env.DB.prepare("UPDATE jobs SET status='cancelled', finished_at=? WHERE id=?")
        .bind(new Date().toISOString(), job.id)
        .run();
      continue;
    }
    let failure = false;
    for (const memberId of active) {
      const result = await sendToMember(env, memberId, {
        title: "Família da Costa",
        body: "Tem uma tarefa para consultar.",
        url: "/?task=" + taskId,
        tag: `reminder-${taskId}-${job.run_at}`,
      });
      if (result === "error") failure = true;
    }
    if (failure) {
      const attempts = job.attempts + 1;
      const waitMinutes = Math.min(1440, 2 ** attempts);
      if (attempts >= 8) {
        await env.DB.prepare("UPDATE jobs SET status='failed', attempts=?, finished_at=? WHERE id=?")
          .bind(attempts, new Date().toISOString(), job.id)
          .run();
      } else {
        await env.DB.prepare("UPDATE jobs SET attempts=?, run_at=? WHERE id=?")
          .bind(attempts, now + waitMinutes * 60000, job.id)
          .run();
      }
    } else {
      await env.DB.prepare("UPDATE jobs SET status='sent', finished_at=? WHERE id=?")
        .bind(new Date().toISOString(), job.id)
        .run();
    }
  }
}
