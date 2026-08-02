---
title: Deployments
description: How a distribution fans out, and why each deployment owns its own attribution.
---

A **deployment** is one concrete thing running somewhere. Where a distribution
is intent, a deployment is the record of execution.

## Fan-out

Launching creates **one deployment per planned slot per eligible enrollment**.

With the default plan — one referral-link slot, `enrollment_policy:
"all_approved"` — a distribution over a program with twelve approved enrollments
produces twelve deployments.

Add a second slot and you get twenty-four. Associate a second program and the
planner **unions** approved enrollments across both; a partner enrolled in both
programs has two enrollments, so they get one deployment per enrollment, each
with its own link.

```js
for await (const dep of boomin.deployments.list({ distribution: "dist_..." })) {
  console.log(dep.deployment_key, dep.enrollment, dep.observed_status);
}
```

## deployment_key

```txt
enroll_<enrollment-uuid>:<channel>:<format>:<slot-name>
enroll_1f2e…:boomin:referral_link:primary
```

Unique per distribution and **stable across replans**. That stability is what
makes launch, resume, and reconciliation idempotent — a second pass resolves to
the same rows instead of creating shadows.

Slot names default to `primary` for the first slot, then `slot_1`, `slot_2`, and
so on.

## Desired vs observed

Every deployment keeps two answers apart, permanently:

| Field | Question | Values |
| --- | --- | --- |
| `status` | What you asked for | `active` `paused` `canceled` |
| `observed_status` | What the world reports | `pending` `provisioning` `live` `paused` `pending_review` `rejected` `failed` `completed` `unknown` |

They disagree routinely, and that is not an error condition — it is the honest
representation of a system that talks to other systems. `desired_state` and
`observed_state` carry the corresponding detail objects.

`unknown` means Boomin has not been able to observe the deployment recently. It
is a measurement gap, not a claim that something is wrong.

When the gap between desired and observed persists rather than converging,
`deployment.drifted` fires and reconciliation either auto-heals it or leaves it
for you.

## Attribution is per deployment

This is the part worth internalizing.

Each partner deployment owns its **own** attribution instrument, distinct from
the enrollment's evergreen program `referral_code`. The instrument ids land in
`external_ids`:

```json
"external_ids": { "promo_link_id": "…", "code": "…" }
```

Because conversions route by `deployment_id`, two distributions that share the
same enrollment credit **separately** — and both are separate from the
program's always-on referral rail.

That is the concrete difference between the two rails:

| | Evergreen program | Distribution |
| --- | --- | --- |
| Instrument | One `referral_code` per enrollment | One instrument per deployment |
| Ownership | The enrollment | The deployment |
| Measurement lands in | Program metric events | Performance events (and projects into the program spine) |
| Survives the push ending | Yes, forever | The instrument stops when the deployment is canceled |

A partner in your ambassador program who also joins the spring launch has one
evergreen code plus one launch-specific link, and you can tell exactly which
drove which sale.

## Reading a deployment

```js
const dep = await boomin.deployments.retrieve("dep_...");
console.log(dep.capabilities); // present on retrieve only
```

`retrieve` includes a `capabilities` descriptor honest to the deployment's
current state — what the resolved adapter can actually do with this deployment
right now, not what it could do in principle.

The relationship links come back as ids: `partnership`, `enrollment`,
`connection` (nullable), and `distribution`.

## Controlling one deployment

The SDK's deployment client is read-only in this release. The API serves the
verbs, each answering **202** with the bare deployment plus an `operation` id:

```http
POST /v1/platform/deployments/{id}/pause
POST /v1/platform/deployments/{id}/resume
POST /v1/platform/deployments/{id}/cancel
```

They require `distributions:write` — mutating an execution is a
distribution-surface write, and `deployments:read` is a read-only grant by
design.

To move everything at once, act on the [distribution](/distributions/lifecycle/)
or the [partnership](/sdk/resources/partnerships/) instead.

## Budget allocation

`budget_allocation_minor` carries the deployment's share of a funded budget when
one has been allocated to it. It is `null` for unfunded distributions and for
deployments with no allocation. See [Budgets](/distributions/budgets/).
