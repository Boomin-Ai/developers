---
title: Token Commands
description: Create, list, revoke, and rotate private platform tokens.
---

Platform tokens are private server-side credentials for agents and automation. They are different from Creator Connect public keys.

:::danger
Never put a `sk_boomin_live_...` token in browser code, mobile apps, or customer-visible HTML. Use public `pk_live_...` keys for browser Creator Connect.
:::

## Create

```bash
npx @boomin/cli token create \
  --name "Unit Agent" \
  --scopes org:read,units:read,units:create,units:delete
```

The secret is shown once.

Use `--save` only for local smoke testing:

```bash
npx @boomin/cli token create \
  --name "Local Smoke" \
  --scopes org:read,units:read,units:create,units:delete \
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
