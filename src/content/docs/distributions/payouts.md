---
title: Payouts
description: From measured value to money out — the ledger, batches, and the CSV rail.
---

Payouts are the last leg: measured performance becomes reward grants, grants
become immutable ledger rows, and rows are batched onto a rail that actually
moves money.

```js
await boomin.payouts.run({ period_start: "2026-08-01", period_end: "2026-09-01" });

const batch = await boomin.payouts.exportCsv({
  period_start: "2026-08-01",
  period_end: "2026-09-01",
});
console.log(batch.download_url);
```

Full parameter reference: [`payouts`](/sdk/resources/payouts/).

## The chain

```txt
performance event  →  reward grant  →  payout row  →  batch  →  rail
```

Each arrow is guarded. A grant claims budget exactly once; a payout row is
immutable once written; a row lives in at most one live batch.

## run

```js
const result = await boomin.payouts.run({
  period_start: "2026-08-01",
  period_end: "2026-09-01",
});
// { object: "payout_run", payouts: [...], summary: { ... } }
```

Recomputes the period's rows. Idempotent — running it twice over the same period
converges instead of duplicating.

`period_start` must be strictly before `period_end`, or `invalid_period` (400).
Both are `YYYY-MM-DD`.

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
  console.log(payout.id, payout.amount_cents);
}
```

`awaiting_account` is the bucket worth a dashboard: money is owed and nothing is
wrong except that nobody told you where to send it.

## Eligibility

A row is eligible for a batch when its status is `pending` or
`awaiting_account` **and** it is not brand-bridged. Rows destined for another
brand's wallet settle on the wallet rail instead — never both, never twice.

## The csv_batch rail

`exportCsv` is the zero-onboarding disbursement path, and it does two things in
one call: builds a `csv_batch` over the eligible rows, then exports it to
storage and returns the download URL.

```json
{
  "id": "pob_...",
  "object": "payout_batch",
  "status": "…",
  "items": [ … ],
  "skipped": [ … ],
  "export_file_key": "…",
  "download_url": "https://…"
}
```

Answers **201**.

**Read `skipped`.** It names the rows that were *not* included and why. The
usual reasons are a row already living in another live batch, or a recipient
with no payout destination.

Column maps for PayPal and Wise are configurable per brand. You pay the CSV out
of band, then confirm — the confirm and money-move steps are finance-gated and
live in the app, not on the Platform API.

Omit both period fields to sweep every eligible row regardless of period.

## Readiness

```js
const status = await boomin.payouts.connectStatus();
```

```json
{
  "object": "payouts.connect_status",
  "rails": [ { "rail": "csv_batch", ... } ],
  "stripe": {
    "configured": true,
    "partner_accounts": 42,
    "partner_accounts_payouts_enabled": 37
  }
}
```

Check this **before** a run rather than discovering the gap in `skipped`. The
delta between `partner_accounts` and `partner_accounts_payouts_enabled` is
exactly the set of partners who need to finish onboarding.

The `stripe_connect` rail disburses to partner Express accounts directly, keyed
per payout item so a retry cannot double-send, with a reversal on failure.

## Batches

```js
const { data } = await boomin.payouts.batches.list();
const batch = await boomin.payouts.batches.retrieve("pob_...");
console.log(batch.items);
```

`batches.retrieve` returns the bare batch plus its `items`. `batches.list`
returns every batch for the brand in one envelope and does not paginate, so
`has_more` is always `false`.

## Watching settlement

```js
await boomin.webhooks.endpoints.create({
  url: "https://your-app.com/webhooks/boomin",
  enabled_events: ["payout.created", "payout.settled", "payout.failed"],
});
```

## From the CLI

```bash
npx @boomin/cli payout connect
npx @boomin/cli payout run --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout export --period-start 2026-08-01 --period-end 2026-09-01 --out payouts.csv
npx @boomin/cli payout list --status awaiting_account
```

`payout export --out` downloads the CSV straight to a file.
