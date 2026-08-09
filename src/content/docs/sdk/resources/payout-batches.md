---
title: payouts.batches
description: One frozen disbursement run — build synchronously, export and confirm as operations.
---

A **payout batch** is one disbursement run, frozen. Building it moves eligible
ledger rows onto the batch so nothing else can claim them; exporting renders the
file; confirming records what the rail actually did.

```js
const batch = await boomin.payouts.batches.create({
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
});

const accepted = await boomin.payouts.batches.export(batch.id);
await boomin.operations.wait(accepted.operation, { timeout: 120000 });

const exported = await boomin.payouts.batches.retrieve(batch.id);
console.log(exported.downloadUrl);
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(params, options)` | `POST /payouts/batches` | `payouts:write` |
| `list(params, options)` | `GET /payouts/batches` | `payouts:read` |
| `retrieve(id, options)` | `GET /payouts/batches/{id}` | `payouts:read` |
| `export(id, params, options)` | `POST /payouts/batches/{id}/export` | `payouts:write` |
| `confirm(id, params, options)` | `POST /payouts/batches/{id}/confirm` | `payouts:write` |
| `cancel(id, params, options)` | `POST /payouts/batches/{id}/cancel` | `payouts:write` |

Ids are prefixed `pob_`.

## The payout batch object

```json
{
  "id": "pob_...",
  "object": "payout_batch",
  "rail": "csv_batch",
  "status": "exported",
  "currency": "usd",
  "periodStart": "2026-08-01",
  "periodEnd": "2026-09-01",
  "itemCount": 12,
  "totalAmountCents": 48500,
  "exportFileKey": "payouts/…/pob_….csv",
  "exportFormat": "paypal_payouts_csv",
  "externalBatchRef": null,
  "exportedAt": "2026-08-03T06:20:11.104Z",
  "confirmedAt": null,
  "completedAt": null,
  "error": null,
  "createdAt": "2026-08-03T06:19:44.201Z",
  "items": [ … ],
  "downloadUrl": "https://…"
}
```

(Raw HTTP responses spell these `period_start`, `total_amount_cents`, and so
on; the SDK camelCases every response key.)

