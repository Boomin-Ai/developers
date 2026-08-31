---
title: The payout ledger
description: From measured value to money out — the ledger, statuses, eligibility, and the CSV rail.
---

Payouts are the last leg: measured performance becomes reward grants, grants
become immutable ledger rows, and rows are batched onto a rail that actually
moves money.

This page is the **ledger**. For the money model — how a entity earns, how
money leaves, and what to configure first — start at
[Getting entities paid](/payouts/).

## The chain

```txt
performance event  →  reward grant  →  payout row  →  batch  →  rail
```

Each arrow is guarded. A grant claims budget exactly once; a payout row is
immutable once written; a row lives in at most one live batch.

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

Full parameter reference: [`payouts`](/sdk/resources/payouts/).

## run

```js
const result = await boomin.payouts.run({
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
});
console.log(result.outcome, result.payoutsCreated);
```

Recomputes the period's rows. Idempotent — running it twice over the same period
converges instead of duplicating.

`periodStart` must be strictly before `periodEnd`, or `invalid_period` (400).
Both are `YYYY-MM-DD`.

A brand with **no active payout rule and no active content split** throws
`PayoutRulesRequiredError` (409) instead of answering zero; a brand that is
configured but had a quiet month succeeds with
`outcome: "no_eligible_activity"`. The two used to be the same silent zero —
[the distinction](/payouts/#5-run-has-two-outcomes).

:::note[Re-running never disturbs a batched row]
Once a row has been pulled into a live batch, recomputation leaves it alone. So
it is safe to re-run a period you have already partly exported — a late-arriving
conversion adds new rows without rewriting history.
:::

## Statuses

| Status | Meaning |
| --- | --- |
| `pending` | Owed, ready to batch |
| `awaiting_account` | Owed, but the recipient has no usable payout destination |
| `processing` | On a rail, in flight |
| `paid` | Settled |
| `failed` | The rail rejected it |

```js
for await (const payout of boomin.payouts.list({ status: "awaiting_account" })) {
  console.log(payout.id, payout.amountCents);
}
```

A row lands `pending` only when its recipient already has an active,
payouts-enabled payout account. Since entity Connect onboarding is not yet
available, **`awaiting_account` is the normal status** — money is owed and
nothing is wrong except that nobody told you where to send it. The `csv_batch`
rail batches those rows anyway, which is exactly what it is for.

## Eligibility

A row is eligible for a batch when its status is `pending` or
`awaiting_account` **and** it is not brand-bridged. Rows destined for another
brand's wallet settle on the wallet rail instead — never both, never twice.

A `stripe_connect` batch takes `pending` rows only.

## The csv_batch rail

`exportCsv` is the zero-onboarding disbursement path, and it does two things in
one call: builds a `csv_batch` over the eligible rows, then requests the export.
It answers **202** with id strings and an operation:

```json
{
  "batch": "pob_...",
  "status": "exporting",
  "operation": "op_...",
  "items": [ … ],
  "skipped": 0
}
```

`skipped` is a **count** of otherwise-eligible rows dropped for want of a
recipient email — they stay eligible for a later batch. If every row is skipped,
the call answers `payout_batch_empty` (409).

The download URL is **not** in this response. Poll the operation, then read the
batch — the presigned URL is re-minted on every read rather than expiring inside
a stored response body.

:::caution[Configure a rail first]
There is no auto-provisioning. Exporting before configuring a rail is a typed
`payout_rail_required` (409), because a CSV format is not neutral: PayPal and
Wise disagree on their column sets, and the mapping decides what your bank
reads. See [payouts.rails](/sdk/resources/payout-rails/).
:::

You pay the CSV out of band, then
[confirm](/sdk/resources/payout-batches/#confirm) to record what the rail
actually did.

Omit both period fields to sweep every eligible row regardless of period.

## Readiness

```js
const status = await boomin.payouts.connectStatus();
```

```json
{
  "object": "payouts.connect_status",
  "rails": [ { "rail": "csv_batch", "status": "active", "isDefault": true } ],
  "stripe": {
    "configured": true,
    "entityAccounts": 42,
    "entityAccountsPayoutsEnabled": 0
  }
}
```

Check this **before** a run rather than discovering the gap after a build. Rail
entries carry identity and state only — never `config`, which is a
`payout_rails:read` surface.

:::caution[The stripe_connect rail cannot pay anyone yet]
Entity disbursement over Connect needs a transfers-only Express capability that
is not yet approved on Boomin's Stripe platform account. Entities have no
onboarding path to complete, `entityAccountsPayoutsEnabled` stays at zero,
and there is deliberately **no `disburse` route** on the Platform API — an
absent route beats one that always fails. Use `csv_batch`.
:::

## Batches

```js
const { data } = await boomin.payouts.batches.list();
const batch = await boomin.payouts.batches.retrieve("pob_...");
console.log(batch.items, batch.downloadUrl);
```

`batches.retrieve` returns the bare batch plus its `items` and `downloadUrl`.
The full lifecycle — build, export, confirm, cancel — is on
[`payouts.batches`](/sdk/resources/payout-batches/).

## Watching settlement

```js
await boomin.webhooks.endpoints.create({
  url: "https://your-app.com/webhooks/boomin",
  enabledEvents: ["payout.created", "payout.settled", "payout.failed"],
});
```

## From the CLI

```bash
npx @boomin/cli payout connect
npx @boomin/cli payout run --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout export --period-start 2026-08-01 --period-end 2026-09-01 --out payouts.csv
npx @boomin/cli payout list --status awaiting_account
```

`payout export --out` polls the export operation, reads the batch, and downloads
the CSV straight to a file.
