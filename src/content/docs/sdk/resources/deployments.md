---
title: deployments
description: Execution truth — one concrete thing running somewhere, with desired and observed state kept apart.
---

A **deployment** is execution truth: one channel of execution, one per
(distribution × program × planned slot). It is never a person — the entities it
reaches are the promo links the adapter mints beneath it, one per approved
entity.

```js
const deployment = await boomin.deployments.retrieve("dep_...");

for await (const dep of boomin.deployments.list({ distribution: "dist_..." })) {
  console.log(dep.deploymentKey, dep.status, dep.observedStatus);
}
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /deployments` | `deployments:read` |
| `retrieve(id, options)` | `GET /deployments/{id}` | `deployments:read` |

## The deployment object

```json
{
  "id": "dep_...",
  "object": "deployment",
  "distribution": "dist_...",
  "deploymentKey": "program_<program-id>:boomin:referral_link:primary",
  "mode": "program",
  "medium": "referral",
  "channel": "boomin",
  "format": "referral_link",
  "adapter": "boomin_relationship",
  "status": "active",
  "observedStatus": "live",
  "desiredState": {},
  "observedState": {},
  "externalIds": { "promo_link_count": 2, "codes": ["…", "…"] },
  "program": "prog_...",
  "connection": null,
  "budgetAllocationMinor": null,
  "error": null,
  "livemode": true,
  "activatedAt": "2026-08-01T00:00:00.000Z",
  "completedAt": null,
  "lastObservedAt": "2026-08-01T00:05:00.000Z",
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:05:00.000Z"
}
```

Raw HTTP responses use the snake_case spellings (`deployment_key`,
`observed_status`); the SDK camelCases every response key. The keys **inside**
`externalIds` / `desiredState` / `observedState` are adapter-owned and pass
through verbatim.

There is no `relationship` or `enrollment` field: a deployment is a channel of
execution, so it names the **program** it runs for and never a person. The
answer to "which entity?" is "all of them, via the links" — per-entity
attribution reads off
[`PerformanceEvent.enrollment`](/sdk/resources/performance/).

`retrieve` additionally includes a `capabilities` descriptor, honest to the
deployment's current state. `list` omits it.

## desired vs observed

A deployment keeps two answers apart, permanently:

| Field | Question | Values |
| --- | --- | --- |
| `status` | What you asked for | `active` `paused` `canceled` |
| `observedStatus` | What the world reports back | `pending` `provisioning` `live` `paused` `pending_review` `rejected` `failed` `completed` `unknown` |

They disagree all the time and that is not an error — it is the gap the
reconciler exists to close. `deployment.drifted` fires when the gap is
persistent rather than transient.

## deploymentKey

```txt
program_<program-id>:<channel>:<format>:<slot-name>
```

Unique per distribution, and **stable**: replanning the same distribution
resolves to the same key rather than creating a duplicate. That is what makes
launch retries and resumes idempotent at the deployment level.

## Attribution

The channel carries one promo link per approved entity — the adapter mints
them at launch, distinct from each enrollment's evergreen program
`referralCode`. The link codes land in `externalIds` (`promo_link_count`,
`codes`).

Two distributions sharing one program still credit **separately**, because each
has its own channel and its own links. Which *entity* earned a conversion is
the event's own `enrollment` field, stamped by the `?ref=` link paths — see
[performance](/sdk/resources/performance/).

## list

| Param | Values |
| --- | --- |
| `distribution` | A `dist_...` id — the filter you almost always want |
| `program` | A `prog_...` id — every channel running for that program |
| `mode` | `owned` \| `program` \| `paid` |
| `status` | Desired status: `active` \| `paused` \| `canceled` |
| `limit` | 1–100, default 20 |
| `startingAfter` | A `dep_...` cursor |

There is no `relationship` filter — a channel names no entity, so it would
answer every query with an empty page. "This entity's channels" is `program`
plus the entity's own enrollment.

## Pausing one deployment

The SDK's deployment client is read-only in this release. The API serves the
three verbs directly, and each answers **202** with the bare deployment plus an
`operation` id alongside:

```http
POST /v1/platform/deployments/{id}/pause
POST /v1/platform/deployments/{id}/resume
POST /v1/platform/deployments/{id}/cancel
```

They require the `distributions:write` scope — mutating an execution is a
distribution-surface write, and `deployments:read` is a read-only grant by
design.

```js
// until the client method lands, call it directly
const res = await fetch("https://api.boomin.ai/v1/platform/deployments/dep_.../pause", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.BOOMIN_SECRET_KEY}`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: "{}",
});
const { operation } = await res.json();
await boomin.operations.wait(operation);
```

To pause everything at once, pause the [distribution](/sdk/resources/distributions/)
instead. Pausing a [relationship](/sdk/resources/relationships/) pauses that
entity's promo **links** across every program — never the shared channel.
