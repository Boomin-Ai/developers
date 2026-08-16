---
title: metricKeys
description: Tenant metric vocabulary — register x:-namespaced keys by API call, and know which surfaces can execute them.
---

A **metric key** names a fact stream. Boomin ships 13 built-ins
(`gmv_cents`, `referral_count`, `link_clicks`, …) — and your brand can extend
the vocabulary with **tenant keys** in the `x:` namespace, registered by API
call instead of waiting on a platform release:

```js
await boomin.metricKeys.create({
  key: "x:demo_submitted",
  displayName: "Demos submitted",
});
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(params, options)` | `POST /metric_keys` | `metric_keys:write` |
| `list(params, options)` | `GET /metric_keys` | `metric_keys:read` |
| `retrieve(id, options)` | `GET /metric_keys/{id}` | `metric_keys:read` |
| `update(id, params, options)` | `POST /metric_keys/{id}` | `metric_keys:write` |
| `archive(id, options)` | `DELETE /metric_keys/{id}` | `metric_keys:write` |

`retrieve` accepts the `mkey_...` id, the `x:` key itself, or a **built-in**
key (`boomin.metricKeys.retrieve("views")` answers a synthetic object with
`builtin: true` and `id: null`).

## The metric key object

```json
{
  "id": "mkey_...",
  "object": "metric_key",
  "key": "x:demo_submitted",
  "displayName": "Demos submitted",
  "description": null,
  "status": "active",
  "builtin": false,
  "metadata": {},
  "livemode": true
}
```

`list` carries the 13 built-ins flagged `builtin: true` alongside your
registered keys, so one call renders the brand's complete vocabulary.

## Vocabulary ≠ capability

Registering a key opens **configuration**, not everything. Each surface admits
exactly the vocabulary its rail can execute:

| Surface | Accepts | Why |
| --- | --- | --- |
| **Standing** (requirements, overrides) | built-ins ∪ active `x:` ∪ `assert:` | The evaluator executes all three |
| **Reward rules** | built-ins ∪ active `x:` | Reward sweeps run over metric events, which `x:` produces |
| **Payout rules** | **built-ins only** (v1) | `x:` is excluded from the compensable projection; an `assert:` is not an event |
| **Ingestion** | permissive | The data plane has always been key-generic |

A config call naming a key its surface cannot execute is refused with
`metric_key_invalid` (400) and the precise reason — *register it first*,
*archived, reactivate it*, or *excluded from payout in v1* — never a generic
enum error. The API never accepts an economic rule its rail cannot execute,
and the payout database CHECK agrees with the API on this boundary.

## Emitting and using a tenant key

Ingestion never required registration — the data plane accepts your events
either way, and history accumulated **before** registering is exactly what
makes a key worth registering:

```js
// 1 · Emit (via Connect events, performance ingestion, or a distribution):
await boomin.performance.events.create({
  deployment: "dep_...",
  type: "x:demo_submitted",
  idempotencyKey: "demo_881",
});

// 2 · Register, which opens config:
await boomin.metricKeys.create({ key: "x:demo_submitted" });

// 3 · Gate standing or reward on it:
await boomin.programs.requirements.create("prog_...", {
  scope: "program_maintenance",
  metricKey: "x:demo_submitted",
  operator: "gte",
  threshold: 1,
  windowDays: 30,
});
```

The standing evaluator's windowed-sum and lifetime-rollup branches are
key-generic — a registered `x:` key evaluates exactly like a built-in.

## Keys are never recycled

`(brand, key)` is fully unique, archived rows included. Once a key has emitted
history its meaning is permanent: archive means *cannot newly configure*
(existing requirements keep evaluating their history), and creating with an
archived key answers `metric_key_key_archived` (409) pointing at reactivation
— `update(id, { status: "active" })` flips the **same row** back. The `x:`
prefix also guarantees a tenant key can never collide with a future built-in.

## CLI

```bash
npx @boomin/cli metric register x:demo_submitted --display-name "Demos submitted"
npx @boomin/cli metric list
npx @boomin/cli metric archive x:demo_submitted
```

Declarative setups can carry a `metric_keys` section in a
`boomin network apply` file — see the [CLI reference](/cli/reference/).
