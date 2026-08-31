---
title: Getting entities paid
description: The money model in plain language — rules decide how a entity earns, rails decide how money leaves, batches are the lifecycle.
---

Distribution is only half the product. The other half is that the people who
distributed for you actually get paid. That half is three nouns:

| Noun | Question it answers | Scope |
| --- | --- | --- |
| [**payout rule**](/sdk/resources/payout-rules/) | How does a entity **earn**? | `payout_rules:read` / `payout_rules:write` |
| [**payout rail**](/sdk/resources/payout-rails/) | How does money physically **leave**? | `payout_rails:read` / `payout_rails:write` |
| [**payout batch**](/sdk/resources/payout-batches/) | What actually **happened**, once? | `payouts:read` / `payouts:write` |

Everything else — the ledger, `run`, `exportCsv` — sits on top of those three.

```txt
activity  →  payout rule  →  payout row  →  batch  →  rail  →  money out
             (earning)       (ledger)      (freeze)  (delivery)
```

## Before you write any code

Five behaviours account for most of the surprise on this surface. Each is
deliberate, and each has a section below.

1. **No rail is auto-created.** Exporting before you configure one is a typed
   `payout_rail_required` **409** — never a default guess. [Why](#1-no-rail-is-auto-created)
2. **A rule's economics are immutable after creation.** Only `name` and `status`
   can change. [Why](#2-rule-economics-are-immutable)
3. **Rules are archived, never deleted.** There is no `DELETE`. [Why](#3-rules-are-archived-never-deleted)
4. **`config.columns` is your data**, preserved verbatim through the SDK's casing
   boundary. [Why](#4-configcolumns-is-your-data)
5. **`payouts.run` has two distinct outcomes** — a 409 you must fix, and a
   success that says nothing qualified. [Which is which](#5-run-has-two-outcomes)

## Payout rules — how a entity earns

A rule is a standing promise: *for this program, this kind of activity is worth
this much.* Three types, and the type decides which economics are **required**:

| `type` | Required fields | Pays |
| --- | --- | --- |
| `revenue_split` | `rateBps` | `rateBps / 10000` of the period's `gmv_cents` |
| `cpa` | `metricKey`, `perUnitMinor` | `perUnitMinor` × the period's count of `metricKey` |
| `threshold_bonus` | `metricKey`, `threshold`, `bonusMinor` | `bonusMinor`, once, if the metric reaches `threshold` |

```js
await boomin.payouts.rules.create({
  name: "20% of tracked revenue",
  type: "revenue_split",
  scope: { type: "program", program: "prog_..." },
  rateBps: 2000,               // 20.00%
});

await boomin.payouts.rules.create({
  name: "Registration CPA",
  type: "cpa",
  scope: { type: "program", program: "prog_..." },
  metricKey: "event_registration",
  perUnitMinor: 500,           // $5.00
  currency: "usd",
});

await boomin.payouts.rules.create({
  name: "100 referrals bonus",
  type: "threshold_bonus",
  scope: { type: "program", program: "prog_..." },
  metricKey: "referral_count",
  threshold: 100,
  bonusMinor: 25000,           // $250.00
  windowDays: 90,
});
```

`revenue_split` always reads `gmv_cents` — it ignores `metricKey`, so do not send
one. A `threshold_bonus` with `windowDays` measures the trailing window ending at
`periodEnd`; without it, the entity's **all-time** total for that metric.

### Scope is a discriminated object

```js
{ type: "program",    program: "prog_..." }
{ type: "collection", program: "prog_...", collection: "<uuid>" }
{ type: "unit",       program: "prog_...", unit: "<uuid>" }
{ type: "member",     program: "prog_...", member: "enr_..." }
```

The wire never exposes `applies_to` / `scope_id` / `program_id` — those are
physical columns, and a public shape that let you set them independently would
let you *spell* an incoherent scope. Here you cannot: `{ type: "member" }`
without `member` is a 400 that names the field, and `{ type: "program" }`
carrying a `unit` is a 400 that says `unit` only applies when the type is `unit`.

`program` is required on **every** variant, including `member`. The evaluator
resolves recipients through program membership and begins by skipping any rule
without a program, so a rule that omitted it would be silently inert. The API
refuses to create one at all.

### Money on the wire is minor units

The wire fields are **`per_unit_minor`** and **`bonus_minor`**, never `*_cents`.
The rule carries its own `currency` (default `usd`), and "cents" is a
USD-specific word. `perUnitMinor: 500` with `currency: "usd"` is $5.00.

`rateBps` is basis points: `2000` is 20.00%, `10000` is the maximum.

## The two rails of activity that feed a rule

Boomin has two rails for getting entities working — an **evergreen program** and
a **distribution** layered on it (see [the model](/concepts/model/)). Both land
in the *same* metric vocabulary, which is why one rule can pay for both.

A performance event recorded against a deployment is projected onto the
enrolled member's metric ledger, using this mapping:

| Performance event `type` | Projected `metric_key` | Amount taken from |
| --- | --- | --- |
| `sale` / `purchase` | `gmv_cents` | `valueMinor` |
| `registration` | `event_registration` | `quantity` |
| `click` | `link_clicks` | `quantity` |
| `referral` | `referral_count` | `quantity` |
| `install` | `template_install` | `quantity` |

Any `type` that is already a metric key passes through under its own name. The
full vocabulary a rule's `metricKey` may name:

```txt
followers        views            post_count       collab_posts
link_clicks      referral_count   gmv_cents        sales_count
product_usage_count               channel_connected
manual_approval  event_registration                template_install
```

Anything else is a typed 400 at create time, and the same list is mirrored by a
database CHECK.

:::note[What this does and does not mean]
A rule scopes to a **program**, never to a distribution or a deployment. So one
rule covering a program pays on that program's evergreen activity *and* on
conversions attributed to any distribution deployment for those enrollments —
but it cannot pay them at different rates, because from the ledger's side they
are the same member's `gmv_cents`. If you need different economics per campaign,
scope separate rules to separate programs.
:::

## Payout rails — how money leaves

A rail is delivery configuration. It decides which file format is rendered,
which of your columns carry which values, and whether settlement debits the
brand wallet.

### `csv_batch` — the available rail

```js
const rail = await boomin.payouts.rails.create({
  rail: "csv_batch",
  config: {
    format: "paypal_payouts_csv",     // or "wise_batch_csv" — REQUIRED
    walletFunded: false,
    columns: [
      { key: "email",     header: "Email" },
      { key: "amount",    header: "Amount" },
      { key: "currency",  header: "Currency" },
      { key: "reference", header: "REF" },
    ],
  },
  isDefault: true,
});
```

You render a CSV, upload it to PayPal or Wise (or hand it to finance), and then
tell Boomin what happened with `confirm`. It needs no onboarding from your
entities, which is exactly why it is the rail that works today.

Valid `columns[].key` values are a closed set — `email`, `amount`,
`amount_cents`, `currency`, `reference`, `note`, `name`. An unknown key would
render as `undefined` in whatever column it named, so it is refused. The
`header` strings are yours; see [surprise 4](#4-configcolumns-is-your-data).

`walletFunded: true` turns `confirm` into a guarded brand-wallet debit per item.
Leave it `false` when the money is moving outside Boomin, which is the normal
csv_batch case.

### `stripe_connect` — configurable, not yet usable

The `stripe_connect` rail exists in the schema and the API will accept a create
call for it. **It cannot pay anyone today.** Entity disbursement over Connect
needs a transfers-only Express capability that is not yet approved on Boomin's
Stripe platform account, so:

- there is **no `disburse` route** on the Platform API. It was deliberately left
  off rather than shipped as a route that always fails.
- `payouts.connectStatus()` will report Stripe as configured while
  `entityAccountsPayoutsEnabled` stays at zero, because entities have no
  onboarding path to complete.

Configure `csv_batch` and plan around it. This page will change when the
capability is granted.

## Batches — build, export, confirm

A batch is one disbursement run, frozen. Its lifecycle is three verbs:

```js
// 1. BUILD — synchronous. Freezes eligible rows onto a batch.
const batch = await boomin.payouts.batches.create({
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
});

// 2. EXPORT — 202 + an operation. Writes the file to storage.
const accepted = await boomin.payouts.batches.export(batch.id);
await boomin.operations.wait(accepted.operation, { timeout: 120000 });

// 3. Read the batch for the download URL.
const exported = await boomin.payouts.batches.retrieve(batch.id);
console.log(exported.downloadUrl);

// 4. CONFIRM — 202 + an operation. Records what the rail actually did.
const confirmed = await boomin.payouts.batches.confirm(batch.id, {
  externalBatchRef: "PAYPAL-2026-08",
});
await boomin.operations.wait(confirmed.operation);
```

`batches.cancel(id)` unfreezes a batch that has not settled, returning its rows
to the eligible pool.

A row is eligible for a `csv_batch` when its status is `pending` **or**
`awaiting_account`, and it is not bridged to another brand's wallet. Rows
destined for a brand wallet settle on the wallet rail instead — never both.

:::note[Almost every fresh row is `awaiting_account`]
A payout row lands `pending` only when its recipient has an active,
payouts-enabled payout account — which today means a completed Stripe
onboarding, which is the thing that is gated. So expect `awaiting_account` to be
the normal status, and note that `csv_batch` batches it anyway. That is the
point of the CSV rail: it pays people who have no Boomin-side payout account.
:::

`skipped` on a build response is a **count**, not a list: eligible rows dropped
for want of a recipient handle (no email on the `csv_batch` rail; no onboarded
Stripe account on `stripe_connect`). They stay eligible for a later batch. If
*every* row is skipped, the build answers `payout_batch_empty` (409) carrying
the same count.

### `exportCsv` is build + export in one call

```js
const accepted = await boomin.payouts.exportCsv({
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
});
// { batch: "pob_...", status: "exporting", operation: "op_...", items, skipped }
```

Same 202 contract as `batches.export` — one export contract, not two. The build
half runs synchronously inside the call, so the two failures you can actually
fix (`payout_rail_required`, `payout_batch_empty`) still come back immediately
and typed instead of being discovered by polling an operation that fails.

Omit both period fields to sweep every eligible row regardless of period.

---

## The five surprises, in full

### 1. No rail is auto-created

Build or export before configuring a rail and you get:

```json
{ "error": { "code": "payout_rail_required", "param": "rail",
  "message": "No default payout rail is configured for this brand. Configure one with POST /v1/platform/payouts/rails, or name a rail explicitly." } }
```

There is no auto-provisioning, and `config.format` has no default either —
omitting it on a `csv_batch` rail is a 400.

This is not strictness for its own sake. **A CSV format is not neutral.** PayPal
Payouts and Wise batch files disagree on their column sets, and the column
mapping decides which field of a payout row lands in the column your bank reads
as "recipient". Choosing one for you would be choosing who gets paid what. The
API would rather be a 409 you fix once than a file you discover was wrong after
it cleared.

```js
import { PayoutRailRequiredError } from "@boomin/sdk";

try {
  await boomin.payouts.exportCsv({ periodStart, periodEnd });
} catch (err) {
  if (err instanceof PayoutRailRequiredError) {
    await boomin.payouts.rails.create({
      rail: "csv_batch",
      config: { format: "paypal_payouts_csv" },
      isDefault: true,
    });
  } else throw err;
}
```

A brand may have at most **one active default rail**, enforced by a database
index. Flipping `isDefault: true` on a second rail atomically clears the first.

### 2. Rule economics are immutable

After creation, only `name` and `status` can change:

```js
await boomin.payouts.rules.update("prule_...", { status: "paused" });  // fine
await boomin.payouts.rules.update("prule_...", { name: "Q4 rate" });   // fine
await boomin.payouts.rules.update("prule_...", { rateBps: 3000 });     // throws
```

```json
{ "error": { "code": "immutable_parameter", "param": "rate_bps",
  "message": "'rate_bps' cannot be changed after a payout rule is created — the payouts ledger references this rule, so editing its economics would re-interpret settled history. Create a replacement rule, activate it, then archive this one with POST /v1/platform/payouts/rules/{id}/archive." } }
```

**Why.** Every payout row in the ledger names the rule that produced it. If you
could edit that rule's rate, the same `prule_` id would describe two different
bargains and nothing in the ledger would record which one applied to which row.
Last quarter's settled payments would silently start explaining themselves at
this quarter's rate. Freezing the economics keeps every historical row
explicable by the rule it points at.

Frozen: `type`, `scope`, `metricKey`, `rateBps`, `perUnitMinor`, `threshold`,
`bonusMinor`, `windowKey`, `windowDays`, `currency`, `revenueBasis`. The
physical and legacy spellings (`applies_to`, `scope_id`, `program_id`,
`per_unit_cents`, `bonus_cents`) are recognised too, and the error names the
**concept** that is frozen rather than the word you sent — send `program_id` and
it tells you `scope` is frozen, because nudging you toward another immutable
spelling would be useless.

**To change economics, replace the rule:**

```js
const replacement = await boomin.payouts.rules.create({
  name: "30% of tracked revenue",
  type: "revenue_split",
  scope: { type: "program", program: "prog_..." },
  rateBps: 3000,
});                                              // 1. create (active by default)
await boomin.payouts.rules.archive("prule_old"); // 2. archive the old one
```

Do it in that order. Both rules are briefly active, which for a `revenue_split`
would double-pay the overlap — so sequence it between runs, or create the
replacement `status`-paused and flip it as you archive.

The ledger then names two rules and every row is explicable by exactly one.

### 3. Rules are archived, never deleted

```js
await boomin.payouts.rules.archive("prule_...");
```

```http
POST /v1/platform/payouts/rules/{id}/archive
```

There is no `DELETE` route and no `del()` method. `payouts.rule_id` is
`ON DELETE CASCADE`, so a hard delete would take every ledger row the rule ever
produced with it — the money would still have been paid, and the record of why
would be gone.

Archiving sets `status: "archived"`, which stops the rule firing on the next
run and leaves history readable. It is idempotent: archiving an archived rule
returns it unchanged. The route is named for what it actually does; a `DELETE`
verb would have promised otherwise.

### 4. `config.columns` is your data

`@boomin/sdk` speaks camelCase and converts to the wire's snake_case at the
boundary — in both directions. It makes exactly one exception, and this is it.

**Inside `config.columns`, no key and no value is ever touched.** Headers come
back byte-for-byte, in the order you sent them:

```js
await boomin.payouts.rails.create({
  rail: "csv_batch",
  config: {
    walletFunded: false,                              // → wallet_funded
    columns: [
      { key: "email",     header: "Email Address" },  // ← untouched
      { key: "amount",    header: "payoutAmount"  },  // ← untouched
      { key: "currency",  header: "Currency_Code" },  // ← untouched
      { key: "reference", header: "REF"           },  // ← untouched
    ],
  },
});
```

`walletFunded` converts to `wallet_funded` like any other field. `payoutAmount`
does **not** become `payout_amount`, because it is not a field name — it is a
column header in a file your bank ingests. A boundary that helpfully re-cased it
would change which column the bank reads, and nothing would report an error.
This is the payout surface, where a rename is a money bug rather than a cosmetic
one.

The `key` of each entry is still validated server-side against the closed slot
vocabulary, because an unknown key renders as `undefined` in whatever column it
names.

One caveat, so "byte-identical" is not over-promised: `config` is a `jsonb`
column, and Postgres normalises key order *within* each object. `{header, key}`
reads back as `{key, header}`. The array order and every name and value survive;
the two keys inside an entry may swap.

### 5. `run` has two outcomes

`payouts.run` distinguishes "you have not configured anything" from "nothing
qualified". They used to be the same silent zero.

**Nothing configured → `payout_rules_required` (409).** A configuration error,
and the only one of the two that is yours to fix:

```js
import { PayoutRulesRequiredError } from "@boomin/sdk";

try {
  await boomin.payouts.run({ periodStart: "2026-08-01", periodEnd: "2026-09-01" });
} catch (err) {
  if (err instanceof PayoutRulesRequiredError) {
    // no active rule AND no active content split on this brand
  } else throw err;
}
```

**Rules ran, nothing qualified → success.**

```json
{
  "object": "payout_run",
  "outcome": "no_eligible_activity",
  "rulesEvaluated": 3,
  "splitsEvaluated": 0,
  "eventsEvaluated": 14,
  "payoutsCreated": 0,
  "underfunded": 0,
  "awaitingAccount": 0,
  "payouts": [],
  "summary": { "totalAmountMinor": 0, "count": 0, "awaitingAccount": 0, "bridged": 0, "unresolvedRecipients": 0 }
}
```

(As the SDK returns it — raw HTTP spells these `rules_evaluated`,
`total_amount_minor`, and so on.)

Branch on `outcome` (`"payouts_created"` | `"no_eligible_activity"`), never on a
count, and never on prose — there is no `warnings[]` array by design. The
counters are always present so an empty run is explicable: three rules ran
against fourteen events and none met their terms.

In a scheduled job this matters more than it looks. `payout_rules_required`
propagates and exits non-zero, so a misconfigured brand fails loudly. A run that
found nothing exits zero, because it worked.

:::caution[`outcome` and `summary` count different things]
`outcome`, `payoutsCreated` and `awaitingAccount` describe **what this run
created**. `summary` describes **the period's ledger rows**, including ones
earlier runs created. A re-run of an already-settled period can therefore report
`"outcome": "no_eligible_activity"` beside a non-zero `summary.count`. Both are
true; they are answering different questions. Use `payoutsCreated` for "did
this run do anything".
:::

## Scopes

Payout **execution** and payout **configuration** are separate grants:

| Scope | Covers |
| --- | --- |
| `payouts:read` | The ledger, batches, `connectStatus` |
| `payouts:write` | `run`, `exportCsv`, and every batch verb |
| `payout_rules:read` | Read payout rules |
| `payout_rules:write` | Create, update, archive payout rules |
| `payout_rails:read` | Read rail configuration, including `config` |
| `payout_rails:write` | Create and update rails |

**Why rails are split out.** `payouts:write` moves money the brand already owes.
A rail's column mapping decides *which field of a payout row lands in the
recipient column* of a file a human uploads to a bank — that is closer to
banking configuration than to payout execution, and a key that runs the monthly
payout job has no business being able to redirect where the money lands. Mint
the run job a `payouts:read,payouts:write` key and keep `payout_rails:write` on
a separate, rarely-used one.

Rail `config` is deliberately absent from `payouts.connectStatus()` for the same
reason — that is a `payouts:read` surface. Read config from
`payouts.rails.list()`, which needs `payout_rails:read`.

## Next

- [`payouts.rules`](/sdk/resources/payout-rules/) — full parameter reference
- [`payouts.rails`](/sdk/resources/payout-rails/) — config, formats, defaults
- [`payouts.batches`](/sdk/resources/payout-batches/) — the batch lifecycle
- [`payouts`](/sdk/resources/payouts/) — the ledger, `run`, `exportCsv`
- [The payout ledger](/distributions/payouts/) — statuses and eligibility
- [Quickstart](/quickstart/) — the whole loop, configure to CSV on disk
