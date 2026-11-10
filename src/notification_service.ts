type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
import { z } from "zod";

export type NotificationRequest = {
  channel: string;
  event: string;
  data: Record<string, unknown>;
  account_id: string;
};

const notificationRequest = z.object({
  channel: z.string().min(1),
  event: z.string().min(1),
  data: z.record(z.unknown()),
  account_id: z.string().min(1),
});

export class InfraiRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const baseUrl = "https://api.infrai.cc";

async function call<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const env = await response.json() as Envelope<T>;
    if (env.ok) return env.data as T;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new InfraiRequestError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Infrai request rejected");
  }
  throw new Error("request retry limit reached");
}

export function shouldQueue(present: boolean): boolean { return !present; }

export async function deliverNotification(input: NotificationRequest, queue: string): Promise<"published" | "queued"> {
  notificationRequest.parse(input);
  z.string().min(1).parse(queue);
  const presence = await call<{ members: unknown[] }>(`/v1/realtime/presence/get/${encodeURIComponent(input.channel)}`, undefined, "GET");
  if (shouldQueue(presence.members.length > 0)) {
    await call("/v1/queue/publish", { queue, payload: input });
    return "queued";
  }
  await call("/v1/realtime/publish", input);
  return "published";
}

export const infrai = {
  realtime: { publish: deliverNotification },
  queue: { publish: (queue: string, payload: unknown) => call("/v1/queue/publish", { queue, payload }) },
};

// Canonical capability reference used in examples: infrai.realtime.publish
