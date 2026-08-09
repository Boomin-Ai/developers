---
title: connections
description: Provider identities owned by a partner or a brand, and the grants that let a partnership use them.
---

A **connection** is a provider identity — a social profile, an ad account, a
page, a pixel, a payout account. It is owned by exactly one side: a partner
**or** a brand, never both.

A **grant** is one partnership's right to use a connection. That split is what
lets a creator connect their Instagram once and let three brands use it, each
revocable independently.

```js
const page = await boomin.connections.list({ limit: 20 });
const connection = await boomin.connections.retrieve("conn_...");
await boomin.connections.revoke("conn_...");
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /connections` | `connections:read` |
| `retrieve(id, options)` | `GET /connections/{id}` | `connections:read` |
| `revoke(id, params, options)` | `POST /connections/{id}/revoke` | `connections:write` |

## The connection object

```json
{
  "id": "conn_...",
  "object": "connection",
  "kind": "social_profile",
  "provider": "instagram",
  "providerAccountId": "17841400000000000",
  "owner": { "type": "partner", "id": "ptnr_..." },
  "status": "connected",
  "scopes": ["instagram_basic"],
  "livemode": true,
  "grants": [
    {
      "partnership": "pship_...",
      "permissions": {},
      "grantedAt": "2026-08-01T00:00:00.000Z",
      "revokedAt": null
    }
  ],
  "connectedAt": "2026-08-01T00:00:00.000Z",
  "disconnectedAt": null,
  "lastSyncAt": "2026-08-01T00:05:00.000Z",
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:05:00.000Z"
}
```

Raw HTTP responses use the snake_case spellings (`provider_account_id`,
`connected_at`); the SDK camelCases every response key.

`grants` appears on `retrieve` only, and only for connections you reach *through*
a grant. `kind` is one of `social_profile`, `ad_account`, `page`, `pixel`,
`payout`.

`owner.id` is a `ptnr_...` id for partner-owned connections and the raw brand id
for brand-owned ones.

## Visibility

A connection is visible to your token when either:

- your brand **owns** it, or
- a live (non-revoked) grant reaches it through one of your partnerships.

Anything else is `connection_not_found` (404) — identical to "does not exist",
because existence is never leaked across tenants.

## revoke

Revocation means different things depending on who owns the identity, and the
difference is deliberate:

| Owner | What `revoke()` does |
| --- | --- |
| **Brand** (yours) | Revokes the connection itself — `status: "revoked"`, `disconnectedAt` set |
| **Partner** | Revokes **your grants** on it. The identity is the partner's; you can only sever your own access |

```js
const result = await boomin.connections.revoke("conn_...");
console.log(result.revokedGrants); // 0 for brand-owned, n for partner-owned
```

Revoking a connection that is already revoked — or one where every grant of
yours is already revoked — raises `connection_not_revocable` (409).

## Providers never leak

Instagram, TikTok, Meta Ads and the rest are **internal adapters**. `provider`
appears on a connection because a connection *is* a provider identity, but you
never name a provider anywhere else in the API: not as a resource, not as a
route, not as a distribution parameter. You express intent through the
deployment plan's `mode` / `medium` / `channel` / `format`, and the registry
resolves an adapter — or refuses the combination during
[`validate()`](/sdk/resources/distributions/).

## Authorization flows

Connecting an account (OAuth, token refresh, capability discovery) happens on
the Partner Connect browser surface and in the app, not on this client. The
client covers what a server needs: enumerate what exists, inspect a grant, sever
access.
