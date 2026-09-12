export interface Env {
  DB: D1Database;
  FILES?: R2Bucket; // indisponível até o R2 estar ativado na conta
  ASSETS: Fetcher;
  APP_URL: string;
  ADMIN_EMAIL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

let requestIdCounter = 0;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

export function errorResponse(status: number, code: string, message: string) {
  const requestId = `req_${Date.now().toString(36)}_${(requestIdCounter++).toString(36)}`;
  return json({ error: { code, message, requestId } }, status);
}
