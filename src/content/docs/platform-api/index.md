---
title: Platform API v1
description: The Stripe-shaped REST tree at /v1/platform — conventions, resources, and the interactive reference.
---

The Platform API is the server-side surface: twelve resources under one
versioned, Bearer-only tree.

```txt
https://api.boomin.ai/v1/platform
```

Most people should use [`@boomin/sdk`](/sdk/) rather than raw HTTP — it carries
the conventions below for you. This page is the contract underneath it.

## Conventions

| | |
| --- | --- |
| **Auth** | `Authorization: Bearer sk_boomin_live_...`. Bearer-only — no body token, no cookie session |
| **Brand** | `Boomin-Brand: <id-or-slug>` for multi-brand orgs; default is the org's oldest brand |
| **Updates** | POST, Stripe style. `POST /distributions/{id}`, never `PATCH` |
| **Idempotency** | `Idempotency-Key` on every mutation, including `DELETE` |
| **Success bodies** | Bare top-level objects — the resource itself, not `{ "distribution": {…} }` |
| **Lists** | `{ "object": "list", "data": [...], "has_more": boolean }` |
| **Pagination** | `?limit=` (1–100, default 20) and `?starting_after=<id>` |
| **Ids** | Prefixed on output (`dist_`, `dep_`, `enr_`, …), accepted with or without the prefix |
| **Errors** | `{ "error": { "code", "message", "param", "request_id" } }` |

Authentication runs **before** any id resolution, so an unauthenticated probe
always answers `401`, never a `404` that would reveal whether an object exists.

Full detail: [Authentication](/concepts/authentication/) and
[Errors](/sdk/errors/).

## Resources

| Route family | SDK client |
| --- | --- |
| `/programs`, `/programs/{id}/requirements`, `/tiers`, `/connect_config`, `/handoff_config` | [`programs`](/sdk/resources/programs/) |
| `/partnerships` | [`partnerships`](/sdk/resources/partnerships/) |
| `/enrollments` | [`enrollments`](/sdk/resources/enrollments/) |
| `/connections` | [`connections`](/sdk/resources/connections/) |
| `/distributions` | [`distributions`](/sdk/resources/distributions/) |
| `/deployments` | [`deployments`](/sdk/resources/deployments/) |
| `/performance/summary`, `/performance/events` | [`performance`](/sdk/resources/performance/) |
| `/events` | [`events`](/sdk/resources/events/) |
| `/operations` | [`operations`](/sdk/resources/operations/) |
| `/webhook_endpoints` | [`webhooks`](/sdk/resources/webhooks/) |
| `/payouts`, `/payouts/batches` | [`payouts`](/sdk/resources/payouts/) |

## Three composite responses

Almost everything is a bare object. The exceptions are deliberate and small:

```jsonc
// POST /distributions/{id}/launch → 202
{ "distribution": "dist_...", "status": "launching", "operation": "op_..." }

// POST /distributions/{id}/pause|resume|cancel → 202
// POST /deployments/{id}/pause|resume|cancel   → 202
{ "id": "dist_...", "object": "distribution", /* … */ "operation": "op_..." }

// webhook_endpoints create/retrieve/update/rotate_secret
{ "webhook_endpoint": { "id": "we_...", /* … */ } }
```

Launch returns **id strings**, never embedded objects. It is never a synchronous
success — the [operation](/sdk/resources/operations/) is the progress surface.

## A raw request

```bash
curl -sS https://api.boomin.ai/v1/platform/distributions \
  -H "Authorization: Bearer $BOOMIN_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "name": "Spring launch",
    "objective": "launch",
    "programs": ["prog_..."],
    "budget": { "mode": "funded", "asset": "credit", "total": 50000 }
  }'
```

## Interactive reference

- [Platform API reference](/api/platform/)
- [Platform OpenAPI YAML](/openapi/platform.yaml)

## Smoke tests

```bash
npx @boomin/cli platform smoke --read-only --token sk_boomin_live_...
npx @boomin/cli platform smoke --write --cleanup --token sk_boomin_live_...
npx @boomin/cli platform smoke --all-scopes --cleanup --json
```

`--all-scopes` exercises every registered scope through the platform scope
executor. It is designed for agents: it proves each scope is enforceable,
audited, and wired into the rate-limit and idempotency surface without needing
every product CRUD route in the same run.

## Legacy RPC surface

The pre-v1 RPC routes under `/v1/platform` remain functional — CLI 0.2.0, MCP,
and existing integrations depend on them. New work should use the REST tree
above and `@boomin/sdk`.

## Key management

Creating, rotating, and revoking keys requires a logged-in Boomin user, so it
lives in the app under **Developers** and in
[`npx @boomin/cli token`](/cli/tokens/) — not on this API.
