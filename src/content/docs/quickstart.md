---
title: Quickstart
description: From a fresh machine to a launched, funded distribution with webhooks and a payout CSV.
---

The golden path, end to end. Every command and snippet on this page is meant to
be run in order on a clean machine. It takes about fifteen minutes.

You will: sign up, mint a platform key, install the SDK, create a program,
configure a **payout rail** and a **payout rule**, embed Partner Connect, invite
and approve a entity, create and launch a **funded distribution**, poll the
launch operation, receive a signed webhook, run payouts, and download a CSV that
pays your entities.

That last part is the point. The loop is not closed until money can leave.

:::note[Which rail are you on?]
This quickstart walks the **distribution** rail. If all you need is an
always-on referral program — codes, qualification, rewards, no launches — do
steps 1–7, then jump to step 13. That is a complete product on its own, and the
payout half is identical: rules and rails do not care which rail the activity
came in on. See [The distribution model](/concepts/model/) for the difference.
:::

## 1. Sign up and log in

Create an account at [boomin.ai](https://boomin.ai), then authenticate the CLI.
`login` opens a browser and writes the session to your local CLI config.

```bash
npx @boomin/cli login
```

## 2. Create a program

A **program** is the container your entities enroll into. Programs are created
from the CLI (or the app) — not from the Platform API.

```bash
npx @boomin/cli init --program-name "Launch Entities" --yes
```

`init` selects or creates an organization and brand, creates the program,
ensures a Partner Connect surface exists, adds `localhost` origins, and writes
`.env.local`:

```ini
VITE_BOOMIN_PUBLIC_KEY=pk_live_...
VITE_BOOMIN_PROGRAM_ID=...
VITE_BOOMIN_API_BASE=https://api.boomin.ai/v1/connect
```

Programs are **private by default**. Add `--list` to put yours on the public
[Discover feed](/partner-programs/discover/).

## 3. Create a platform key

Server-side calls use a private `sk_boomin_live_...` platform key. Mint one in
the app under **Developers**, or from the CLI:

```bash
npx @boomin/cli token create \
  --name "Quickstart server" \
  --scopes org:read,programs:read,relationships:read,enrollments:read,enrollments:write,distributions:read,distributions:write,distributions:launch,deployments:read,performance:read,performance:write,events:read,webhooks:read,webhooks:write,payouts:read,payouts:write,payout_rules:read,payout_rules:write,payout_rails:read,payout_rails:write \
  --save
```

Note the four payout **configuration** scopes at the end. `payouts:write` moves
money the brand already owes; it deliberately does not also let a key create
rules or redirect where money lands. In production, mint those on a separate,
rarely-used key — see [scopes](/payouts/#scopes).

The secret is shown **once**. Put it in your server's secret manager or an env
var:

```bash
export BOOMIN_SECRET_KEY=sk_boomin_live_...
```

:::danger
`sk_boomin_live_...` keys are server-only. Never ship one to a browser, a mobile
app, or a public repo. Browser code uses the public `pk_live_...` Connect key.
:::

## 4. Install the SDK

```bash
npm install @boomin/sdk
```

```js
// boomin.js
import Boomin from "@boomin/sdk";

export const boomin = new Boomin(process.env.BOOMIN_SECRET_KEY);
```

The SDK is `fetch` + WebCrypto only — Node ≥ 18, Cloudflare Workers, Bun, Deno,
and edge runtimes. Zero dependencies.

## 5. Configure a payout rail

**Do this before anything earns.** A rail is how money physically leaves. None
is created for you, and nothing exports until one exists.

```js
const rail = await boomin.payouts.rails.create({
  rail: "csv_batch",
  config: {
    format: "paypal_payouts_csv",     // or "wise_batch_csv" — required
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

console.log(rail.id, rail.rail, rail.isDefault);
// prail_...  csv_batch  true
```

`config.format` has no default: PayPal's and Wise's column sets differ, so
choosing one for you would be choosing the file your bank reads. Skipping this
step surfaces later as a typed `payout_rail_required` **409**, not a guess.

Your `columns` headers are passed through byte-for-byte — the SDK converts
`walletFunded` → `wallet_funded` but never touches anything inside `columns`.

:::note[The stripe_connect rail cannot pay anyone yet]
Entity disbursement over Stripe Connect is blocked on a platform capability
that is not yet approved, so entities have no onboarding path and there is no
`disburse` route. `csv_batch` is the rail that works today.
:::

## 6. Create a payout rule

A rule is how a entity **earns**. Scope it to the program from step 2:

```js
const rule = await boomin.payouts.rules.create({
  name: "20% of tracked revenue",
  type: "revenue_split",
  scope: { type: "program", program: process.env.BOOMIN_PROGRAM_ID },
  rateBps: 2000,          // 20.00%
  currency: "usd",
});

console.log(rule.id, rule.type, rule.rateBps);
// prule_...  revenue_split  2000
```

Or pay a flat amount per conversion instead:

```js
await boomin.payouts.rules.create({
  name: "Registration CPA",
  type: "cpa",
  scope: { type: "program", program: process.env.BOOMIN_PROGRAM_ID },
  metricKey: "event_registration",
  perUnitMinor: 500,      // $5.00 — minor units, never "cents"
});
```

:::caution[Economics freeze here]
After creation only `name` and `status` can change. Sending `rateBps` to
`update` throws `ImmutableParameterError` — the payouts ledger references this
rule, so editing its rate would re-interpret settled history. To change money:
create a replacement rule, then `boomin.payouts.rules.archive(rule.id)`. There
is no delete. [Why](/payouts/#2-rule-economics-are-immutable)
:::

## 7. Embed Partner Connect (get entities in)

Partner Connect is the browser surface where a entity joins your program.
Install it in your app's frontend:

```bash
npm install @boomin/connect
```

```js
import Boomin from "@boomin/connect";

Boomin.init({
  publicKey: import.meta.env.VITE_BOOMIN_PUBLIC_KEY,
  programId: import.meta.env.VITE_BOOMIN_PROGRAM_ID,
  apiBase: import.meta.env.VITE_BOOMIN_API_BASE,
  redirectUri: window.location.origin + window.location.pathname,
});

await Boomin.requestOtp({ email: "creator@example.com", name: "Creator" });
await Boomin.verifyOtp({ email: "creator@example.com", code: "123456" });
```

If your app already has logged-in users, use
[Signed Handoff](/partner-connect/signed-handoff/) instead of a second OTP.

For the rest of this quickstart you can skip the browser entirely and invite a
entity from the server:

```js
const enrollment = await boomin.enrollments.create({
  program: process.env.BOOMIN_PROGRAM_ID, // "prog_..." or the bare id
  email: "creator@example.com",
  name: "Creator",
});

await boomin.enrollments.approve(enrollment.id);
console.log(enrollment.id, enrollment.referralCode);
// enr_...  ABC123
```

Inviting upserts the entity identity, creates the durable relationship
(`pending`), and creates the enrollment `(pending, active)`. Approving flips
`approvalStatus` to `approved` and activates the relationship.

At this point the evergreen rail is already live: that `referralCode` resolves
and attributes.

## 8. Create a funded distribution

```js
const distribution = await boomin.distributions.create({
  name: "Spring launch",
  objective: "launch",
  programs: [process.env.BOOMIN_PROGRAM_ID],
  spec: {
    plan: {
      entity: {
        enrollment_policy: "all_approved",
        slots: [
          { name: "primary", medium: "referral", channel: "boomin", format: "referral_link" },
        ],
      },
    },
  },
  budget: { mode: "funded", asset: "credit", total: 50000 },
});

console.log(distribution.id, distribution.status);
// dist_...  draft
```

`create` always returns a **draft**. `budget.total` is in **minor units** of
`budget.asset` (`credit` or `usd`). Omit `budget` entirely for an unfunded
distribution (`mode: "none"`). The `spec` above is the default plan — you can
drop it and get the same single referral-link slot.

## 9. Validate, then launch

```js
const validated = await boomin.distributions.validate(distribution.id);
if (!validated.valid) {
  console.error(validated.errors);
  throw new Error("Distribution did not validate.");
}
// validated.status === "ready"

const accepted = await boomin.distributions.launch(distribution.id);
console.log(accepted);
// { distribution: "dist_...", status: "launching", operation: "op_..." }
```

`launch` is **always** asynchronous. It answers `202` with three **id strings** —
never a synchronous success and never an embedded object. The operation is the
progress surface.

## 10. Poll the operation

```js
const operation = await boomin.operations.wait(accepted.operation, {
  timeout: 120000,
  pollInterval: 2000,
});

console.log(operation.status, operation.waitingReason);
// "succeeded" | "partial" | "failed" | "canceled"
```

`wait()` resolves on **any** terminal status — inspect `operation.status`
yourself; it does not throw on a failed operation. It throws `BoominError` with
code `operation_wait_timeout` only when your timeout elapses.

If the brand wallet cannot cover a funded budget, the operation parks at
`status: "waiting"` with `waitingReason: "funding_required"` instead of
failing. Top the wallet up in the app and it proceeds.

Then read what got created:

```js
const dist = await boomin.distributions.retrieve(distribution.id);
console.log(dist.status, dist.deployments);
// "active"  { total: 1, live: 1 }

for await (const deployment of boomin.deployments.list({ distribution: dist.id })) {
  console.log(deployment.deploymentKey, deployment.observedStatus, deployment.externalIds);
  // program_<id>:boomin:referral_link:primary  live  { promo_link_count: 1, codes: ["ep..."] }
}
```

A deployment is a **channel**, one per (distribution × program × slot) — never a
person. The adapter mints one promo link per approved entity beneath it,
distinct from the program's evergreen referral code — so two distributions
sharing one program credit separately.

## 11. Record a conversion

Business measurements go in against a deployment:

```js
await boomin.performance.events.create({
  deployment: "dep_...",
  enrollment: enrollment.id, // which entity earned it — omit for unattributed measurement
  type: "purchase",
  valueMinor: 4999,
  currency: "usd",
  quantity: 1,
  externalEventId: "order_1001", // or idempotencyKey — one of the two is required
  properties: { order_id: "1001" },
});

const summary = await boomin.performance.summary({ distribution: distribution.id });
console.log(summary.events, summary.valueMinor, summary.byType);
```

The `?ref=` link paths stamp `enrollment` themselves; a first-party integration
recording its own conversions passes it explicitly.

## 12. Receive a webhook

Register an endpoint. The signing secret is revealed **once**, in this response
only.

```js
const endpoint = await boomin.webhooks.endpoints.create({
  url: "https://your-app.com/webhooks/boomin",
  description: "Production",
  enabledEvents: ["distribution.live", "deployment.activated", "payout.settled"],
});

console.log(endpoint.id, endpoint.secret);
// we_...  whsec_...
```

An empty (or omitted) `enabledEvents` subscribes the endpoint to every public
event type.

Verify deliveries with `constructEvent`. It is **async** (WebCrypto), and it
needs the **raw** body — never a re-parse.

```js
import { constructEvent } from "@boomin/sdk/webhooks";

export default {
  async fetch(request, env) {
    const payload = await request.text();
    let event;
    try {
      event = await constructEvent(
        payload,
        request.headers.get("Boomin-Signature"),
        env.BOOMIN_WEBHOOK_SECRET, // or [current, previous] during rotation
        { tolerance: 300 },
      );
    } catch {
      return new Response("bad signature", { status: 400 });
    }

    if (event.type === "distribution.live") {
      // event.subject = { type, id }; event.data = payload; event.seq = cursor
    }
    return new Response("ok"); // answer 2xx fast; work happens off the response path
  },
};
```

Header format, the 24h rotation overlap, and the retry schedule are in
[Receiving webhooks](/sdk/webhooks/).

## 13. Run payouts

Turn the period's measured activity into ledger rows, using the rule from
step 6:

```js
const result = await boomin.payouts.run({
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
});

console.log(result.outcome, result.payoutsCreated, result.awaitingAccount);
// "payouts_created"  1  1
```

Two outcomes, and they mean different things:

| Result | Meaning |
| --- | --- |
| throws `PayoutRulesRequiredError` (409) | Nothing is configured — you skipped step 6. **Your bug.** |
| `outcome: "no_eligible_activity"` | Configured fine; the window held no compensable activity. **Success.** |
| `outcome: "payouts_created"` | Rows written. |

```js
import { PayoutRulesRequiredError } from "@boomin/sdk";

try {
  const result = await boomin.payouts.run({ periodStart: "2026-08-01", periodEnd: "2026-09-01" });
  if (result.outcome === "no_eligible_activity") {
    console.log(`nothing qualified — ${result.rulesEvaluated} rules over ${result.eventsEvaluated} events`);
  }
} catch (err) {
  if (err instanceof PayoutRulesRequiredError) {
    console.error("create a payout rule first");
  } else throw err;
}
```

Branch on `outcome`, never on a count. In a scheduled job the distinction is
what stops a misconfigured brand from "succeeding" every month while paying
nobody.

Fresh rows will read `awaiting_account` — money owed to a recipient with no
Boomin-side payout account. That is expected, and the CSV rail batches them
anyway.

## 14. Export the CSV and download it

```js
const accepted = await boomin.payouts.exportCsv({
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
});
console.log(accepted);
// { batch: "pob_...", status: "exporting", operation: "op_...", items: [...], skipped: 0 }

const operation = await boomin.operations.wait(accepted.operation, { timeout: 120000 });
if (operation.status !== "succeeded") throw new Error(`export ${operation.status}`);

const batch = await boomin.payouts.batches.retrieve(accepted.batch);
console.log(batch.itemCount, batch.totalAmountCents, batch.downloadUrl);
// 1  1000  https://...
```

Three things here surprise people:

- **`exportCsv` answers 202, not 201.** Writing the file is an operation. The
  build half still runs synchronously, so `payout_rail_required` and
  `payout_batch_empty` come back immediately and typed.
- **`downloadUrl` is not in the 202.** It is presigned and short-lived, so it is
  minted on every *read* of the batch instead of expiring inside a stored
  response body.
- **`skipped` is a count**, not a list — eligible rows dropped for want of a
  recipient email. They stay eligible for a later batch.

Fetch the file:

```js
import { writeFile } from "node:fs/promises";

const res = await fetch(batch.downloadUrl);
await writeFile("payouts.csv", Buffer.from(await res.arrayBuffer()));
```

The header row is exactly the `columns` you configured in step 5:

```csv
Email,Amount,Currency,REF
creator@example.com,10.00,USD,2d7c12ab-…
```

Or let the CLI do the whole thing:

```bash
npx @boomin/cli payout run --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout export --period-start 2026-08-01 --period-end 2026-09-01 --out payouts.csv
```

`payout export --out` polls the operation, reads the batch, and writes the file.
An operation that ends anything but `succeeded` exits non-zero rather than
leaving an empty file behind.

## 15. Pay it, then confirm

Upload `payouts.csv` to PayPal or Wise, then tell Boomin what happened so the
ledger settles:

```js
const confirmed = await boomin.payouts.batches.confirm(batch.id, {
  externalBatchRef: "PAYPAL-2026-08",
});
await boomin.operations.wait(confirmed.operation);
```

With no `results`, every item settles as `paid`. To report per-item outcomes,
name the item ids from `batch.items`:

```js
await boomin.payouts.batches.confirm(batch.id, {
  externalBatchRef: "PAYPAL-2026-08",
  results: [
    { item: batch.items[0].id, status: "paid" },
    { item: batch.items[1].id, status: "failed", reason: "recipient email bounced" },
  ],
});
```

Repeating a confirm with the **same** `externalBatchRef` replays one operation,
so a retry after a timeout cannot settle the run twice.

```bash
npx @boomin/cli payout batches confirm pob_... --external-batch-ref PAYPAL-2026-08
```

The loop is now closed: a entity joined, a distribution ran, a conversion was
measured, a rule priced it, and a rail paid it.

## The whole thing, in one file

```js
import Boomin from "@boomin/sdk";

import { writeFile } from "node:fs/promises";

const boomin = new Boomin(process.env.BOOMIN_SECRET_KEY);
const program = process.env.BOOMIN_PROGRAM_ID;
const period = { periodStart: "2026-08-01", periodEnd: "2026-09-01" };

// 1. How money leaves.
await boomin.payouts.rails.create({
  rail: "csv_batch",
  config: {
    format: "paypal_payouts_csv",
    columns: [
      { key: "email",     header: "Email" },
      { key: "amount",    header: "Amount" },
      { key: "currency",  header: "Currency" },
      { key: "reference", header: "REF" },
    ],
  },
  isDefault: true,
});

// 2. How a entity earns.
await boomin.payouts.rules.create({
  name: "20% of tracked revenue",
  type: "revenue_split",
  scope: { type: "program", program },
  rateBps: 2000,
});

// 3. Get a entity in.
const enrollment = await boomin.enrollments.create({ program, email: "creator@example.com" });
await boomin.enrollments.approve(enrollment.id);

// 4. Launch a funded distribution.
const distribution = await boomin.distributions.create({
  name: "Spring launch",
  objective: "launch",
  programs: [program],
  budget: { mode: "funded", asset: "credit", total: 50000 },
});

const { valid, errors } = await boomin.distributions.validate(distribution.id);
if (!valid) throw new Error(JSON.stringify(errors));

const launched = await boomin.distributions.launch(distribution.id);
const launchOp = await boomin.operations.wait(launched.operation, { timeout: 120000 });
console.log(launchOp.status);

// 5. Price the period and pay it.
const run = await boomin.payouts.run(period);
console.log(run.outcome, run.payoutsCreated);

const accepted = await boomin.payouts.exportCsv(period);
const exportOp = await boomin.operations.wait(accepted.operation, { timeout: 120000 });
if (exportOp.status !== "succeeded") throw new Error(`export ${exportOp.status}`);

const batch = await boomin.payouts.batches.retrieve(accepted.batch);
const csv = await fetch(batch.downloadUrl).then((r) => r.arrayBuffer());
await writeFile("payouts.csv", Buffer.from(csv));

// 6. After paying it out of band:
const confirmed = await boomin.payouts.batches.confirm(batch.id, {
  externalBatchRef: "PAYPAL-2026-08",
});
await boomin.operations.wait(confirmed.operation);
```

## Same path from the CLI

```bash
npx @boomin/cli payout rails create --rail csv_batch \
  --format paypal_payouts_csv --default \
  --columns '[{"key":"email","header":"Email"},{"key":"amount","header":"Amount"}]'
npx @boomin/cli payout rules create --name "Rev share" --type revenue_split \
  --program prog_... --rate-bps 2000
npx @boomin/cli enrollment invite --program prog_... --email creator@example.com
npx @boomin/cli enrollment approve enr_...
npx @boomin/cli distribution create --name "Spring launch" --objective launch \
  --programs prog_... --budget-mode funded --budget-asset credit --budget-total 50000
npx @boomin/cli distribution validate dist_...
npx @boomin/cli distribution launch dist_...        # polls the operation to terminal
npx @boomin/cli webhook create --url https://your-app.com/webhooks/boomin
npx @boomin/cli payout run --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout export --period-start 2026-08-01 --period-end 2026-09-01 --out payouts.csv
npx @boomin/cli payout batches confirm pob_... --external-batch-ref PAYPAL-2026-08
```

## Next

- [Getting entities paid](/payouts/) — the money model, and the five things that surprise people.
- [The distribution model](/concepts/model/) — the nouns, and the two rails.
- [Distributions](/distributions/) — lifecycle, budgets, cancellation.
- [SDK reference](/sdk/) — every resource client.
- [Errors](/sdk/errors/) — the typed code registry and how to recover.
