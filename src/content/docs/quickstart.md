---
title: Quickstart
description: From a fresh machine to a launched, funded distribution with webhooks and a payout CSV.
---

The golden path, end to end. Every command and snippet on this page is meant to
be run in order on a clean machine. It takes about fifteen minutes.

You will: sign up, mint a platform key, install the SDK, create a program, embed
Partner Connect, invite and approve a partner, create and launch a **funded
distribution**, poll the launch operation, receive a signed webhook, and export
a payout CSV.

:::note[Which rail are you on?]
This quickstart walks the **distribution** rail. If all you need is an
always-on referral program — codes, qualification, rewards, no launches — stop
after step 5; that is a complete product on its own. See
[The distribution model](/concepts/model/) for the difference.
:::

## 1. Sign up and log in

Create an account at [boomin.ai](https://boomin.ai), then authenticate the CLI.
`login` opens a browser and writes the session to your local CLI config.

```bash
npx @boomin/cli login
```

## 2. Create a program

A **program** is the container your partners enroll into. Programs are created
from the CLI (or the app) — not from the Platform API.

```bash
npx @boomin/cli init --program-name "Launch Partners" --yes
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
  --scopes org:read,programs:read,partnerships:read,enrollments:read,enrollments:write,distributions:read,distributions:write,distributions:launch,deployments:read,performance:read,performance:write,events:read,webhooks:read,webhooks:write,payouts:read,payouts:write \
  --save
```

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

## 5. Embed Partner Connect (get partners in)

Partner Connect is the browser surface where a partner joins your program.
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
partner from the server:

```js
const enrollment = await boomin.enrollments.create({
  program: process.env.BOOMIN_PROGRAM_ID, // "prog_..." or the bare id
  email: "creator@example.com",
  name: "Creator",
});

await boomin.enrollments.approve(enrollment.id);
console.log(enrollment.id, enrollment.referral_code);
// enr_...  ABC123
```

Inviting upserts the partner identity, creates the durable partnership
(`pending`), and creates the enrollment `(pending, active)`. Approving flips
`approval_status` to `approved` and activates the partnership.

At this point the evergreen rail is already live: that `referral_code` resolves
and attributes.

## 6. Create a funded distribution

```js
const distribution = await boomin.distributions.create({
  name: "Spring launch",
  objective: "launch",
  programs: [process.env.BOOMIN_PROGRAM_ID],
  spec: {
    plan: {
      partner: {
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

## 7. Validate, then launch

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

## 8. Poll the operation

```js
const operation = await boomin.operations.wait(accepted.operation, {
  timeout: 120000,
  pollInterval: 2000,
});

console.log(operation.status, operation.waiting_reason);
// "succeeded" | "partial" | "failed" | "canceled"
```

`wait()` resolves on **any** terminal status — inspect `operation.status`
yourself; it does not throw on a failed operation. It throws `BoominError` with
code `operation_wait_timeout` only when your timeout elapses.

If the brand wallet cannot cover a funded budget, the operation parks at
`status: "waiting"` with `waiting_reason: "funding_required"` instead of
failing. Top the wallet up in the app and it proceeds.

Then read what got created:

```js
const dist = await boomin.distributions.retrieve(distribution.id);
console.log(dist.status, dist.deployments);
// "active"  { total: 1, live: 1 }

for await (const deployment of boomin.deployments.list({ distribution: dist.id })) {
  console.log(deployment.deployment_key, deployment.observed_status, deployment.external_ids);
  // enroll_<id>:boomin:referral_link:primary  live  { promo_link_id: "...", code: "ep..." }
}
```

Each deployment owns its **own** attribution instrument, distinct from the
program's evergreen referral code — so two distributions sharing one enrollment
credit separately.

## 9. Record a conversion

Business measurements go in against a deployment:

```js
await boomin.performance.events.create({
  deployment: "dep_...",
  type: "purchase",
  value_minor: 4999,
  currency: "usd",
  quantity: 1,
  idempotency_key: "order_1001", // or external_event_id — one of the two is required
  properties: { order_id: "1001" },
});

const summary = await boomin.performance.summary({ distribution: distribution.id });
console.log(summary.events, summary.value_minor, summary.by_type);
```

## 10. Receive a webhook

Register an endpoint. The signing secret is revealed **once**, in this response
only.

```js
const { webhook_endpoint } = await boomin.webhooks.endpoints.create({
  url: "https://your-app.com/webhooks/boomin",
  description: "Production",
  enabled_events: ["distribution.live", "deployment.activated", "payout.settled"],
});

console.log(webhook_endpoint.id, webhook_endpoint.secret);
// we_...  whsec_...
```

An empty (or omitted) `enabled_events` subscribes the endpoint to every public
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

## 11. Export a payout CSV

Recompute the period's payout rows, then export the operator CSV on the
`csv_batch` rail:

```js
await boomin.payouts.run({
  period_start: "2026-08-01",
  period_end: "2026-09-01",
});

const batch = await boomin.payouts.exportCsv({
  period_start: "2026-08-01",
  period_end: "2026-09-01",
});

console.log(batch.id, batch.status, batch.download_url);
// pob_...  ...  https://...
```

Or from the CLI, straight to a file:

```bash
npx @boomin/cli payout run --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout export --period-start 2026-08-01 --period-end 2026-09-01 --out payouts.csv
```

## The whole thing, in one file

```js
import Boomin from "@boomin/sdk";

const boomin = new Boomin(process.env.BOOMIN_SECRET_KEY);
const program = process.env.BOOMIN_PROGRAM_ID;

const enrollment = await boomin.enrollments.create({ program, email: "creator@example.com" });
await boomin.enrollments.approve(enrollment.id);

const distribution = await boomin.distributions.create({
  name: "Spring launch",
  objective: "launch",
  programs: [program],
  budget: { mode: "funded", asset: "credit", total: 50000 },
});

const { valid, errors } = await boomin.distributions.validate(distribution.id);
if (!valid) throw new Error(JSON.stringify(errors));

const accepted = await boomin.distributions.launch(distribution.id);
const operation = await boomin.operations.wait(accepted.operation, { timeout: 120000 });
console.log(operation.status);
```

## Same path from the CLI

```bash
npx @boomin/cli enrollment invite --program prog_... --email creator@example.com
npx @boomin/cli enrollment approve enr_...
npx @boomin/cli distribution create --name "Spring launch" --objective launch \
  --programs prog_... --budget-mode funded --budget-asset credit --budget-total 50000
npx @boomin/cli distribution validate dist_...
npx @boomin/cli distribution launch dist_...        # polls the operation to terminal
npx @boomin/cli webhook create --url https://your-app.com/webhooks/boomin
npx @boomin/cli payout export --out payouts.csv
```

## Next

- [The distribution model](/concepts/model/) — the nouns, and the two rails.
- [Distributions](/distributions/) — lifecycle, budgets, cancellation.
- [SDK reference](/sdk/) — all twelve resource clients.
- [Errors](/sdk/errors/) — the typed code registry and how to recover.
