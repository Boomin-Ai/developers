---
title: distributions
description: Create, validate, launch, pause, resume, and cancel the intent object.
---

A **distribution** is intent: a coordinated business objective that fans out
into [deployments](/sdk/resources/deployments/). It is Boomin's `PaymentIntent`.
It never says "post to Instagram" — it says what outcome you want and which
programs supply eligible partners.

```js
const distribution = await boomin.distributions.create({
  name: "Spring launch",
  objective: "launch",
  programs: ["prog_..."],
  budget: { mode: "funded", asset: "credit", total: 50000 },
});
await boomin.distributions.validate(distribution.id);
const { operation } = await boomin.distributions.launch(distribution.id);
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(params, options)` | `POST /distributions` | `distributions:write` |
| `list(params, options)` | `GET /distributions` | `distributions:read` |
| `retrieve(id, options)` | `GET /distributions/{id}` | `distributions:read` |
| `update(id, params, options)` | `POST /distributions/{id}` | `distributions:write` |
| `validate(id, params, options)` | `POST /distributions/{id}/validate` | `distributions:write` |
| `launch(id, params, options)` | `POST /distributions/{id}/launch` | `distributions:launch` |
| `pause(id, params, options)` | `POST /distributions/{id}/pause` | `distributions:write` |
| `resume(id, params, options)` | `POST /distributions/{id}/resume` | `distributions:write` |
| `cancel(id, params, options)` | `POST /distributions/{id}/cancel` | `distributions:write` |

`distributions:launch` is deliberately a separate scope from
`distributions:write`: spending money is not the same permission as editing a
draft.

## The distribution object

```json
{
  "id": "dist_...",
  "object": "distribution",
  "name": "Spring launch",
  "objective": "launch",
  "description": null,
  "status": "active",
  "spec": { "plan": { "partner": { "slots": [ ... ] } } },
  "planHash": "…",
  "programs": ["prog_..."],
  "budget": { "mode": "funded", "asset": "credit", "total": 50000, "consumed": 12000, "released": 0 },
  "deployments": { "total": 2, "live": 2 },
  "stats": {},
  "error": null,
  "livemode": true,
  "launchedAt": "2026-08-01T00:00:00.000Z",
  "pausedAt": null,
  "completedAt": null,
  "canceledAt": null,
  "failedAt": null,
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```

Raw HTTP responses use the snake_case spellings (`plan_hash`, `launched_at`);
the SDK camelCases every response key. The keys inside `spec` and `stats` are
yours and pass through verbatim.

`deployments` is a rollup, present on `retrieve` and `list` only. `budget.total`
is in **minor units** of `budget.asset`; `consumed` and `released` come off the
live reservation.

There is no `kind` column and no `program` column. A distribution is not a
campaign, not a channel, and not a post.

## create

```js
const distribution = await boomin.distributions.create({
  name: "Spring launch",              // required, ≤ 200 chars
  objective: "launch",                // optional, ≤ 64 chars
  description: "Q3 drop",             // optional
  programs: ["prog_..."],             // up to 20
  subjects: [{ kind: "event", id: "<uuid>", role: "primary" }], // up to 20
  budget: { mode: "funded", asset: "credit", total: 50000 },
  spec: { /* the deployment plan — see below */ },
});
// distribution.status === "draft"
```

`create` **always** returns a `draft`.

`objective` is open text. The suggested set is `awareness`, `acquisition`,
`launch`, `conversion`, `retention`, `event_promotion`, `custom`.

`subjects` are descriptive context — an event, offer, or resource the
distribution is about. They are validated for existence and brand access, and
they **never** constrain execution: no deployment is created from a subject, and
no link is owned by one. They are also excluded from `plan_hash`.

### budget

```js
budget: { mode: "funded", asset: "credit", total: 50000 }
```

| `mode` | Meaning |
| --- | --- |
| `none` | No budget (the default when `budget` is omitted) |
| `metered` | Spend is recorded but nothing is reserved up front |
| `funded` | A reservation is taken from the brand wallet at launch |

`asset` is `credit` or `usd`; `total` is minor units. See
[Budgets](/distributions/budgets/).

### spec

