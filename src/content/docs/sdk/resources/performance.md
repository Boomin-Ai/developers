---
title: performance
description: Business measurement in, rollups out — always recorded against a deployment.
---

**Performance** is measurement: the business events that actually happened, and
the rollups over them. Events go **in** with `performance.events.create()`;
numbers come **out** with `performance.summary()`.

```js
await boomin.performance.events.create({
  deployment: "dep_...",
  type: "purchase",
  value_minor: 4999,
  currency: "usd",
  idempotency_key: "order_1001",
});

const summary = await boomin.performance.summary({ distribution: "dist_..." });
```

| Method | Route | Scope |
| --- | --- | --- |
| `events.create(params, options)` | `POST /performance/events` | `performance:write` |
| `summary(params, options)` | `GET /performance/summary` | `performance:read` |

:::note[performance ≠ events]
`performance` is *your* business measurement flowing **in**.
[`events`](/sdk/resources/events/) is Boomin's operational domain feed flowing
**out**. They are separate resources with separate scopes on purpose —
`performance:write` never implies `events:read`.
:::

## events.create

```js
const result = await boomin.performance.events.create({
  deployment: "dep_...",            // required
  type: "purchase",                 // required, ≤ 64 chars — your vocabulary
  source: "checkout",               // optional, ≤ 64 chars, default "platform_api"
  occurred_at: "2026-08-01T12:00:00Z", // optional ISO-8601 with offset; default now
  value_minor: 4999,                // optional integer
  currency: "usd",                  // optional 3-letter code
  quantity: 1,                      // optional positive integer
  idempotency_key: "order_1001",    // 8–200 chars
  external_event_id: "evt_shopify_1001", // ≤ 200 chars
  properties: { order_id: "1001" }, // optional free-form object
});
```

Everything hangs off `deployment`. You never send a partner, an enrollment, or a
program — that context is derived through the deployment, which is what keeps it
from drifting.

:::danger[One of `idempotency_key` or `external_event_id` is required]
Send neither and the call is `performance_event_identity_required` (422). This
is what makes ingestion exactly-once: `idempotency_key` is unique per
`(brand, source)`, `external_event_id` is unique per `(provider, source)`.

Use `external_event_id` when your source system already has a stable id (a
Shopify order, a Stripe charge). Use `idempotency_key` when it does not.
:::

### Response

```json
{
  "id": "perf_...",
  "object": "performance_event",
  "deployment": "dep_...",
  "distribution": "dist_...",
  "type": "purchase",
  "source": "checkout",
  "value_minor": 4999,
  "currency": "usd",
  "quantity": 1,
  "occurred_at": "2026-08-01T12:00:00.000Z",
  "received_at": "2026-08-01T12:00:01.000Z",
  "properties": { "order_id": "1001" },
  "livemode": true,
  "duplicate": false,
  "projected": true
}
```

`201` for a first ingestion, `200` with `duplicate: true` for a replay — so a
retry loop is safe and observable rather than silent.

`projected: true` means the event was also projected into the program metric
spine, where it feeds qualification and rewards.

### occurred_at matters

Reward eligibility is decided at `occurred_at`, not at ingestion. An event that
*happened* while an enrollment or partnership was paused is permanently
ineligible for reward grants even if it arrives days later. Send a truthful
`occurred_at` when you are backfilling.

## summary

```js
const summary = await boomin.performance.summary({ distribution: "dist_..." });
// or
const summary = await boomin.performance.summary({ deployment: "dep_..." });
```

```json
{
  "object": "performance.summary",
  "filters": { "distribution": "dist_...", "deployment": null },
  "events": 412,
  "value_minor": 1937600,
  "by_type": [
    { "type": "purchase", "events": 388, "value_minor": 1937600, "quantity": 402 },
    { "type": "signup", "events": 24, "value_minor": 0, "quantity": 24 }
  ]
}
```

`by_type` is ordered by event count descending. `events` and `value_minor` are
the totals across every type. Both filters are optional — with neither, you get
the brand-wide rollup.

## Where measurement lives

| Activity | Written to | Read by |
| --- | --- | --- |
| Program activity **outside** any distribution | Program metric events | Qualification, tiers, rewards |
| Distribution execution | Performance events | Deployment and distribution rollups |

Distribution execution that is program-relevant **also projects** into the
program spine, so a partner's qualification keeps accruing whether the activity
came through the evergreen rail or through a launched distribution. Nothing is
migrated between the two; the projection is permanent.
