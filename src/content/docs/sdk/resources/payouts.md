---
title: payouts
description: Compute the period ledger, export the operator CSV, and check disbursement readiness.
---

**Payouts** is the money-out ledger: immutable rows per partner per period,
grouped into batches by a payout rail.

```js
await boomin.payouts.run({ period_start: "2026-08-01", period_end: "2026-09-01" });
const batch = await boomin.payouts.exportCsv({
  period_start: "2026-08-01",
  period_end: "2026-09-01",
});
console.log(batch.download_url);
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /payouts` | `payouts:read` |
| `run(params, options)` | `POST /payouts/run` | `payouts:write` |
| `exportCsv(params, options)` | `POST /payouts/export_csv` | `payouts:write` |
| `connectStatus(params, options)` | `GET /payouts/connect_status` | `payouts:read` |
| `batches.list(params, options)` | `GET /payouts/batches` | `payouts:read` |
| `batches.retrieve(id, options)` | `GET /payouts/batches/{id}` | `payouts:read` |

## run

```js
const result = await boomin.payouts.run({
  period_start: "2026-08-01",   // YYYY-MM-DD, required
  period_end: "2026-09-01",     // YYYY-MM-DD, required
});
// { object: "payout_run", payouts: [...], summary: { ... } }
```

Recomputes the period's payout rows. It is an idempotent upsert: running it
twice over the same period converges rather than duplicating.

`period_start` must be strictly before `period_end`, or `invalid_period` (400).

:::note[`run` never mutates a batched row]
Once a payout row has been pulled into a live batch, recomputation leaves it
alone. That is what makes it safe to re-run a period after you have already
exported part of it.
:::

## exportCsv

```js
const batch = await boomin.payouts.exportCsv({
  period_start: "2026-08-01",   // optional
  period_end: "2026-09-01",     // optional
});
```

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

One call, two steps: it builds a `csv_batch` over the eligible rows, then
exports it and returns the download URL. Answers **201**.

`skipped` names rows that were *not* included and why — read it. The usual
reasons are a row already living in another live batch, or a recipient with no
usable payout destination.

Omit both period fields to sweep every eligible row regardless of period.

### Eligibility

A payout row is eligible for a batch when its `status` is `pending` or
`awaiting_account` **and** it is not brand-bridged. Rows destined for another
brand's wallet settle on the wallet rail instead — never both.

The `csv_batch` rail is the zero-onboarding disbursement path: you get an
operator CSV (PayPal or Wise column maps are configurable per brand), pay it out
of band, and confirm. The confirm and money-move steps are finance-gated and
live in the app, not on this client.

## list

| Param | Values |
| --- | --- |
| `status` | `pending` `awaiting_account` `processing` `paid` `failed` |
| `periodStart` / `periodEnd` | `YYYY-MM-DD` exact match |
| `limit` | 1–100, default 20 |
| `startingAfter` | A `po_...` cursor |

```js
for await (const payout of boomin.payouts.list({ status: "awaiting_account" })) {
  console.log(payout.id, payout.amount_cents, payout.period_start);
}
```

`awaiting_account` is the interesting bucket: money is owed, but the recipient
has no payout destination yet.

## batches

```js
const { data } = await boomin.payouts.batches.list();
const batch = await boomin.payouts.batches.retrieve("pob_...");
console.log(batch.items);
```

`batches.retrieve` returns the bare batch **plus** its `items` alongside.
`batches.list` returns every batch for the brand in one envelope — it does not
paginate, so `has_more` is always `false`.

## connectStatus

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

The disbursement-readiness read: which rails this brand has configured, and how
many of its partners have a Stripe Connect payout account that can actually
receive money. Check it before a run rather than discovering the gap in
`skipped`.

## From the CLI

The same flow, straight to a file:

```bash
npx @boomin/cli payout run --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout export --period-start 2026-08-01 --period-end 2026-09-01 --out payouts.csv
npx @boomin/cli payout list --status awaiting_account
npx @boomin/cli payout connect
```
