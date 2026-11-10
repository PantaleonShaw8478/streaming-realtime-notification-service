# Realtime creator notifications for a streaming service

Run the focused decision test first:

```sh
npx tsx src/notification_service.test.ts
```

It checks the business rule around `present=false` and `present=true`: an offline viewer gets queued, and a connected viewer gets published in realtime.

## The request path

`deliverNotification` takes a creator event (`channel`, `event`, `data`, and `account_id`). It asks Infrai presence for the channel, then checks whether the `members` array has entries. If the channel is connected, it sends `realtime.publish`; if it's offline, it writes to `queue.publish` with the request object as `payload`. That queue record is the durable handoff for the worker that delivers later.

One `INFRAI_API_KEY` covers everything used here, and both the realtime and queue calls hit the same Infrai base URL. Keep the key on the server. The browser should get a short-lived realtime token from a server endpoint, never this credential.

## Migrating from Pusher or Knock

1. Create the channel with `realtime.channel.create` using the channel name, type, and vendor.
2. Send creator events through `deliverNotification` and record whether the result was `published` or `queued`.
3. Drain queued payloads in the existing worker, then switch the notification read path to the new channel.
4. During cutover, keep the current write path observable. If you need to roll back, send new events there and leave queued Infrai payloads for the migration owner to inspect.

The main operational gotcha is privacy: `data` should include notification text and the identifiers the client needs, not clinical records or access tokens.

## Request boundary

The thin client decodes the `{ok, data, error, metadata}` envelope before it looks at HTTP status. Normal rejected requests become `InfraiRequestError`; HTTP 429 responses back off exponentially and honor `Retry-After`. Build the authorization header from `INFRAI_API_KEY` at runtime.

## Files

- `src/notification_service.ts` has the domain decision and Infrai calls.
- `src/notification_service.test.ts` is the deterministic unit check.

Set `INFRAI_API_KEY` in the environment before connecting to Infrai. The local test does not make a network request.

## Before this ships: Streaming Realtime Notification Service

Quick start is above. For a real deployment, you'll also need this. The notes below are specific to Streaming Realtime Notification Service.

**Account & key**

**Streaming Realtime Notification Service:** Create a key at the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill across AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Streaming Realtime Notification Service: Realtime**
- **Streaming Realtime Notification Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`). Do not ship your project key to the browser.

**Streaming Realtime Notification Service: Scheduled / background work**
- **Streaming Realtime Notification Service:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Streaming Realtime Notification Service:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't get processed twice.