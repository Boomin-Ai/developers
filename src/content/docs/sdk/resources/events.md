---
title: events
description: The operational domain-event feed — the same spine webhooks deliver from, readable by seq.
---

**Events** is the operational feed flowing **out**: an append-only log of what
Boomin did, ordered by a monotonically increasing `seq`.

It is the same spine [webhooks](/sdk/webhooks/) deliver from, through the same
public vocabulary — which makes it the durable recovery path for any delivery
you missed.

```js
const page = await boomin.events.list({ type: "distribution.live", limit: 50 });

for await (const event of boomin.events.list({ startingAfter: lastSeenSeq })) {
  await handle(event);
}
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /events` | `events:read` |

## The event object

```json
{
  "id": "evt_...",
  "object": "event",
  "type": "distribution.live",
  "seq": 48213,
  "subject": { "type": "distribution", "id": "…" },
  "data": { },
  "operation": "op_...",
  "livemode": true,
  "createdAt": "2026-08-02T12:00:00.000Z"
}
```

The same shape a webhook delivers through `constructEvent`, so one handler
serves both paths. (Raw wire deliveries spell it `created_at`; both
`events.list` and `constructEvent` camelCase it for you.)

`operation` is the operation that caused the event, or `null`. `subject.id` is
the raw subject id.

## list

| Param | Values |
| --- | --- |
| `type` | One public event type (below). Unlisted types are `invalid_event_type` (400) |
| `limit` | 1–100, default 20 |
| `startingAfter` | A **`seq` number** or an `evt_...` id |

Events page **forward** by ascending `seq` — unlike every other list in the API,
which pages backward by creation time. That is deliberate: a feed you replay
should replay in the order it happened.

```js
// resume exactly where you left off
let cursor = await store.get("boomin_seq");
for await (const event of boomin.events.list({ startingAfter: cursor })) {
  await handle(event);
  await store.set("boomin_seq", event.seq);
}
```

## Public event vocabulary

The registry **is** the exposure boundary — types not on this list never leave
your organization, and they are not addressable as a `type` filter or as a
webhook `enabledEvents` entry.

### Distribution

`distribution.launching` · `distribution.live` · `distribution.paused` ·
`distribution.resumed` · `distribution.completed` · `distribution.failed` ·
`distribution.canceled`

### Deployment

`deployment.created` · `deployment.activated` · `deployment.rejected` ·
`deployment.paused` · `deployment.completed` · `deployment.drifted` ·
`deployment.cancel_requested` · `deployment.canceled` ·
`deployment.cleanup_failed`

### Partnership

`partnership.created` · `partnership.activated` · `partnership.paused` ·
`partnership.resumed` · `partnership.ended`

### Enrollment

`enrollment.created` · `enrollment.approved` · `enrollment.rejected` ·
`enrollment.activated`

### Payout

`payout.created` · `payout.settled` · `payout.failed`

### Operation

`operation.succeeded` · `operation.failed` · `operation.cancel_requested` ·
`operation.canceled` · `operation.superseded`

### Budget

`budget.reserved` · `budget.released` · `budget.reserve_failed`

## Feed or webhooks?

Use both, for different jobs:

| | `events.list` | Webhooks |
| --- | --- | --- |
| Latency | You poll | Push, seconds |
| History | Everything since the org existed | Only events appended at or after the endpoint was created |
| Ordering | Guaranteed by `seq` | Not guaranteed — retries reorder |
| Best for | Reconciliation, backfill, gap recovery | Reacting in real time |

The usual production shape is webhooks for reaction plus a periodic
`events.list` sweep from the last `seq` you durably stored, which closes any
delivery that exhausted its retries.