The deployment plan. Omit it entirely and you get the default: one
partner-program referral-link slot — a single channel per associated program,
whose adapter mints one promo link per approved enrollment.

```js
spec: {
  plan: {
    partner: {
      enrollment_policy: "all_approved",
      slots: [
        { name: "primary", medium: "referral", channel: "boomin", format: "referral_link" },
      ],
    },
  },
}
```

Slots default to `name: "primary"` (then `slot_1`, `slot_2`, …), and an omitted
`plan.partner.slots` yields exactly the slot above. `enrollment_policy` defaults
to `all_approved`.

Only combinations a registered adapter supports will validate. In this release
that is exactly one: `partner_program` / `referral` / `boomin` / `referral_link`.

## update

```js
await boomin.distributions.update(distribution.id, { name: "Spring launch v2" });
```

Allowed in `draft` and `ready` only — outside those it is
`distribution_not_editable` (409). **Any** update invalidates validation and
returns the status to `draft`; re-run `validate()`. Program associations may
only change in `draft` (`distribution_programs_draft_only`).

There is no `revise()` verb. `update()` plus automatic invalidation *is* the
revision path.

## validate

```js
const result = await boomin.distributions.validate(distribution.id);
if (!result.valid) console.error(result.errors);
// result.status === "ready" when valid, back to "draft" when not
```

Validation is **synchronous** in v1 — no operation, no polling. The response is
the bare distribution plus `valid` and `errors` alongside.

| Error `code` | Raised when |
| --- | --- |
| `program_required` | `enrollment_policy: "all_approved"` with no associated program |
| `budget_incomplete` | `mode: "funded"` without an asset and a positive total |
| `slot_incomplete` | A slot is missing `medium`, `channel`, or `format` (carries `slot`) |
| `channel_type_not_yet_supported` | No registered adapter supports that slot (carries `slot`) |

This is the point at which unsupported channels fail — up front, cheaply,
before anything is created.

## launch

```js
const accepted = await boomin.distributions.launch(distribution.id);
// { distribution: "dist_...", status: "launching", operation: "op_..." }

const operation = await boomin.operations.wait(accepted.operation, { timeout: 120000 });
```

`launch` answers **202** with three **id strings** — never a synchronous
success, never an embedded object. The
[operation](/sdk/resources/operations/) is the progress surface.

Launch requires `status: "ready"`; anything else is `distribution_not_ready`
(409). Calling `launch` again on a distribution already `launching` is
accepted — it reuses the live operation rather than starting a second one.

A funded launch that outruns the wallet parks the operation at
`status: "waiting"`, `waitingReason: "funding_required"`. It is not dead — top
up and it proceeds.

## pause, resume, cancel

```js
const paused = await boomin.distributions.pause(distribution.id);
console.log(paused.status, paused.operation);
// "paused"  "op_..."
```

All three answer **202** with the bare distribution **plus** an `operation` id
alongside. Poll the operation for the real outcome.

- `pause()` requires `active` or `partially_active`.
- `resume()` requires `paused`, and lands back on `active` or
  `partially_active` by rollup.
- `cancel()` is terminal: it supersedes a live launch, stops new deployment
  creation, sets deployments to `desired: canceled`, runs adapter cleanup, and
  releases the **unconsumed** budget remainder only.

Repeating `cancel()` on a distribution that already has a live cancel is
idempotent — it returns the existing control operation instead of erroring. If a
previous cancel failed with unresolved teardown, the gate stays closed by design
and further mutations raise `cancellation_requires_intervention`. See
[Errors](/sdk/errors/).

## Status

```txt
draft → validating → ready → launching → active | partially_active
                                       ↘ failed
active | partially_active → paused → launching → …
active | partially_active → completed
draft | ready | active | partially_active | paused → canceled
```

`launching → failed` means **zero** deployments reached live — status is a
usable execution outcome, never side-effect bookkeeping. Provider-side leftovers
stay visible through each deployment's `observedStatus` and `externalIds`.

Full detail: [Lifecycle & launching](/distributions/lifecycle/).

## list

| Param | Values |
| --- | --- |
| `status` | Any distribution status |
| `limit` | 1–100, default 20 |
| `startingAfter` | A `dist_...` cursor |
