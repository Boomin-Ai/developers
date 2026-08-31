---
title: Authentication
description: Platform keys, Bearer auth, scopes, brand selection, and idempotency.
---

The Platform API is **Bearer-only**. Every request carries a private platform
key:

```http
POST /v1/platform/distributions HTTP/1.1
Host: api.boomin.ai
Authorization: Bearer sk_boomin_live_...
Content-Type: application/json
Idempotency-Key: 8f14e45f-…
```

Base URL: `https://api.boomin.ai/v1/platform`. The SDK takes the **origin** and
appends the versioned path itself.

```js
const boomin = new Boomin(process.env.BOOMIN_SECRET_KEY);
```

There is no body-token affordance on v1 and no cookie session. A request without
the header is `platform_token_required` (401) — and authentication runs **before**
any id resolution, so an unauthenticated probe always gets 401, never a 404 that
would reveal whether an object exists.

## Two kinds of key

| Key | Where it lives | What it does |
| --- | --- | --- |
| `sk_boomin_live_...` | **Server only** | Full scoped Platform API access |
| `pk_live_...` | Browser | [Partner Connect](/partner-connect/browser-sdk/) only — join, status, connect flows |

:::danger
A secret key in browser code, a mobile bundle, or a public repo is a full
compromise of the organization's entity data. Browser code uses the public key,
always.
:::

## Minting a key

In the app under **Developers**, or from the CLI:

```bash
npx @boomin/cli token create \
  --name "Quickstart server" \
  --scopes org:read,enrollments:read,enrollments:write,distributions:read,distributions:write,distributions:launch,deployments:read,performance:read,performance:write,events:read,webhooks:read,webhooks:write,payouts:read,payouts:write \
  --save
```

The secret is shown **once**. Put it in a secret manager or an environment
variable.

```bash
npx @boomin/cli token list
npx @boomin/cli token rotate <token_id> --save
npx @boomin/cli token revoke <token_id>
```

Keys are scoped, revocable, audited, idempotent, and creation-rate-limited. See
[Token Commands](/cli/tokens/) and [API Safety](/tokens-scopes/safety/).

## Scopes

Scope names are `resource:action`. A route that needs a scope your key lacks
answers `missing_scope` (403), and the message names the missing scope:

```txt
missing_scope:distributions:launch
```

The CLI turns that into a ready-to-run fix. The distribution surface uses:

| Scope | Grants |
| --- | --- |
| `programs:read` | Read programs |
| `program_requirements:read` / `:write` | Qualification rules |
| `program_tiers:read` / `:write` | Tier ladder |
| `connect_config:read` / `:write` | Partner Connect surface config |
| `handoff:read` / `:write` | Signed-handoff issuers |
| `relationships:read` / `:write` | Durable relationships |
| `enrollments:read` / `:write` | Invite, approve, pause |
| `connections:read` / `:write` | Provider identities and grants |
| `distributions:read` / `:write` | Distributions and the deployment verbs |
| `distributions:launch` | Launch — deliberately separate from `:write` |
| `deployments:read` | Read deployments |
| `performance:read` / `:write` | Rollups / measurement ingestion |
| `events:read` | The operational domain-event feed |
| `webhooks:read` / `:write` | Delivery endpoints |
| `payouts:read` / `:write` | Ledger, runs, exports |
| `entities:read` | Read entities — see [`entities`](/sdk/resources/entities/) |

`operations:read` is granted to **every** valid token implicitly, so any key can
poll the operations it caused without being widened.

Legacy `program_members:*` scopes are accepted as aliases on already-issued
tokens. The full catalogue is on [Scope Reference](/tokens-scopes/scopes/).

Mint the narrowest key that does the job. `distributions:launch` is the one to
be careful with — it is the scope that spends money.

## Brands

A platform key belongs to an **organization**. If your org has more than one
brand, select the brand with the `Boomin-Brand` header:

```js
const boomin = new Boomin(key, { brand: "brand_123" });   // client-wide
await boomin.distributions.list({}, { brand: "other-brand" }); // per call
```

It accepts a brand id or a slug. With no header, the org's **first** (oldest)
brand is used — fine for single-brand orgs, a silent surprise for multi-brand
ones, so set it explicitly if you have more than one.

A `Boomin-Brand` value that does not resolve inside your org is
`brand_not_found` (401-adjacent 404 semantics: existence is never leaked).

Webhook endpoints are the exception — they are **organization**-scoped, and one
endpoint receives every brand's events.

## Idempotency

Every mutation carries an `Idempotency-Key` header. The SDK generates a fresh
UUID per call unless you supply one:

```js
await boomin.distributions.launch(id, {}, { idempotencyKey: `launch:${orderId}` });
```

Because mutations are always keyed, the SDK can safely retry them on `429` and
`5xx`. Supply your own key when *your* retry loop must not double-apply.

Reusing a key with a **different** body is `idempotency_key_conflict` (409).

On `launch` the key serves two contracts at once: HTTP response replay, and
operation dedupe in the execution kernel. A replayed launch returns the same
operation rather than starting a second one.

## Test mode

`sk_test_` and `pk_test_` prefixes are **reserved** and answer
`test_mode_not_yet_available` (400). Test mode is not built.

Until it is, test against a disposable brand with live keys, and use
`distributions.validate()` as the pre-launch dry run — it creates nothing, moves
no money, and surfaces every planning error.

Every object already carries `livemode`, so full test mode will not need a
backfill when it lands.

## Errors

Every non-2xx uses one envelope:

```json
{
  "error": {
    "code": "missing_scope",
    "message": "missing_scope:distributions:launch",
    "param": null,
    "request_id": "req_9f2c…"
  }
}
```

Branch on `code`, never on `message`. `request_id` is also returned as the
`Request-Id` header. Full registry: [Errors](/sdk/errors/).

## Kill switch

The whole platform surface sits behind an operator kill switch. When it is
engaged, every route answers `developer_access_paused` (503). It is not set in
normal operation; if you see it, retry later.
