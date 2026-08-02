---
title: Performance
description: Recording conversions against a deployment, and reading the rollups back.
---

Performance is the measurement half of a distribution: what actually happened,
recorded against a [deployment](/distributions/deployments/), and rolled up per
type, per deployment, per distribution.

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

Full parameter reference: [`performance`](/sdk/resources/performance/).

## Everything hangs off the deployment

You never send a partner, an enrollment, or a program with a performance event.
That context is derived through the deployment — which is precisely why it
cannot drift.

Given a `deployment_id`, Boomin already knows the distribution, the enrollment,
the partnership, the partner, and the program. Duplicating any of that on the
event would be a denormalization waiting to disagree with itself.

## Finding the deployment

Conversions arrive at your system with an attribution token — the code or link
id a partner shared. That id is on the deployment:

```js
for await (const dep of boomin.deployments.list({ distribution: "dist_..." })) {
  console.log(dep.external_ids); // { promo_link_id: "…", code: "…" }
}
```

Build the map from attribution token to `deployment.id` once at launch, cache
it, and refresh it on `deployment.created` / `deployment.activated`
[webhooks](/sdk/webhooks/).

## Exactly-once ingestion

One of `idempotency_key` or `external_event_id` is **required**; without either
you get `performance_event_identity_required` (422).

| Key | Unique across | Use when |
| --- | --- | --- |
| `external_event_id` | `(provider, source)` | Your source system already has a stable id — a Shopify order, a Stripe charge |
| `idempotency_key` | `(brand, source)` | It does not, and you are minting one |

A replay answers `200` with `duplicate: true` rather than `201`. Your retry loop
is safe, and it can tell.

```js
const result = await boomin.performance.events.create({ /* … */ });
if (result.duplicate) return; // already counted
```

## occurred_at is the money timestamp

Reward eligibility is resolved at the event's `occurred_at`, **not** at
ingestion time.

That matters because provider syncs arrive late. An event that *happened* while
an enrollment or partnership was paused stays permanently ineligible for reward
grants even if it lands days after the resume. Reading current status at
ingestion would retroactively pay out a paused period on unpause — so the
platform does not do that.

```js
await boomin.performance.events.create({
  deployment: "dep_...",
  type: "purchase",
  occurred_at: "2026-08-01T12:00:00Z", // when it actually happened
  external_event_id: "shopify_1001",
});
```

Send a truthful `occurred_at` whenever you backfill. It defaults to now.

## Rollups

```js
const summary = await boomin.performance.summary({ distribution: "dist_..." });
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

Filter by `distribution`, by `deployment`, or by neither for the brand-wide
rollup. `by_type` is ordered by event count descending.

To rank partners, iterate deployments and summarize each — the deployment is the
attribution unit, so a per-deployment summary *is* a per-partner-per-slot
summary:

```js
const rows = [];
for await (const dep of boomin.deployments.list({ distribution: "dist_..." })) {
  const s = await boomin.performance.summary({ deployment: dep.id });
  rows.push({ enrollment: dep.enrollment, events: s.events, value_minor: s.value_minor });
}
rows.sort((a, b) => b.value_minor - a.value_minor);
```

## Two measurement spines

| Activity | Written to | Read by |
| --- | --- | --- |
| Program activity **outside** any distribution | Program metric events | Qualification, tiers, rewards |
| Distribution execution | Performance events | Deployment and distribution rollups |

Distribution execution that is program-relevant also **projects** into the
program spine — that is what `projected: true` on the ingestion response means.
So a partner's qualification keeps accruing whether the activity came through
the evergreen referral rail or a launched distribution.

Nothing is ever migrated between the two. The projection is permanent, and the
qualification evaluator always reads the program spine.

## Type vocabulary

`type` is **yours** — up to 64 characters, no registry. `purchase`, `signup`,
`trial_started`, `booking`, whatever your business measures. It is the grouping
key in `by_type`, so keep it stable.

This is deliberately unlike the [events feed](/sdk/resources/events/), whose
type vocabulary is closed because those types are Boomin's, not yours.
