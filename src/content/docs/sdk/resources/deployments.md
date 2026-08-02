---
title: deployments
description: Execution truth — one concrete thing running somewhere, with desired and observed state kept apart.
---

A **deployment** is execution truth. Launching a distribution fans it out into
one deployment per planned slot per eligible enrollment.

```js
const deployment = await boomin.deployments.retrieve("dep_...");

for await (const dep of boomin.deployments.list({ distribution: "dist_..." })) {
  console.log(dep.deployment_key, dep.status, dep.observed_status);
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
  "deployment_key": "enroll_<enrollment-uuid>:boomin:referral_link:primary",
  "mode": "partner",
  "medium": "referral",
  "channel": "boomin",
  "format": "referral_link",
  "adapter": "boomin_partnership",
  "status": "active",
  "observed_status": "live",
  "desired_state": {},
  "observed_state": {},
  "external_ids": { "promo_link_id": "…", "code": "…" },
  "partnership": "pship_...",
  "enrollment": "enr_...",
  "connection": null,
  "budget_allocation_minor": null,
  "error": null,
  "livemode": true,
  "activated_at": "2026-08-01T00:00:00.000Z",
  "completed_at": null,
  "last_observed_at": "2026-08-01T00:05:00.000Z",
  "created_at": "2026-08-01T00:00:00.000Z",
  "updated_at": "2026-08-01T00:05:00.000Z"
}
```

`retrieve` additionally includes a `capabilities` descriptor, honest to the
deployment's current state. `list` omits it.

## desired vs observed

A deployment keeps two answers apart, permanently:

| Field | Question | Values |
| --- | --- | --- |
| `status` | What you asked for | `active` `paused` `canceled` |
| `observed_status` | What the world reports back | `pending` `provisioning` `live` `paused` `pending_review` `rejected` `failed` `completed` `unknown` |

They disagree all the time and that is not an error — it is the gap the
reconciler exists to close. `deployment.drifted` fires when the gap is
persistent rather than transient.

## deployment_key

```txt
enroll_<enrollment-uuid>:<channel>:<format>:<slot-name>
```

Unique per distribution, and **stable**: replanning the same distribution
resolves to the same key rather than creating a duplicate. That is what makes
launch retries and resumes idempotent at the deployment level.

## Attribution

Each partner deployment owns its **own** attribution instrument, distinct from
the enrollment's evergreen program `referral_code`. The instrument ids land in
`external_ids`.

That separation is the whole point: two distributions sharing one enrollment
credit **separately**, because conversions route by `deployment_id`, not by
partner.

## list

| Param | Values |
| --- | --- |
| `distribution` | A `dist_...` id — the filter you almost always want |
| `limit` | 1–100, default 20 |
| `startingAfter` | A `dep_...` cursor |

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
instead — or the [partnership](/sdk/resources/partnerships/), which pauses that
partner's deployments across every program.
