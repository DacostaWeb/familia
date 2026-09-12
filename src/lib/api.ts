import type { ApiErrorBody } from "../../shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const controller = timeoutMs ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (controller && timeoutMs) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      signal: controller?.signal ?? (init?.signal as AbortSignal | undefined),
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    if (controller?.signal.aborted) throw new ApiError(0, "timeout", "O servidor demorou demasiado a responder.");
    throw new ApiError(0, "network", "Sem ligação ao servidor.");
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    if (res.ok) throw new ApiError(res.status, "invalid_response", "Resposta inválida do servidor.");
    throw new ApiError(res.status, "invalid_response", "Resposta inválida do servidor.");
  }

  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? `Erro ${res.status}.`);
  }
  return body as T;
}
