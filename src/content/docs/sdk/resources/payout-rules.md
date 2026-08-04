---
title: payouts.rules
description: How a partner earns — three rule types, a discriminated scope, and economics that freeze at creation.
---

A **payout rule** is a standing promise: for this program, this kind of activity
is worth this much. It is the *earning* half of the money model; the
[rail](/sdk/resources/payout-rails/) is the *leaving* half.

```js
const rule = await boomin.payouts.rules.create({
  name: "Registration CPA",
  type: "cpa",
  scope: { type: "program", program: "prog_..." },
  metricKey: "event_registration",
  perUnitMinor: 500,
});

for await (const r of boomin.payouts.rules.list({ status: "active" })) {
  console.log(r.id, r.type, r.name);
}
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(params, options)` | `POST /payouts/rules` | `payout_rules:write` |
| `list(params, options)` | `GET /payouts/rules` | `payout_rules:read` |
| `retrieve(id, options)` | `GET /payouts/rules/{id}` | `payout_rules:read` |
| `update(id, params, options)` | `POST /payouts/rules/{id}` | `payout_rules:write` |
| `archive(id, params, options)` | `POST /payouts/rules/{id}/archive` | `payout_rules:write` |

There is no `del()`. See [archive](#archive).

## The payout rule object

```json
{
  "id": "prule_2331c58d-…",
  "object": "payout_rule",
  "name": "Registration CPA",
  "type": "cpa",
  "scope": { "type": "program", "program": "prog_457041f6-…" },
  "metric_key": "event_registration",
  "rate_bps": null,
  "per_unit_minor": 500,
  "threshold": null,
  "bonus_minor": null,
  "window_key": null,
  "window_days": null,
  "currency": "usd",
  "revenue_basis": "net",
  "status": "active",
  "created_at": "2026-08-03T06:12:08.755Z",
  "updated_at": "2026-08-03T06:12:08.755Z"
}
```

Ids are prefixed `prule_`. The SDK reads this back camelCased —
`rule.perUnitMinor`, `rule.metricKey`, `rule.createdAt`.

`revenue_basis` is server-set to `net` and is not a create parameter. It is
listed among the frozen fields because sending it to `update` is still an error
rather than a silent no-op.

## create

```js
await boomin.payouts.rules.create({
  name: "20% of tracked revenue",   // required, 1–200 chars
  type: "revenue_split",            // required
  scope: { type: "program", program: "prog_..." },  // required
  rateBps: 2000,
  currency: "usd",                  // optional, 3 letters, default "usd"
});
```

### The type decides what is required

| `type` | Required | Ignored | Formula |
| --- | --- | --- | --- |
| `revenue_split` | `rateBps` (0–10000) | `metricKey` | `floor(gmv_cents × rateBps / 10000)` for the period |
| `cpa` | `metricKey`, `perUnitMinor` | — | `count(metricKey) × perUnitMinor` for the period |
| `threshold_bonus` | `metricKey`, `threshold`, `bonusMinor` | — | `bonusMinor` if the metric reaches `threshold`, else nothing |

A missing required field is a typed 400 naming it — *"rate_bps is required for a
revenue_split rule."* — mirroring a database CHECK behind it.

`revenue_split` always measures `gmv_cents`, whatever `metricKey` says, so do
not send one.

### Optional fields

| Field | Applies to | Meaning |
| --- | --- | --- |
| `currency` | all | 3-letter code, lower-cased. Default `usd`. |
| `windowDays` | `threshold_bonus` | 1–3650. Measure the trailing window ending at `periodEnd`. Omit for the partner's **all-time** total. |
| `windowKey` | `threshold_bonus` | A label for the window, ≤ 60 chars. |

### metricKey vocabulary

`metricKey` is validated against one closed registry, mirrored by a database
CHECK:

```txt
followers        views              post_count          collab_posts
link_clicks      referral_count     gmv_cents           sales_count
product_usage_count                 channel_connected   manual_approval
event_registration                  template_install
```

Which of these a partner can actually accumulate — and how performance events
recorded against a deployment project into them — is on
[Getting partners paid](/payouts/#the-two-rails-of-activity-that-feed-a-rule).

### Money is minor units

`perUnitMinor` and `bonusMinor` are minor units of the rule's own `currency`.
The wire fields are `per_unit_minor` and `bonus_minor` — there is no `*_cents`
spelling on this resource, because the object carries a currency and "cents" is
USD-specific.

`rateBps` is basis points: `2000` = 20.00%.

## scope

A discriminated object. The polymorphic columns behind it (`applies_to`,
`scope_id`, `program_id`) never appear on the wire.

```js
{ type: "program",    program: "prog_..." }
{ type: "collection", program: "prog_...", collection: "<uuid>" }
{ type: "unit",       program: "prog_...", unit: "<uuid>" }
{ type: "member",     program: "prog_...", member: "enr_..." }
```

Rules enforced at create:

- `program` is **required on every variant**, `member` included. The evaluator
  resolves recipients through program membership and skips any rule without a
  program, so one that omitted it would be stored and never pay anyone.
- The discriminator field must match the type. `{ type: "unit" }` without `unit`
  is a 400; `{ type: "program", unit: "…" }` is a 400 saying `unit` is only
  valid when the type is `unit`.
- The program must belong to your brand, or `program_not_found` (404) with
  `param: "scope.program"`.
- `collection` and `unit` take a bare uuid — those resources have no v1 id
  prefix yet. A malformed one is a typed 400, not a 500.

Because `scope` is API-owned, the SDK converts its keys normally.

## list

| Param | Values |
| --- | --- |
| `program` | A `prog_...` id |
| `status` | `active` `paused` `archived` |
| `type` | `revenue_split` `cpa` `threshold_bonus` |
| `limit` | 1–100, default 20 |
| `startingAfter` | A `prule_...` cursor |

```js
const page = await boomin.payouts.rules.list({ program: "prog_...", status: "active" });
console.log(page.data.length, page.hasMore);
```

An unknown `status` answers `invalid_status`; an unknown `type` answers
`invalid_request` with `param: "type"`. Both list the accepted values.

## update

**`name` and `status` only.**

```js
await boomin.payouts.rules.update("prule_...", { status: "paused" });
await boomin.payouts.rules.update("prule_...", { name: "Q4 registration CPA" });
```

`status` accepts `active`, `paused`, `archived`.

Sending anything else throws `ImmutableParameterError` (code
`immutable_parameter`, HTTP 400):

```js
import { ImmutableParameterError } from "@boomin/sdk";

try {
  await boomin.payouts.rules.update("prule_...", { rateBps: 3000 });
} catch (err) {
  if (err instanceof ImmutableParameterError) {
    console.error(err.param); // "rate_bps"
  }
}
```

Frozen: `type`, `scope`, `metricKey`, `rateBps`, `perUnitMinor`, `threshold`,
`bonusMinor`, `windowKey`, `windowDays`, `currency`, `revenueBasis` — plus the
physical and legacy spellings `applies_to`, `scope_id`, `program`, `program_id`,
`per_unit_cents`, `bonus_cents`.

`err.param` names the **concept**, not the key you sent. `program_id` is
answered with `scope`, because pointing you at another immutable spelling would
be worse than useless.

:::note[Why the check runs before schema validation]
`rate_bps` is a real, correctly-spelled field of this resource. A sealed schema
that only accepted `{name, status}` would have called it *unknown* and suggested
`name` — actively misleading. The immutability pass runs first so the answer is
"this is frozen, and here is what to do instead".
:::

### Replacing a rule's economics

```js
const replacement = await boomin.payouts.rules.create({
  name: "30% of tracked revenue",
  type: "revenue_split",
  scope: { type: "program", program: "prog_..." },
  rateBps: 3000,
});
await boomin.payouts.rules.archive("prule_old");
```

The ledger then names two rules and every historical row is explicable by
exactly one of them. Both are briefly active — sequence this between runs, or
create the replacement paused and flip it as you archive, so a `revenue_split`
does not double-pay the overlap.

## archive

```js
const archived = await boomin.payouts.rules.archive("prule_...");
console.log(archived.status); // "archived"
```

The "remove this rule" verb, and deliberately not `del()`. `payouts.rule_id` is
`ON DELETE CASCADE`, so a hard delete would take every ledger row the rule ever
produced with it: the money would still have been paid and the record of why
would be gone.

Archiving stops the rule firing on the next `payouts.run` and leaves history
readable. Idempotent — archiving an archived rule returns it unchanged.

## Errors

| Code | HTTP | When |
| --- | --- | --- |
| `invalid_request` | 400 | A required economics field is missing, or `scope` is incoherent. `param` names it. |
| `immutable_parameter` | 400 | `update` touched frozen economics. → `ImmutableParameterError` |
| `program_not_found` | 404 | `scope.program` is not a program of this brand. |
| `payout_rule_not_found` | 404 | Unknown, malformed, or another tenant's rule id. |
| `payout_rules_required` | 409 | Raised by [`payouts.run`](/sdk/resources/payouts/), not here — no active rule and no active content split exists. → `PayoutRulesRequiredError` |

## From the CLI

```bash
npx @boomin/cli payout rules create --name "Rev share" --type revenue_split \
  --program prog_... --rate-bps 2000
npx @boomin/cli payout rules list --status active
npx @boomin/cli payout rules show prule_...
npx @boomin/cli payout rules update prule_... --status paused
npx @boomin/cli payout rules archive prule_...
```

Full flag table: [CLI reference](/cli/reference/#payout-rules).
