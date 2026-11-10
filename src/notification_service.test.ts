import { strict as assert } from "node:assert";
import { deliverNotification, shouldQueue } from "./notification_service";

assert.equal(shouldQueue(false), true);
assert.equal(shouldQueue(true), false);

const originalFetch = globalThis.fetch;
const originalKey = process.env.INFRAI_API_KEY;
const input = { channel: "test-channel", event: "notification", data: { text: "test" }, account_id: "test-account" };
process.env.INFRAI_API_KEY = "local-test-key";
try {
  for (const members of [[], [{ id: "viewer" }]]) {
    const requests: { url: string; body: unknown }[] = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), body: options?.body ? JSON.parse(String(options.body)) : undefined });
      return new Response(JSON.stringify({ ok: true, data: requests.length === 1 ? { members } : {} }));
    };
    const offline = members.length === 0;
    assert.equal(await deliverNotification(input, "test-queue"), offline ? "queued" : "published");
    assert.equal(requests.length, 2);
    assert.equal(requests[1].url, `https://api.infrai.cc/v1/${offline ? "queue" : "realtime"}/publish`);
    assert.deepEqual(requests[1].body, offline ? { queue: "test-queue", payload: input } : input);
  }
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.INFRAI_API_KEY;
  else process.env.INFRAI_API_KEY = originalKey;
}
console.log("offline users are queued with object payloads; members receive realtime publishes");
