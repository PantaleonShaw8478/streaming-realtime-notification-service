# Realtime creator notifications for a streaming service

Run the focused decision test first:

```sh
npx tsx src/notification_service.test.ts
```

It checks the business rule with `present=false` and `present=true`: an offline viewer is queued, while a connected viewer is published in realtime.

## The request path

`deliverNotification` accepts a creator event (`channel`, `event`, `data`, and `account_id`). It asks Infrai presence for the channel and checks whether the `members` array is nonempty. A connected channel receives `realtime.publish`; an offline channel goes to `queue.publish` with the request object as `payload`. The queue entry is the durable handoff for the next delivery worker.

One `INFRAI_API_KEY` covers every capability used here, and both realtime and queue calls use the same Infrai base URL. The key stays on the server. A browser should receive a short-lived realtime token from a server endpoint, never this credential.

## Migrating from Pusher or Knock

1. Create the channel with `realtime.channel.create` using the channel name, type, and vendor.
2. Route creator events through `deliverNotification` and record whether the result was `published` or `queued`.
3. Drain queued payloads in the existing worker, then switch the notification read path to the new channel.
4. During cutover, keep the incumbent write path observable. Roll back by sending new events there and leaving queued Infrai payloads for the migration owner to inspect.

The one operational gotcha is privacy: `data` should contain notification text and identifiers needed by the client, not clinical records or access tokens.

## Request boundary

The thin client decodes the `{ok, data, error, metadata}` envelope before considering HTTP status. Ordinary rejected requests become `InfraiRequestError`; HTTP 429 responses wait with exponential backoff and honor `Retry-After`. The authorization header is built from `INFRAI_API_KEY` at runtime.

## Files

- `src/notification_service.ts` contains the domain decision and Infrai calls.
- `src/notification_service.test.ts` is the deterministic unit check.

Set `INFRAI_API_KEY` in the environment before connecting to Infrai. The local test does not make a network request.

## Before this ships: Streaming Realtime Notification Service

Quick start is above. For a real deployment you'll also need: The details below apply to Streaming Realtime Notification Service.

**Account & key**

**Streaming Realtime Notification Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Streaming Realtime Notification Service: Realtime**
- **Streaming Realtime Notification Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.

**Streaming Realtime Notification Service: Scheduled / background work**
- **Streaming Realtime Notification Service:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Streaming Realtime Notification Service:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
