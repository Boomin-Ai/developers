---
title: operations
description: The progress surface for every async mutation — retrieve, list, and wait.
---

Every external mutation that does real work returns an **operation**. Launch,
pause, resume, cancel: none of them are synchronous, and none of them pretend to
be.

An operation is never "the response you were waiting for". It is the handle you
poll.

```js
const accepted = await boomin.distributions.launch("dist_...");
const operation = await boomin.operations.wait(accepted.operation, {
  timeout: 120000,
  pollInterval: 2000,
});
console.log(operation.status);
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /operations` | `operations:read` |
| `retrieve(id, options)` | `GET /operations/{id}` | `operations:read` |
| `wait(id, options)` | (polls `retrieve`) | `operations:read` |

`operations:read` is granted to **every** valid token implicitly, so any key can
poll the operations it caused. You never have to widen a key just to find out
whether its own launch worked.

## The operation object

```json
{
  "id": "op_...",
  "object": "operation",
  "subject": { "type": "distribution", "id": "…" },
  "kind": "distribution.launch",
  "status": "succeeded",
  "waiting_reason": null,
  "attempts": 1,
  "max_attempts": 5,
  "error": null,
  "result": { },
  "progress": { },
  "target_operation_id": null,
  "livemode": true,
  "created_at": "2026-08-01T00:00:00.000Z",
  "completed_at": "2026-08-01T00:00:12.000Z"
}
```

`target_operation_id` is set on a cancel: it points at the operation being
superseded.

## Status

| Status | Terminal | Meaning |
| --- | --- | --- |
| `pending` | | Enqueued, not claimed |
| `running` | | A worker holds the lease |
| `waiting` | | Blocked on something nameable — see `waiting_reason` |
| `succeeded` | ✓ | Everything the operation set out to do happened |
| `partial` | ✓ | Some children succeeded, some did not |
| `failed` | ✓ | Nothing usable came out of it |
| `canceled` | ✓ | Superseded or explicitly canceled |

`partial` is a real outcome, not a transient state. A launch that brought up
nine of twelve deployments is `partial`, and the distribution is
`partially_active`. Treat it as "look at the deployments", not as a failure.

## waiting_reason

`waiting` always carries a reason — a null reason is structurally impossible.

| Reason | Meaning | Clears when |
| --- | --- | --- |
| `funding_required` | A funded budget outran the brand wallet | The wallet is topped up |
| `provider_review` | An external provider is reviewing | The provider decides |
| `awaiting_target_settle` | A cancel is waiting for the running operation it targets | The target settles |
| `awaiting_children_settle` | Waiting on fan-out children | The last child settles |
| `awaiting_cleanup` | Waiting on adapter teardown | Cleanup settles |

A `waiting` operation is alive. It is woken by domain events when its blocker
settles, with a cron poller as the universal backstop — so it will not sit
stranded even if a wake is missed. Relaunching while a launch waits on funding
**reuses** the waiting operation rather than enqueueing a second one.

## wait

```js
const operation = await boomin.operations.wait(operationId, {
  timeout: 120000,     // ms, default 60000
  pollInterval: 1000,  // ms, default 1000
});
```

Two things to know:

1. **It resolves on any terminal status.** `succeeded`, `partial`, `failed`, and
   `canceled` all resolve — inspect `operation.status` yourself. `wait()` does
   **not** throw on a failed operation.
2. **It throws only on timeout**, as a `BoominError` with code
   `operation_wait_timeout`. The operation is still running; poll again with a
   longer budget.

```js
const operation = await boomin.operations.wait(id, { timeout: 120000 });
switch (operation.status) {
  case "succeeded": break;
  case "partial":   await inspectDeployments(); break;
  case "failed":    console.error(operation.error); break;
  case "canceled":  break;
}
```

`wait` also accepts the standard per-call `RequestOptions` (`brand`, `timeout`
per HTTP request via the client, `maxRetries`) alongside its own two.

## list

| Param | Values |
| --- | --- |
| `subjectType` | e.g. `distribution`, `deployment` |
| `subjectId` | A prefixed id (`dist_...`) or a bare uuid |
| `status` | Any status above; anything else is `invalid_status` (400) |
| `limit` | 1–100, default 20 |
| `startingAfter` | An `op_...` cursor |

```js
// what is currently in flight for this distribution?
const { data } = await boomin.operations.list({
  subjectId: "dist_...",
  status: "running",
});
```

## One live operation per subject

A subject can hold **one** live mutation at a time. A second launch, resume, or
apply while one is live raises `operation_conflict` (409) — poll the live one
instead of enqueueing a rival.

Cancel runs on a separate control plane, so a cancel can coexist with the launch
it is cancelling. That is the only cross-plane exception, and it is why
`cancel()` works on a distribution that is mid-launch.
