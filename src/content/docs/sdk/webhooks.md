---
title: Receiving webhooks
description: Signature verification with constructEvent, the 24h rotation overlap, and the delivery retry schedule.
---

Boomin delivers events to your HTTPS endpoint as a `POST` with a JSON body and a
`Boomin-Signature` header. Managing endpoints is covered in
[`webhooks`](/sdk/resources/webhooks/); this page is about *receiving* them
safely.

## The signature header

```txt
Boomin-Signature: t=1754006400,v1=6a3f...c1,v1=98be...02
```

- `t` — unix seconds at signing time.
- `v1` — hex HMAC-SHA256 over the string `` `${t}.${rawBody}` ``, keyed by the
  endpoint's signing secret.
- **Multiple `v1` entries appear during secret rotation** (see below).

## constructEvent

```js
import { constructEvent } from "@boomin/sdk/webhooks";
// or: Boomin.webhooks.constructEvent(...)

const event = await constructEvent(payload, sigHeader, secret, { tolerance: 300 });
```

Three things to get right:

1. **It is `async`.** WebCrypto is async, so `constructEvent` returns a promise.
   Forgetting `await` gives you a promise that never fails your check — the
   classic silent hole. Always `await` inside a `try`.
2. **Pass the raw body.** A `string`, `Uint8Array`, or `ArrayBuffer` exactly as
   received. Never `JSON.parse` first and re-stringify — key order and
   whitespace change the bytes and the HMAC will not match.
3. **Catch and reject.** Verification failure throws
   `WebhookSignatureVerificationError` (code `webhook_signature_invalid`).

### Cloudflare Workers

```js
import { constructEvent } from "@boomin/sdk/webhooks";

export default {
  async fetch(request, env, ctx) {
    const payload = await request.text();
    let event;
    try {
      event = await constructEvent(
        payload,
        request.headers.get("Boomin-Signature"),
        env.BOOMIN_WEBHOOK_SECRET,
      );
    } catch (err) {
      return new Response("invalid signature", { status: 400 });
    }

    ctx.waitUntil(handle(event));   // do the work off the response path
    return new Response("ok");      // answer 2xx immediately
  },
};
```

### Express

```js
import express from "express";
import { constructEvent } from "@boomin/sdk/webhooks";

const app = express();

// express.raw — NOT express.json — for this route.
app.post("/webhooks/boomin", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await constructEvent(req.body, req.get("Boomin-Signature"), process.env.BOOMIN_WEBHOOK_SECRET);
    res.status(200).send("ok");
    queue.push(event);
  } catch {
    res.status(400).send("invalid signature");
  }
});
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `tolerance` | `300` | Maximum signature age in seconds. `0` disables the age check. |
| `now` | `Date.now()/1000` | Override the clock (tests only). |

A timestamp older than `tolerance` throws — the delivery is either a replay or
your clock is skewed. If you see these in production, check NTP before raising
the tolerance.

## Secret rotation

`rotateSecret` installs a fresh `whsec_...` (revealed only in that response) and
keeps the **previous** secret honored for a **24-hour overlap window**. During
the window every delivery carries **two** `v1` entries — current first, previous
second — so a receiver holding either secret verifies.

Zero-downtime rotation:

```js
// 1. Rotate. Store the new secret alongside the old one.
const { webhook_endpoint } = await boomin.webhooks.endpoints.rotateSecret("we_...");
await secrets.put("BOOMIN_WEBHOOK_SECRET_NEXT", webhook_endpoint.secret);

// 2. Verify against both for the length of the window.
const event = await constructEvent(payload, sigHeader, [
  env.BOOMIN_WEBHOOK_SECRET,
  env.BOOMIN_WEBHOOK_SECRET_NEXT,
]);

// 3. After 24h, promote NEXT to primary and drop the old one.
```

`constructEvent` accepts a single secret or an array; it evaluates every
candidate against every provided signature in constant time.

Rotating **again inside the window** replaces the previous secret — only the
most recent old secret is honored. Do not chain two rotations inside 24 hours.

## Delivery is at-least-once

**Boomin guarantees at-least-once delivery, never exactly-once.** The same event
can arrive at your endpoint more than once, and your handler must be built for
that. This is a property of the network, not a limitation we intend to remove:

- You return `2xx` and the response is lost on the way back. To us the attempt
  failed, so we retry — you have now processed the event twice.
- We time out at 10 seconds while your handler goes on to finish the work
  successfully. Same outcome.
- A delivery worker stalls after sending. Its claim on the delivery expires,
  another worker picks the delivery up, and sends again.

Internally each attempt holds a fenced claim on its delivery row, so two workers
never send *concurrently* and a stalled worker can never overwrite a newer
attempt's outcome. That bounds what our database accepts. It cannot bound what
your server already received — no server-side mechanism can — so the contract we
publish is the one we can actually keep.

**`event.id` is stable across every attempt of the same event.** Dedupe on it:

```js
const event = await constructEvent(payload, sigHeader, secret);

// Insert-if-absent on a unique event id — the whole pattern.
const isNew = await db.insertWebhookEvent({ id: event.id, seq: event.seq });
if (!isNew) return res.status(200).end();   // already handled; ack and stop

await handle(event);
res.status(200).end();
```

Anything you do in `handle` that is not itself idempotent — sending an email,
charging a card, incrementing a counter — belongs behind that check.

## Retries and backoff

| Property | Value |
| --- | --- |
| Delivery guarantee | **At-least-once** — dedupe on `event.id` |
| Attempts | **6** total — 1 initial + 5 retries |
| Backoff after failure *n* | 30s → 2m → 8m → 30m → 30m |
| Per-attempt timeout | 10 seconds |
| Success | Any `2xx` |
| Ordering | Deliveries are fanned out per event `seq`; retries mean order is **not** guaranteed |

Retries come from Boomin's own scheduler, not from queue redelivery, and each
attempt holds a claim on the delivery so a concurrent sweeper cannot double-send.
After the sixth failed attempt the delivery is terminal — a terminal delivery is
never re-sent, and never re-opened.

Practical consequences:

- **Answer 2xx fast.** A 10-second timeout counts as a failure. Acknowledge
  first, process asynchronously.
- **Be idempotent.** Use `event.id` as a dedupe key. A 2xx that Boomin never sees
  will be retried.
- **Do not depend on order.** Use `event.seq` — a monotonically increasing
  cursor — to order or to reconcile.

## Backfill and gaps

A new endpoint only receives events appended **at or after** its creation.
There is no history backfill.

To close a gap, read the same feed over the API and page by `seq`:

```js
for await (const event of boomin.events.list({ startingAfter: lastSeenSeq })) {
  await handle(event);
}
```

`events.list` and webhooks draw from the same append-only spine through the same
public vocabulary, so the feed is the durable recovery path for any missed
delivery.

## Event shape

```json
{
  "id": "evt_...",
  "object": "event",
  "type": "distribution.live",
  "seq": 48213,
  "subject": { "type": "distribution", "id": "..." },
  "data": { },
  "operation": "op_...",
  "livemode": true,
  "created_at": "2026-08-02T12:00:00.000Z"
}
```

The full public type vocabulary is listed on the
[`events`](/sdk/resources/events/) page. Types outside that registry are
internal and never leave your organization.
