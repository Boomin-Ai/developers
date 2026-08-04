---
title: payouts.rails
description: How money physically leaves — CSV formats, your column mapping, and the one-default invariant.
---

A **payout rail** is delivery configuration: which file format is rendered,
which of your columns carry which values, and whether settlement debits the
brand wallet. Nothing exports until one exists — there is no auto-provisioning.

```js
const rail = await boomin.payouts.rails.create({
  rail: "csv_batch",
  config: {
    format: "paypal_payouts_csv",
    columns: [
      { key: "email",  header: "Email" },
      { key: "amount", header: "Amount" },
    ],
  },
  isDefault: true,
});
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(params, options)` | `POST /payouts/rails` | `payout_rails:write` |
| `list(params, options)` | `GET /payouts/rails` | `payout_rails:read` |
| `retrieve(id, options)` | `GET /payouts/rails/{id}` | `payout_rails:read` |
| `update(id, params, options)` | `POST /payouts/rails/{id}` | `payout_rails:write` |

`payout_rails:*` is deliberately separate from `payouts:*`. A column mapping
decides where money lands, which is banking configuration rather than payout
execution — see [why](/payouts/#scopes).

## The payout rail object

```json
{
  "id": "prail_db003d33-…",
  "object": "payout_rail",
  "rail": "csv_batch",
  "status": "active",
  "is_default": true,
  "config": {
    "format": "paypal_payouts_csv",
    "wallet_funded": false,
    "columns": [
      { "key": "email",  "header": "Email" },
      { "key": "amount", "header": "Amount" }
    ]
  },
  "livemode": true,
  "created_at": "2026-08-03T06:12:08.755Z",
  "updated_at": "2026-08-03T06:12:08.755Z"
}
```

Ids are prefixed `prail_`. The SDK reads this back as `rail.isDefault`,
`rail.config.walletFunded`, `rail.config.format` — and `rail.config.columns`
exactly as you sent it.

## Rail kinds

| `rail` | Status |
| --- | --- |
| `csv_batch` | **Available.** Renders a file, you pay out of band, you confirm. |
| `stripe_connect` | Configurable, **cannot pay anyone yet** — see below. |

### csv_batch

```js
await boomin.payouts.rails.create({
  rail: "csv_batch",
  config: {
    format: "paypal_payouts_csv",     // REQUIRED
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

`config.format` is **required** and has no default:

| `format` | File |
| --- | --- |
| `paypal_payouts_csv` | PayPal Payouts batch CSV |
| `wise_batch_csv` | Wise batch-transfer CSV |

Omitting it is a typed 400: *"config.format is required for a csv_batch rail —
the PayPal and Wise column sets differ, so there is no neutral default."* The
API refuses to pick, because picking is choosing the file your bank reads.

`walletFunded: true` turns [`batches.confirm`](/sdk/resources/payout-batches/#confirm)
into a guarded brand-wallet debit per item. Leave it `false` — the default —
when money moves outside Boomin, which is the normal `csv_batch` case.

### stripe_connect

The API accepts a create call for this rail. **It cannot disburse today.**
Partner payouts over Connect need a transfers-only Express capability that is
not yet approved on Boomin's Stripe platform account, so partners have no
onboarding path to complete and there is no `disburse` route on the Platform
API — deliberately absent rather than present and always failing.

`config` must be empty for `stripe_connect`; every csv key is refused rather
than accepted-and-ignored:

```js
await boomin.payouts.rails.create({ rail: "stripe_connect" });
// config.format / .columns / .walletFunded → invalid_request (400)
```

Configure `csv_batch` and plan around it.

## config.columns is your data

The SDK converts camelCase to the wire's snake_case at the boundary. **Inside
`columns` it converts nothing** — no key, no value, at any depth. Headers come
back byte-for-byte, in the order you sent them.

```js
await boomin.payouts.rails.create({
  rail: "csv_batch",
  config: {
    format: "wise_batch_csv",
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

The rendered file's header row is then exactly:

```csv
Email Address,payoutAmount,Currency_Code,REF
```

`payoutAmount` staying `payoutAmount` is the whole point. A boundary that
re-cased it to `payout_amount` would change which column your bank reads, and
nothing would report an error — on this surface a rename is a money bug, not a
cosmetic one.

### key is a closed vocabulary

`header` is yours; `key` is not. It selects which value of a payout row fills
the column, and is validated server-side:

| `key` | Value |
| --- | --- |
| `email` | Recipient email — the handle a `csv_batch` batch requires |
| `name` | Recipient name |
| `amount` | Amount in major units (`25.00`) |
| `amount_cents` | Amount in minor units (`2500`) |
| `currency` | ISO currency code |
| `reference` | The batch item's reference |
| `note` | Free-text note column |

An unknown key would render as `undefined` in whatever column it named, so it is
a 400. Between 1 and 50 columns.

:::note[One caveat on "byte-identical"]
`config` is a `jsonb` column, and Postgres normalises key order *within* an
object. `{ header, key }` reads back as `{ key, header }`. The array order and
every name and value survive; only the two keys inside one entry may swap.
:::

## create is not an upsert

A second `create` for a rail kind this brand has already configured throws:

```js
import { PayoutRailAlreadyExistsError } from "@boomin/sdk";

try {
  await boomin.payouts.rails.create({ rail: "csv_batch", config: { format: "wise_batch_csv" } });
} catch (err) {
  if (err instanceof PayoutRailAlreadyExistsError) {
    // find it and update it explicitly
    const { data } = await boomin.payouts.rails.list();
    const existing = data.find((r) => r.rail === "csv_batch");
    await boomin.payouts.rails.update(existing.id, { config: { format: "wise_batch_csv" } });
  } else throw err;
}
```

Code `payout_rail_already_exists` (409). A brand has at most one rail per kind,
and an upsert here would mean a call reading as *"add a rail"* silently rewrote
where money lands. You have to say `update` out loud.

## update

```js
await boomin.payouts.rails.update("prail_...", { status: "disabled" });
await boomin.payouts.rails.update("prail_...", { isDefault: true });
await boomin.payouts.rails.update("prail_...", {
  config: {
    format: "wise_batch_csv",
    columns: [{ key: "email", header: "Recipient" }, { key: "amount", header: "Amount" }],
  },
});
```

| Param | Values |
| --- | --- |
| `config` | Replaces the stored object **wholesale** |
| `isDefault` | `true` claims the default; `false` releases it |
| `status` | `active` \| `disabled` |

`rail` cannot be changed — a rail kind is what the object is.

:::caution[config replaces, it does not merge]
Send `config` and the stored object is replaced entirely. Omit fields and they
are gone, not preserved. A merge cannot express "remove this column", and a
half-applied column mapping is a file that pays the wrong column — so there is
no merge, here or in the API. Send the complete config every time, or omit
`config` to leave it untouched.
:::

## One default rail

An omitted `rail` on [`batches.create`](/sdk/resources/payout-batches/) resolves
to the brand's default. At most one active default per brand is enforced by a
partial unique index in the database, so that resolution can never be ambiguous.

Setting `isDefault: true` on a second rail atomically clears the first — both
statements ship in one transaction, and two callers racing to become default
both succeed with the database ending on exactly one default.

A default the batch builder cannot use is treated as no default at all:
`payout_rail_required`.

## list and retrieve

```js
const { data } = await boomin.payouts.rails.list();
const rail = await boomin.payouts.rails.retrieve("prail_...");
```

`list` accepts `limit` (1–100, default 20) and `startingAfter`. Rails are few, so
paging is honoured in memory rather than pushed into SQL — but it *is* honoured.

Rail `config` appears here and **not** on
[`payouts.connectStatus()`](/sdk/resources/payouts/#connectstatus), which is a
`payouts:read` surface and reports identity and state only.

## Errors

| Code | HTTP | When |
| --- | --- | --- |
| `invalid_request` | 400 | Missing `config.format` on `csv_batch`, an unknown `columns[].key`, or a csv key on `stripe_connect`. `param` names it. |
| `payout_rail_already_exists` | 409 | `create` for a kind already configured. → `PayoutRailAlreadyExistsError` |
| `payout_rail_required` | 409 | Raised by batch builds and exports — no active rail of the requested kind. → `PayoutRailRequiredError` |
| `payout_rail_not_found` | 404 | Unknown, malformed, or another tenant's rail id. |

## From the CLI

```bash
npx @boomin/cli payout rails create --rail csv_batch \
  --format paypal_payouts_csv --default \
  --columns '[{"key":"email","header":"Email"},{"key":"amount","header":"Amount"}]'
npx @boomin/cli payout rails list
npx @boomin/cli payout rails show prail_...
npx @boomin/cli payout rails update prail_... --status disabled
```

`--columns` takes JSON and is handed to the API untouched, for the same reason
the SDK treats it as opaque. Full flag table:
[CLI reference](/cli/reference/#payout-rails).
