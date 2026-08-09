---
title: Lifecycle & launching
description: Every status transition a distribution can make, and what each verb actually does.
---

A distribution's `status` is a **rollup of what its deployments are doing**, not
a workflow you drive by hand. You issue verbs; the status follows.

## The transition table

Anything not listed here is invalid and answers a typed 409.

| From | To | Caused by |
| --- | --- | --- |
| `draft` | `validating` | `validate()` |
| `validating` | `ready` | Checks pass |
| `validating` | `draft` | Checks fail (issues land in `error`) |
| `draft` \| `ready` | `draft` | `update()` — any edit invalidates validation |
| `ready` | `launching` | `launch()` → 202 + operation |
| `launching` | `active` | All deployments live |
| `launching` | `partially_active` | Some deployments live |
| `launching` | `failed` | **Zero** deployments live at terminal launch |
| `launching` | `canceled` | `cancel()` supersedes the live launch |
| `active` \| `partially_active` | `paused` | `pause()` |
| `paused` | `launching` | `resume()` — re-applies desired state |
| `active` \| `partially_active` | `completed` | All deployments terminal, or explicit completion |
| `draft` \| `ready` \| `active` \| `partially_active` \| `paused` | `canceled` | `cancel()` |

There is no `canceling` status. The distribution carries the *requested*
lifecycle; operations expose async progress. Asking a resource to be two things
at once is how state machines rot.

## validate

```js
const result = await boomin.distributions.validate(distribution.id);
if (!result.valid) {
  console.error(result.errors);
  // [{ code: "channel_type_not_yet_supported", slot: "primary", message: "…" }]
}
```

Validation is **synchronous** in v1 — the transient `validating` state never
persists, so you will not observe it. The response is the bare distribution plus
`valid` and `errors`.

| Error `code` | Meaning |
| --- | --- |
| `program_required` | `enrollment_policy: "all_approved"` with no associated program |
| `budget_incomplete` | `mode: "funded"` without an asset and a positive total |
| `slot_incomplete` | A slot is missing `medium`, `channel`, or `format` |
| `channel_type_not_yet_supported` | No registered adapter supports that slot |

Slot-level issues carry a `slot` field naming the offending slot.

Validation is where unsupported channels fail. It is cheap, it creates nothing,
and it is idempotent — validate as often as you like.

## update invalidates validation

```js
await boomin.distributions.update(id, { name: "Spring launch v2" });
// status is back to "draft" — re-validate before launching
```

Editing is allowed in `draft` and `ready` only. Any successful update returns
the status to `draft`. Program associations are **draft-only**
(`distribution_programs_draft_only`).

This is deliberate: there is no `revise()` verb, because a revision that did not
force re-validation would let a stale `ready` launch a changed plan.

## launch

```js
const accepted = await boomin.distributions.launch(distribution.id);
// 202 { distribution: "dist_...", status: "launching", operation: "op_..." }

const operation = await boomin.operations.wait(accepted.operation, { timeout: 120000 });
```

Launch requires `ready`. Anything else is `distribution_not_ready` (409).

What launch does, in order:

1. Takes the subject's mutation slot — one live mutation per distribution.
2. If the budget is `funded`, reserves the total from the brand wallet.
3. Creates one deployment per (program × planned slot) — a channel, never a
   person — keyed by a stable `deploymentKey`.
4. Asks the resolved adapter to bring each channel up; the adapter mints one
   promo link per approved enrollment, unioned across the associated programs.
5. Rolls the outcome up into the distribution's status.

Because the keys are stable, a relaunch resolves to the same deployments rather
than duplicating them.

:::note[Launching twice is safe]
Calling `launch` again while one is in flight reuses the live operation. If the
launch is parked on `funding_required`, relaunching **reuses the waiting
operation** — it never enqueues a second one.
:::

### partially_active is a real outcome

A launch where nine of twelve deployments came up is `partial` on the operation
and `partially_active` on the distribution. That is not a failure to retry
blindly — list the deployments, read each `observedStatus` and `error`, and fix
the ones that need fixing.

`failed` means **zero** deployments reached live. Status describes the usable
execution outcome, never side-effect bookkeeping: if the adapter created
something externally before failing, it stays visible through the deployment's
`observedStatus` and `externalIds` for reconciliation and cleanup.

## pause and resume

```js
const paused = await boomin.distributions.pause(id);   // 202 + operation
const resumed = await boomin.distributions.resume(id); // 202 + operation
```

`pause()` requires `active` or `partially_active`; `resume()` requires `paused`.
Both answer the bare distribution plus an `operation` id alongside.

`resume()` puts the distribution back through `launching` — it re-applies
desired state across the deployments and lands on `active` or
`partially_active` by rollup. That is why resume is not instantaneous.

Three different pauses exist, at three different blast radii:

| Verb | Stops |
| --- | --- |
| `deployments` pause (API) | One channel |
| `distributions.pause` | Every deployment in this distribution |
| `partnerships.pause` | That partner's promo **links** across every program — never the shared channel |

In all three, links keep resolving and attribution continues. What stops is
reward eligibility — decided at the event's `occurredAt`, so a late-arriving
conversion for a paused period stays ineligible.

## cancel

```js
await boomin.distributions.cancel(id);
```

Terminal, and legal from `draft`, `ready`, `active`, `partially_active`, and
`paused` — including **mid-launch**, because cancel runs on a separate control
plane from mutations.

Cancel, in order:

1. Supersedes the live launch operation if there is one.
2. Stops new deployment creation.
3. Sets every deployment to `status: "canceled"` (desired).
4. Runs adapter cleanup of anything already created.
5. Releases the **unconsumed** budget remainder only — consumed budget stays
   consumed.
6. Preserves `externalIds`, observed state, and any cleanup failures.

### Cancel is idempotent

Calling `cancel()` again while a cancel is live returns the **existing** control
operation rather than erroring. That makes a retrying client safe.

### When cancel fails

If a cancel fails — or lands `partial` with unresolved teardown — the subject's
control gate stays closed **by design**. Further mutations and further cancels
raise `cancellation_requires_intervention` (409) carrying the failed operation
id.

That is fail-closed, not stuck: an operator retry replaces the failed control
operation with a fresh one and completes the teardown. Fail-closed with a
recovery command beats fail-open with a corrupted distribution.

While an ordinary cancel is in flight, competing mutations get
`cancellation_in_progress` (409). Wait for it to settle.

## One live mutation per subject

A distribution holds one live mutation at a time. A second `launch`, `resume`,
or `pause` while one is live raises `operation_conflict` (409).

```js
try {
  await boomin.distributions.launch(id);
} catch (err) {
  if (err instanceof OperationConflictError) {
    const { data } = await boomin.operations.list({ subjectId: id, status: "running" });
    await boomin.operations.wait(data[0].id);
  }
}
```

Cancel is exempt — it runs on the control plane, which is exactly why you can
cancel a launch that is still running.

## Watching a launch

Three ways, in increasing order of production-readiness:

```js
// 1. Poll the operation
const operation = await boomin.operations.wait(accepted.operation, { timeout: 120000 });

// 2. Read the rollup
const dist = await boomin.distributions.retrieve(accepted.distribution);
console.log(dist.status, dist.deployments); // "active" { total: 12, live: 12 }

// 3. Subscribe
await boomin.webhooks.endpoints.create({
  url: "https://your-app.com/webhooks/boomin",
  enabledEvents: [
    "distribution.launching", "distribution.live",
    "distribution.failed", "distribution.canceled",
    "deployment.activated", "deployment.rejected", "deployment.drifted",
  ],
});
```
