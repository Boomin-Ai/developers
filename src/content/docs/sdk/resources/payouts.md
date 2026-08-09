---
title: payouts
description: Compute the period ledger, export the operator CSV, and check disbursement readiness.
---

**Payouts** is the money-out ledger: immutable rows per partner per period,
grouped into batches by a payout rail.

```js
await boomin.payouts.run({ periodStart: "2026-08-01", periodEnd: "2026-09-01" });

const accepted = await boomin.payouts.exportCsv({
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
});
await boomin.operations.wait(accepted.operation, { timeout: 120000 });

const batch = await boomin.payouts.batches.retrieve(accepted.batch);
console.log(batch.downloadUrl);
```

Configuration lives on three nested clients, each with its own page:

| Client | Covers |
| --- | --- |
| [`payouts.rules`](/sdk/resources/payout-rules/) | How a partner **earns** |
| [`payouts.rails`](/sdk/resources/payout-rails/) | How money physically **leaves** |
| [`payouts.batches`](/sdk/resources/payout-batches/) | One frozen disbursement run |

Start with [Getting partners paid](/payouts/) for the model.

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /payouts` | `payouts:read` |
| `run(params, options)` | `POST /payouts/run` | `payouts:write` |
| `exportCsv(params, options)` | `POST /payouts/export_csv` | `payouts:write` |
| `connectStatus(params, options)` | `GET /payouts/connect_status` | `payouts:read` |

## run

```js
const result = await boomin.payouts.run({
  periodStart: "2026-08-01",   // YYYY-MM-DD, required
  periodEnd: "2026-09-01",     // YYYY-MM-DD, required
});
```

Recomputes the period's payout rows. It is an idempotent upsert: running it
twice over the same period converges rather than duplicating.

`periodStart` must be strictly before `periodEnd`, or `invalid_period` (400).

### Two outcomes, and only one is yours to fix

**Nothing configured** — no active payout rule *and* no active content split on
the brand — throws `PayoutRulesRequiredError` (`payout_rules_required`, 409). No
input could have produced a payout, so this is a configuration error rather than
an empty result.

**Rules ran, nothing qualified** — success:

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

(Raw HTTP responses spell these `rules_evaluated`, `total_amount_minor`, and so
on; the SDK camelCases every response key.)

```js
import { PayoutRulesRequiredError } from "@boomin/sdk";

try {
  const result = await boomin.payouts.run({ periodStart, periodEnd });
  if (result.outcome === "no_eligible_activity") {
    console.log(`nothing qualified — ${result.rulesEvaluated} rules over ${result.eventsEvaluated} events`);
  }
} catch (err) {
  if (err instanceof PayoutRulesRequiredError) {
    // create a rule before running again
  } else throw err;
}
```

Branch on `outcome` (`"payouts_created"` | `"no_eligible_activity"`), never on a
count and never on prose — there is no `warnings[]` by design. `underfunded` is
structurally `0`: payout compute records obligations and never draws down a
budget. The count that actually blocks money leaving is `awaitingAccount`.

:::caution[`outcome` and `summary` count different things]
`outcome`, `payoutsCreated` and `awaitingAccount` describe **this run**.
`summary` describes **the period's ledger**, including rows earlier runs
created — so a re-run can report `no_eligible_activity` beside a non-zero
`summary.count`. Use `payoutsCreated` for "did this run do anything".
:::

:::note[`run` never mutates a batched row]
Once a payout row has been pulled into a live batch, recomputation leaves it
alone. That is what makes it safe to re-run a period after you have already
exported part of it — a late conversion adds new rows without rewriting history.
:::

## exportCsv

Build **and** export in one call on the `csv_batch` rail — the commonest
operator intent, kept as one round trip. Answers **202**.

```js
const accepted = await boomin.payouts.exportCsv({
  periodStart: "2026-08-01",   // optional
  periodEnd: "2026-09-01",     // optional
});
```

```json
{
  "batch": "pob_...",
  "status": "exporting",
  "operation": "op_...",
  "items": [ … ],
  "skipped": 0
}
```

`batch` and `operation` are **id strings** — the same 202 contract
[`batches.export`](/sdk/resources/payout-batches/#export) answers. There is one
export contract, not two.

The build half runs synchronously inside the call, so the two failures you can
actually fix come back immediately and typed rather than being discovered by
polling an operation that fails:

| Throws | When |
| --- | --- |
| `PayoutRailRequiredError` | No active `csv_batch` rail. Nothing is auto-provisioned — [why](/payouts/#1-no-rail-is-auto-created). |
| `PayoutBatchEmptyError` | No settle-able row for this rail and period. |

`skipped` is a **count** of otherwise-eligible rows dropped for want of a
recipient email. They stay eligible for a later batch.

### The download URL is not here

```js
await boomin.operations.wait(accepted.operation, { timeout: 120000 });
const batch = await boomin.payouts.batches.retrieve(accepted.batch);
console.log(batch.downloadUrl);
```

The presigned URL is minted on **read** of the batch, not returned by the
mutation. One handed back here would already be expiring by the time an operator
opened it, and could not be re-obtained without re-exporting.

Omit both period fields to sweep every eligible row regardless of period.

## list

| Param | Values |
| --- | --- |
| `status` | `pending` `awaiting_account` `processing` `paid` `failed` |
| `periodStart` / `periodEnd` | `YYYY-MM-DD` exact match |
| `partner` | A `ptnr_...` id — one recipient's ledger |
| `limit` | 1–100, default 20 |
| `startingAfter` | A `po_...` cursor |

```js
for await (const payout of boomin.payouts.list({ status: "awaiting_account" })) {
  console.log(payout.id, payout.amountCents, payout.periodStart);
}
```

`awaiting_account` is the interesting bucket: money is owed, but the recipient
has no usable payout destination. Because partner Connect onboarding is not yet
available, it is also the **normal** status — and `csv_batch` batches those rows
anyway.

Filtering by `partner` also excludes every user-recipient row, since a payout
row has exactly one recipient (user XOR partner).

## connectStatus

```js
const status = await boomin.payouts.connectStatus();
```

```json
{
  "object": "payouts.connect_status",
  "rails": [
    { "id": "prail_...", "object": "payout_rail", "rail": "csv_batch", "status": "active", "isDefault": true }
  ],
  "stripe": {
    "configured": true,
    "partnerAccounts": 42,
    "partnerAccountsPayoutsEnabled": 0
  }
}
```

The disbursement-readiness read. Check it before a run rather than discovering
the gap after building a batch.

Rail entries carry identity and state **only, never `config`** — this is a
`payouts:read` surface, and a column mapping decides where money lands. Read
config from [`payouts.rails.list()`](/sdk/resources/payout-rails/), which needs
`payout_rails:read`.

:::caution[`partnerAccountsPayoutsEnabled` will read 0]
Partner disbursement over Stripe Connect needs a transfers-only Express
capability that is not yet approved on Boomin's platform account, so partners
have no onboarding path to finish. `stripe.configured` reports whether a Stripe
key is present, not whether anyone can be paid through it. There is no
`disburse` route on the Platform API. Use the `csv_batch` rail.
:::

## From the CLI

```bash
npx @boomin/cli payout run --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout export --period-start 2026-08-01 --period-end 2026-09-01 --out payouts.csv
npx @boomin/cli payout list --status awaiting_account
npx @boomin/cli payout connect
```

`payout export` polls the operation to terminal, reads the batch, and downloads
the CSV to `--out`. An operation that ends anything but `succeeded` exits
non-zero rather than leaving an empty file behind.
