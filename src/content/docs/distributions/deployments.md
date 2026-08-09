---
title: Deployments
description: How a distribution fans out, and why each deployment owns its own attribution.
---

A **deployment** is one concrete thing running somewhere. Where a distribution
is intent, a deployment is the record of execution.

## Fan-out

Launching creates **one deployment per (program × planned slot)** — a channel
of execution, never a person. Beneath each partner-program channel, the adapter
mints **one promo link per approved partner**.

With the default plan — one referral-link slot, `enrollment_policy:
"all_approved"` — a distribution over a program with twelve approved enrollments
produces **one** deployment carrying twelve promo links.

Add a second slot and you get two deployments. Associate a second program and
you get one channel per (program × slot); a partner enrolled in both programs
gets one link on each program's channel.

```js
for await (const dep of boomin.deployments.list({ distribution: "dist_..." })) {
  console.log(dep.deploymentKey, dep.program, dep.observedStatus);
}
```

## deploymentKey

```txt
program_<program-id>:<channel>:<format>:<slot-name>
program_1f2e…:boomin:referral_link:primary
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
| `observedStatus` | What the world reports | `pending` `provisioning` `live` `paused` `pending_review` `rejected` `failed` `completed` `unknown` |

They disagree routinely, and that is not an error condition — it is the honest
representation of a system that talks to other systems. `desiredState` and
`observedState` carry the corresponding detail objects.

`unknown` means Boomin has not been able to observe the deployment recently. It
is a measurement gap, not a claim that something is wrong.

When the gap between desired and observed persists rather than converging,
`deployment.drifted` fires and reconciliation either auto-heals it or leaves it
for you.

## Attribution is per link, measurement is per channel

This is the part worth internalizing.

Each partner-program deployment carries one promo link per approved partner —
minted by the adapter, distinct from each enrollment's evergreen program
`referralCode`. The link identities land in `externalIds`:

```json
"externalIds": { "promo_link_count": 12, "codes": ["…", "…"] }
```

Conversions route by deployment and carry their **own** `enrollment` — the
`?ref=` link paths stamp which partner earned each event (see
[Performance](/distributions/performance/)). Two distributions that share the
same program credit **separately**, because each has its own channel and its
own links — and both are separate from the program's always-on referral rail.

That is the concrete difference between the two rails:

| | Evergreen program | Distribution |
| --- | --- | --- |
| Instrument | One `referralCode` per enrollment | One promo link per (partner × deployment) |
| Ownership | The enrollment | The deployment channel |
| Measurement lands in | Program metric events | Performance events (and projects into the program spine) |
| Survives the push ending | Yes, forever | The links stop when the deployment is canceled |

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

The references come back as ids: `program`, `connection` (both nullable), and
`distribution`. There is no `partnership` or `enrollment` on a deployment — a
channel names the program it runs for, never a person.

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

To move everything at once, act on the [distribution](/distributions/lifecycle/).
Pausing a [partnership](/sdk/resources/partnerships/) moves that partner's
promo links only — never the shared channel.

## Budget allocation

`budgetAllocationMinor` carries the deployment's share of a funded budget when
one has been allocated to it. It is `null` for unfunded distributions and for
deployments with no allocation. See [Budgets](/distributions/budgets/).
