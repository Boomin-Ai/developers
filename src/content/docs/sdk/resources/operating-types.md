---
title: operatingTypes
description: The brand's capacity vocabulary — advisor, reseller, agency — and how typed policy applies only to enrollments operating in that capacity.
---

An **operating type** answers *in what capacity is this entity participating in
this enrollment*: advisor, creator, agency, reseller — **your** words, defined
per brand. Boomin never interprets them; it uses them to **discriminate
policy**.

```js
await boomin.operatingTypes.create({ key: "advisor", name: "Advisor" });
await boomin.enrollments.update("enr_...", { operatingType: "advisor" });
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(params, options)` | `POST /operating_types` | `operating_types:write` |
| `list(params, options)` | `GET /operating_types` | `operating_types:read` |
| `retrieve(id, options)` | `GET /operating_types/{id}` | `operating_types:read` |
| `update(id, params, options)` | `POST /operating_types/{id}` | `operating_types:write` |
| `archive(id, options)` | `DELETE /operating_types/{id}` | `operating_types:write` |

`retrieve` and `update` accept the `otype_...` id **or the key itself**
(`boomin.operatingTypes.retrieve("advisor")`) — tenant vocabulary is the
ergonomic address.

## The operating type object

```json
{
  "id": "otype_...",
  "object": "operating_type",
  "key": "advisor",
  "name": "Advisor",
  "status": "active",
  "metadata": {},
  "livemode": true,
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```

## Types discriminate policy — they never run anything

A requirement, reward rule, or payout rule may carry an `operatingType`. Typed
policy applies **only** to enrollments operating in that capacity; untyped
policy (`operatingType` null) applies to everyone. That is the entire
mechanism — one filter, applied consistently by the standing evaluator and
both money rails:

```js
// Only advisors must hold the verification claim:
await boomin.programs.requirements.create("prog_...", {
  scope: "program_maintenance",
  metricKey: "assert:advisor_verified",
  operator: "exists",
  operatingType: "advisor",
});

// Only advisors earn this split:
await boomin.payouts.rules.create({
  name: "Advisor split",
  type: "revenue_split",
  rateBps: 1000,
  operatingType: "advisor",
  scope: { type: "program", program: "prog_..." },
});
```

A typed payout rule never pays an untyped enrollment; a typed requirement
never gates one. Clearing an enrollment's capacity makes typed policy stop
applying to it — and re-applying the capacity brings it back.

## Setting an enrollment's capacity

Three ways, all converging on the same column:

| Surface | Call |
| --- | --- |
| API / SDK | `boomin.enrollments.update("enr_...", { operatingType: "advisor" })` — `null` clears |
| CLI | `npx @boomin/cli enrollment set-type enr_... --type advisor` (or `--clear`) |
| [Signed Handoff](/partner-connect/signed-handoff/) | `postHandoff({ ..., operatingType: "advisor" })` — the key rides the **signed** payload; your app is the authority on capacity, so each handoff sets/refreshes it |

Setting or clearing a capacity re-evaluates standing immediately. The handoff
path is deliberately **lenient**: an unknown or archived key is skipped, never
a reason to fail a signup.

## Keys are never recycled

`(brand, key)` is fully unique — including archived rows. Archiving stops the
type from being **newly assigned** (assigning one answers
`operating_type_archived`, 409); requirements and rules that already reference
it keep their history and simply stop matching new assignments. Creating with
an archived key answers `operating_type_key_archived` (409) pointing at
reactivation:

```js
await boomin.operatingTypes.update("otype_...", { status: "active" });
```

Reactivation flips the **same row** back — the key's meaning is permanent, and
a second meaning is never minted. Display `name` changes freely; `key` never
does.

## What-if before you commit

`boomin standing test --enrollment enr_... --operating-type advisor` previews
one member's standing **as if** they operated in a capacity — including
`--operating-type null` for "what if untyped" — without touching state. See
[`programs.standingPreview`](/sdk/resources/programs/#programsstandingpreview).
