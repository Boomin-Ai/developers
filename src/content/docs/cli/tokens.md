---
title: Token Commands
description: Create, list, revoke, and rotate private platform tokens.
---

Platform tokens are private server-side credentials for servers and agents. They
are different from [Partner Connect](/partner-connect/browser-sdk/) public keys.

:::danger
Never put a `sk_boomin_live_...` token in browser code, mobile apps, or
customer-visible HTML. Browser code uses the public `pk_live_...` Entity
Connect key.
:::

## Create

```bash
npx @boomin/cli token create \
  --name "Distribution Agent" \
  --scopes org:read,enrollments:read,enrollments:write,distributions:read,distributions:write,distributions:launch,deployments:read
```

The secret is shown once. Mint the narrowest key that does the job —
`distributions:launch` is the scope that spends money, so keep it off keys that
only read.

Use `--save` only for local smoke testing:

```bash
npx @boomin/cli token create \
  --name "Local Smoke" \
  --scopes org:read,distributions:read,deployments:read \
  --save
```

## List

```bash
npx @boomin/cli token list
npx @boomin/cli token list --json
```

Listing returns token metadata only. Secrets cannot be retrieved after creation.

## Revoke

```bash
npx @boomin/cli token revoke <token_id>
```

Revoked tokens return `401` on Platform API requests.

## Rotate

```bash
npx @boomin/cli token rotate <token_id>
```

Rotation revokes the old token and creates a replacement with the same scope set.
