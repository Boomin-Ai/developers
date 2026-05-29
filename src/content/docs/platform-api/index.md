---
title: Platform API
description: Use scoped private tokens to let agents and servers automate Boomin safely.
---

The Platform API is for server-side automation and coding agents.

Use it when you want an agent to create units, manage pages, inspect programs, or run safe platform smoke tests without giving it a full dashboard session.

## Auth

Send a private platform token:

```http
Authorization: Bearer sk_boomin_live_...
```

The API checks:

- Token hash.
- Token status.
- Expiration.
- Owning organization.
- Required scope.

## Current base URL

The CLI currently uses:

```txt
https://api.boomin.ai/v1/platform
```

Token management still uses the dashboard app API because creating, rotating, and revoking tokens requires a logged-in Boomin user. Private token execution uses the dedicated Platform API group above.

## API reference

Open the interactive reference:

- [Platform API reference](/api/platform/)
- [Platform OpenAPI YAML](/openapi/platform.yaml)

## Recommended agent smoke

```bash
npx @boomin/cli token create \
  --name "Agent Smoke" \
  --scopes org:read,units:read,units:create,units:delete

npx @boomin/cli platform smoke --read-only --token sk_boomin_live_...
npx @boomin/cli platform smoke --write --cleanup --token sk_boomin_live_...
npx @boomin/cli platform smoke --all-scopes --cleanup --json
```

The all-scope smoke command exercises every registered V1 scope through `POST /scopes_exec` on the Platform API base. It is designed for agents: it proves the scope is enforceable, audited, and wired into the rate-limit/idempotency surface without requiring every product-specific CRUD surface to be used in the same smoke run.
