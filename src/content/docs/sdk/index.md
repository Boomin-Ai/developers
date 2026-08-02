---
title: SDK — install & client
description: Install @boomin/sdk, construct the client, and learn the conventions every resource shares.
---

`@boomin/sdk` is the server-side SDK for the Boomin Platform API. It is built on
`fetch` + WebCrypto only, with zero dependencies and no Node builtins — so it
runs on Node ≥ 18, Cloudflare Workers, Bun, Deno, and edge runtimes.

```bash
npm install @boomin/sdk
```

```js
import Boomin from "@boomin/sdk";

const boomin = new Boomin(process.env.BOOMIN_SECRET_KEY);
```

:::danger
Secret keys (`sk_boomin_live_...`) are server-only. Browser code uses the public
`pk_live_...` key with [`@boomin/connect`](/partner-connect/browser-sdk/).
:::

## Client options

```js
const boomin = new Boomin("sk_boomin_live_...", {
  baseUrl: "https://api.boomin.ai", // API origin; paths live under /v1/platform
  brand: "brand_123",               // threads the Boomin-Brand header
  maxRetries: 2,                    // retries on 429/5xx
  timeout: 30000,                   // per-request timeout in ms
  fetch: myFetch,                   // custom fetch implementation
});
```

Pass the API **origin**, not the versioned path — the SDK appends
`/v1/platform` itself.

## Per-call options

Every method takes per-call `RequestOptions` as its trailing argument:

```js
await boomin.distributions.launch(id, {}, {
  idempotencyKey: "launch-2026-08-01", // otherwise auto-generated per mutation
  brand: "brand_456",                  // per-call Boomin-Brand override
  timeout: 10000,
  maxRetries: 0,
});
```

Note the shape: methods that accept a body take `(id, params, options)`. For
verbs with no body (`pause`, `resume`, `approve`, …) pass `{}` or `null` for
`params`.

## Brands

A platform key belongs to an **organization**. If your org has more than one
brand, select the brand with the `Boomin-Brand` header — the SDK's `brand`
option, either on the client or per call. It accepts a brand id or slug. With
no header, the org's first brand (oldest) is used.

## Idempotency

Every mutation automatically carries an `Idempotency-Key` header — a fresh UUID
per call unless you supply `idempotencyKey`. Because mutations are always keyed,
the SDK can safely retry them on `429` and `5xx`.

Supply your own key when *your* retry loop must not double-apply:

```js
await boomin.distributions.launch(id, {}, { idempotencyKey: `launch:${orderId}` });
```

On `launch`, the key serves two contracts at once: HTTP response replay and
operation dedupe in the execution kernel.

## Pagination

List calls resolve one page and are *also* async-iterable across every page
(cursor pagination on `starting_after`):

```js
// one page
const page = await boomin.partnerships.list({ limit: 20 });
console.log(page.object, page.data.length, page.has_more);
// "list"  20  true

// every page
for await (const enrollment of boomin.enrollments.list({ program: "prog_123" })) {
  console.log(enrollment.id);
}
```

`limit` must be between 1 and 100 (default 20). Camel-cased query params are
converted to the wire's snake_case (`startingAfter` → `starting_after`).

:::caution
Query parameters are camel→snake converted. **Request bodies are not.** Send
body fields exactly as the API names them: `enabled_events`, `value_minor`,
`period_start`, `referral_code`.
:::

## Ids

Ids are returned with a type prefix and accepted with or without it:

| Prefix | Resource |
| --- | --- |
| `prog_` | program |
| `ptnr_` | partner |
| `pship_` | partnership |
| `enr_` | enrollment |
| `dist_` | distribution |
| `dep_` | deployment |
| `conn_` | connection |
| `op_` | operation |
| `evt_` | event |
| `perf_` | performance event |
| `po_` / `pob_` | payout / payout batch |
| `we_` | webhook endpoint |

Passing a *wrong* prefix for the resource returns that resource's typed 404 —
it never leaks whether another tenant's object exists.

## Response shapes

Success responses are Stripe-style **bare objects** — the resource itself, not
`{ distribution: {...} }`. Three deliberate exceptions:

- `distributions.launch` → `{ distribution, status, operation }`, all **id strings**.
- `distributions.pause/resume/cancel` (and the deployment verbs on the API) →
  the bare resource **plus** an `operation` id alongside.
- `webhooks.endpoints.create/retrieve/update/rotateSecret` → wrapped as
  `{ webhook_endpoint: { ... } }`.

A handful of reads return the bare resource plus a companion field:
`distributions.validate` adds `valid` and `errors`;
`partnerships.retrieve` adds `enrollments`;
`payouts.batches.retrieve` adds `items`;
`performance.events.create` adds `duplicate` and `projected`.

Lists are always `{ object: "list", data: [...], has_more: boolean }`.

## Errors

Every non-2xx raises a subclass of `BoominError` carrying `code`, `status`,
`requestId`, and `param`. See [Errors](/sdk/errors/).

## Resource clients

| Client | Methods |
| --- | --- |
| [`programs`](/sdk/resources/programs/) | `retrieve` `list` + nested `requirements` / `tiers` / `connectConfig` / `handoffConfig` |
| [`partners`](/sdk/resources/partners/) | `retrieve` `list` — see the page: no `/partners` routes in this release |
| [`partnerships`](/sdk/resources/partnerships/) | `list` `retrieve` `pause` `resume` `end` `updatePermissions` |
| [`enrollments`](/sdk/resources/enrollments/) | `create` `retrieve` `list` `approve` `reject` `pause` `resume` |
| [`distributions`](/sdk/resources/distributions/) | `create` `retrieve` `update` `list` `validate` `launch` `pause` `resume` `cancel` |
| [`deployments`](/sdk/resources/deployments/) | `retrieve` `list` |
| [`connections`](/sdk/resources/connections/) | `list` `retrieve` `revoke` |
| [`performance`](/sdk/resources/performance/) | `summary` + `events.create` |
| [`events`](/sdk/resources/events/) | `list` |
| [`operations`](/sdk/resources/operations/) | `retrieve` `list` `wait` |
| [`webhooks`](/sdk/resources/webhooks/) | `endpoints.create/retrieve/update/list/del/rotateSecret` + `constructEvent` |
| [`payouts`](/sdk/resources/payouts/) | `list` `run` `exportCsv` `connectStatus` + `batches.list/retrieve` |

`resume` is the canonical verb on every surface — never `unpause`.

## Deprecated packages

| Package | Status |
| --- | --- |
| `boominjs` | **Deprecated.** Use `@boomin/sdk` for the Platform API, or `@boomin/connect` for browser Partner Connect. |
| `@boomin/server` | **Maintenance only.** Still used by the generated Signed Handoff routes; new server integrations should use `@boomin/sdk`. |
