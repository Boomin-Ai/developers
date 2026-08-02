---
title: Budgets
description: none, metered, and funded — reservation, drawdown, release, and the funding_required wait.
---

A distribution can carry a budget. It is optional, and two of the three modes
cost you nothing to use.

```js
budget: { mode: "funded", asset: "credit", total: 50000 }
```

| `mode` | Reserves money | Behaviour |
| --- | --- | --- |
| `none` | No | The default when `budget` is omitted. Rewards accrue as usual |
| `metered` | No | Spend is recorded against the distribution, nothing is held |
| `funded` | **Yes** | The total is reserved from the brand wallet at launch |

`asset` is `credit` or `usd`. `total` is in **minor units** of that asset —
`50000` credits, or `50000` = \$500.00 in USD.

## The budget object

`budget` is always present on a distribution, even when the mode is `none`:

```json
"budget": {
  "mode": "funded",
  "asset": "credit",
  "total": 50000,
  "consumed": 12000,
  "released": 0
}
```

`consumed` and `released` come off the live reservation and are `0` when no
reservation exists yet. `total - consumed - released` is what remains held.

## Validation

`mode: "funded"` requires both an `asset` and a **positive** `total`. Without
them, `validate()` returns `budget_incomplete` and the distribution stays in
`draft`.

```js
const result = await boomin.distributions.validate(id);
// errors: [{ code: "budget_incomplete", message: "…" }]
```

## Reservation happens at launch, not at create

Creating a funded distribution moves no money. The reservation is taken by the
launch operation, as its first real step:

1. Move `total` from the brand wallet's **available** bucket to its **reserved**
   bucket.
2. Open the reservation row and emit `budget.reserved`.
3. Proceed to plan and create deployments.

The transfer is keyed on the distribution, so a retried launch can never
double-reserve.

### funding_required

If the wallet cannot cover the total, the launch does **not** fail. It emits
`budget.reserve_failed` and parks:

```js
const operation = await boomin.operations.wait(accepted.operation, { timeout: 120000 });
console.log(operation.status, operation.waiting_reason);
// "waiting"  "funding_required"
```

Top the brand wallet up in the app and the operation proceeds — it is woken when
the blocker clears, with a cron poller as the backstop.

:::caution[Do not relaunch to "retry" a funding wait]
Relaunching while a launch is parked on `funding_required` **reuses the waiting
operation**. It never enqueues a second one, and it never double-reserves. Poll
the operation you already have.
:::

The SDK also exports a `FundingRequiredError` for surfaces that raise the same
condition synchronously — see [Errors](/sdk/errors/).

## Drawdown

As rewards are granted against the distribution, the reservation draws down:
each grant claims its amount exactly once and moves it from **reserved** to
**pending**. `budget.consumed` rises accordingly.

The claim is keyed on the reward grant, so a replayed or retried grant cannot
consume twice — the same guarantee the unfunded reward path already has.

## Release

The unconsumed remainder returns to the wallet's available bucket, and
`budget.released` rises, when the distribution is **canceled** or **completed**.

```js
await boomin.distributions.cancel(id);
// released = total - consumed
```

Consumed budget stays consumed — cancellation reclaims what was never spent, not
what was.

A `budget.released` event is emitted on the [events feed](/sdk/resources/events/)
and delivered to subscribed [webhooks](/sdk/webhooks/).

## Per-deployment allocation

Each deployment carries `budget_allocation_minor` — its share of a funded budget
when one has been allocated to it. It is `null` for unfunded distributions and
for deployments with no allocation.

## Watching the money

```js
await boomin.webhooks.endpoints.create({
  url: "https://your-app.com/webhooks/boomin",
  enabled_events: ["budget.reserved", "budget.released", "budget.reserve_failed"],
});
```

`budget.reserve_failed` is the one to alert on: it means a launch is parked
waiting for you.

## Funding the wallet

Credit-funded budgets work day one from your existing credit balance. USD
budgets draw on a dedicated wallet top-up, done in the app — value only ever
enters the ledger at the platform boundary, never through the Platform API.

There is no API call that mints money.