`items` accompanies `create` and `retrieve`. `downloadUrl` appears on
`retrieve` only — see [where downloadUrl lives](#where-downloadurl-lives).

Note the batch total is `totalAmountCents` (wire `total_amount_cents`), not
`*Minor`: the batch is a single-currency object and this is a pre-existing
physical field name. Rule economics use `perUnitMinor` / `bonusMinor`.

### Statuses

`draft` `exporting` `exported` `submitted` `reconciling` `completed`
`partially_paid` `failed` `canceled`

### Batch items

```json
{
  "id": "2d7c12ab-…",
  "payoutId": "…",
  "partnerId": "…",
  "userId": null,
  "recipientHandle": "creator@example.com",
  "amountCents": 2500,
  "currency": "usd",
  "status": "pending",
  "externalItemRef": null,
  "failureReason": null,
  "paidAt": null
}
```

Item `id` is a bare uuid, not a prefixed id — it is what
[`confirm`](#confirm) names in `results[].item`. Item statuses are `pending`
`processing` `paid` `failed` `returned` `canceled`.

## create

Synchronous. Freezes the eligible rows onto a new batch and resolves the batch
plus its `items` and `skipped`. Answers **201**.

```js
const batch = await boomin.payouts.batches.create({
  rail: "csv_batch",           // optional — omit to use the brand's default rail
  periodStart: "2026-08-01",   // optional
  periodEnd: "2026-09-01",     // optional
});
```

Omit both period fields to sweep every eligible row regardless of period.

It is synchronous because the build is a single database transaction whatever
the item count — there is no unbounded work to make durable, and a 202 would
hand back an operation id for something already finished.

### Eligibility

A ledger row joins a batch when its status is `pending` **or**
`awaiting_account`, and it is not bridged to another brand's wallet. Bridged
rows settle on the wallet rail instead — never both, never twice.

A `stripe_connect` batch takes `pending` rows only.

:::note[`awaiting_account` is the normal status]
A row lands `pending` only when its recipient already has an active,
payouts-enabled payout account. Since partner Connect onboarding is not yet
available, expect `awaiting_account` — and note `csv_batch` batches those rows
anyway. Paying people who have no Boomin-side payout account is what the CSV
rail is *for*.
:::

### skipped is a count

```js
const batch = await boomin.payouts.batches.create({ periodStart, periodEnd });
console.log(batch.itemCount, batch.skipped); // 12  3
```

`skipped` is the **number** of otherwise-eligible rows dropped for want of a
recipient handle — no email on `csv_batch`, no onboarded Stripe account on
`stripe_connect`. Those rows stay eligible and will join a later batch once the
handle exists.

If *every* eligible row is skipped, the build answers `payout_batch_empty` (409)
carrying the same count.

### No rail configured

```js
import { PayoutRailRequiredError } from "@boomin/sdk";

try {
  await boomin.payouts.batches.create({ periodStart, periodEnd });
} catch (err) {
  if (err instanceof PayoutRailRequiredError) {
    // configure one — nothing is auto-provisioned
  } else throw err;
}
```

Every "not configured" path — no rail of the named kind, no default, a default
nothing can batch, a disabled rail — collapses into that one code, because from
your side they are one problem with one fix. See
[why nothing is auto-created](/payouts/#1-no-rail-is-auto-created).

## export

**202 + an operation.** Writes the rendered file to storage.

```js
const accepted = await boomin.payouts.batches.export("pob_...");
// { batch: "pob_...", status: "exporting", operation: "op_..." }

const operation = await boomin.operations.wait(accepted.operation, { timeout: 120000 });
if (operation.status !== "succeeded") throw new Error(`export ${operation.status}`);
```

`batch` and `operation` are **id strings**, never embedded objects — the same
202 contract [`payouts.exportCsv`](/sdk/resources/payouts/#exportcsv) answers.
One export contract, not two.

Repeating the call replays the same operation, and even a re-run writes the same
storage key: one batch can never produce two artifacts.

### Where downloadUrl lives

Not in the 202. It is minted on **read**:

```js
const batch = await boomin.payouts.batches.retrieve(accepted.batch);
console.log(batch.downloadUrl);
```

The URL is presigned and short-lived. Returned once from the mutation it would
already be expiring by the time an operator opened it, and could not be
re-obtained without re-exporting. On `retrieve` it is regenerated every time.

`downloadUrl` is `null` on a batch that has an `exportFileKey` when presigning
credentials are unavailable — the file exists but was **not** delivered. Treat
that as a failure rather than writing a zero-byte file.

## confirm

**202 + an operation.** Records the outcome of the disbursement you performed.

```js
const accepted = await boomin.payouts.batches.confirm("pob_...", {
  externalBatchRef: "PAYPAL-2026-08",
});
await boomin.operations.wait(accepted.operation);
```

With no `results`, every item settles as `paid`. To report per-item outcomes:

```js
const batch = await boomin.payouts.batches.retrieve("pob_...");

await boomin.payouts.batches.confirm(batch.id, {
  externalBatchRef: "PAYPAL-2026-08",
  results: [
    { item: batch.items[0].id, status: "paid" },
    { item: batch.items[1].id, status: "failed", reason: "recipient email bounced" },
    { item: batch.items[2].id, status: "returned", reason: "account closed" },
  ],
});
```

| Param | Meaning |
| --- | --- |
| `externalBatchRef` | Your rail-side batch id, ≤ 200 chars. Also the retry key — see below. |
| `results[].item` | A batch **item** id (bare uuid) from `batch.items` |
| `results[].status` | `paid` \| `failed` \| `returned` |
| `results[].reason` | Optional, ≤ 500 chars |

Up to 1000 results. Naming an item that is not in this batch is a typed 400 with
`param: "results"` — it never partially applies.

:::note[Why confirm is an operation]
The work is unbounded. Item count has no cap, and items settle one at a time —
at least one round trip each, plus a guarded wallet debit each when the rail is
`walletFunded`. A four-figure batch would exceed a Worker's subrequest budget
and die mid-settlement with some items paid, some not, and no handle to resume.
Under the operation kernel every leg is fenced and keyed on the item id, so a
retry finishes rather than restarts.
:::

Repeating a confirm with the **same** `externalBatchRef` replays one operation,
so an operator's retry after a timeout cannot settle the run twice.

## cancel

Synchronous. Unfreezes a batch that has not settled and returns its rows to the
eligible pool.

```js
const canceled = await boomin.payouts.batches.cancel("pob_...");
console.log(canceled.status); // "canceled"
```

## list and retrieve

```js
const page = await boomin.payouts.batches.list({ limit: 20 });
const batch = await boomin.payouts.batches.retrieve("pob_...");
console.log(batch.items, batch.downloadUrl);
```

`list` accepts `limit` (1–100, default 20) and `startingAfter`. Batches are few
and already ordered, so paging is applied in memory — but it is applied.

`retrieve` returns the bare batch **plus** `items` and `downloadUrl` alongside.

## Errors

| Code | HTTP | When |
| --- | --- | --- |
| `payout_rail_required` | 409 | No active rail of the requested kind, or no usable default. → `PayoutRailRequiredError` |
| `payout_batch_empty` | 409 | No settle-able row for this rail and period. → `PayoutBatchEmptyError` |
| `payout_batch_conflict` | 409 | A concurrent build raced this one. → `PayoutBatchStateError` |
| `payout_batch_not_exportable` | 409 | Wrong status for `export`. → `PayoutBatchStateError` |
| `payout_batch_not_confirmable` | 409 | Wrong status for `confirm`. → `PayoutBatchStateError` |
| `payout_batch_not_cancelable` | 409 | Wrong status for `cancel`. → `PayoutBatchStateError` |
| `invalid_request` | 400 | `results` names an item not in this batch. |
| `payout_batch_not_found` | 404 | Unknown, malformed, or another tenant's batch id. |

On any `PayoutBatchStateError`, read the batch and look at `status` — the state
machine refused the verb, and the current status says why.

## From the CLI

```bash
npx @boomin/cli payout batches create --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout batches list
npx @boomin/cli payout batches show pob_...
npx @boomin/cli payout batches export pob_... --out payouts.csv
npx @boomin/cli payout batches confirm pob_... --external-batch-ref PAYPAL-2026-08
npx @boomin/cli payout batches cancel pob_...
```

`export` and `confirm` poll their operation to a terminal status by default;
`--no-wait` returns the 202. Full flag table:
[CLI reference](/cli/reference/#payout-batches).
