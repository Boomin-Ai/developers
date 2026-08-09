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
  enrollment: "enr_...", // which partner earned it — omit for unattributed measurement
  type: "purchase",
  valueMinor: 4999,
  currency: "usd",
  externalEventId: "order_1001",
});

const summary = await boomin.performance.summary({ distribution: "dist_..." });
```

Full parameter reference: [`performance`](/sdk/resources/performance/).

## Everything hangs off the deployment

The `deployment` names the channel, and from it Boomin derives the distribution
and the program — you never send those, which is precisely why they cannot
drift.

**Which partner earned the event is the event's own `enrollment` field.** A
deployment is a shared channel and names no partner, so the event carries its
own attribution: the `?ref=` link paths stamp `enrollment` themselves, and a
first-party integration recording its own conversions passes it explicitly.
Omit it for genuinely unattributed measurement (owned/paid channels).

## Finding the deployment

Conversions arrive at your system with an attribution token — the code a
partner shared. The codes minted for a channel's partners are listed on the
deployment:

```js
for await (const dep of boomin.deployments.list({ distribution: "dist_..." })) {
  console.log(dep.externalIds); // { promo_link_count: 12, codes: ["…", "…"] }
}
```

Build the map from attribution token to `(deployment, enrollment)` once at
launch, cache it, and refresh it on `deployment.created` /
`deployment.activated` [webhooks](/sdk/webhooks/).

## Exactly-once ingestion

One of `idempotencyKey` or `externalEventId` is **required**; without either
you get `performance_event_identity_required` (422). (Raw HTTP bodies spell
them `idempotency_key` / `external_event_id`.)

| Key | Unique across | Use when |
| --- | --- | --- |
| `externalEventId` | `(provider, source)` | Your source system already has a stable id — a Shopify order, a Stripe charge |
| `idempotencyKey` | `(brand, source)` | It does not, and you are minting one |

A replay answers `200` with `duplicate: true` rather than `201`. Your retry loop
is safe, and it can tell.

```js
const result = await boomin.performance.events.create({ /* … */ });
if (result.duplicate) return; // already counted
```

## occurredAt is the money timestamp

Reward eligibility is resolved at the event's `occurredAt`, **not** at
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
  occurredAt: "2026-08-01T12:00:00Z", // when it actually happened
  externalEventId: "shopify_1001",
});
```

Send a truthful `occurredAt` whenever you backfill. It defaults to now.

## Rollups

```js
const summary = await boomin.performance.summary({ distribution: "dist_..." });
```

```json
{
  "object": "performance.summary",
  "filters": { "distribution": "dist_...", "deployment": null },
  "events": 412,
  "valueMinor": 1937600,
  "byType": [
    { "type": "purchase", "events": 388, "valueMinor": 1937600, "quantity": 402 },
    { "type": "signup", "events": 24, "valueMinor": 0, "quantity": 24 }
  ]
}
```

Filter by `distribution`, by `deployment`, or by neither for the brand-wide
rollup. `byType` is ordered by event count descending.

To compare channels, iterate deployments and summarize each — the deployment is
the channel, so a per-deployment summary is a per-channel (per program × slot)
rollup:

```js
const rows = [];
for await (const dep of boomin.deployments.list({ distribution: "dist_..." })) {
  const s = await boomin.performance.summary({ deployment: dep.id });
  rows.push({ deploymentKey: dep.deploymentKey, events: s.events, valueMinor: s.valueMinor });
}
rows.sort((a, b) => b.valueMinor - a.valueMinor);
```

A channel summary never splits by partner — per-partner attribution is each
event's `enrollment`. To rank partners, keep your own tally keyed on the
`enrollment` you ingest (or that the `?ref=` paths stamp); there is no
per-enrollment rollup endpoint in this release.

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
