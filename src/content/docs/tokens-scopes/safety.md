---
title: API Safety
description: How Boomin keeps platform tokens safe for agents and server automation.
---

Boomin platform tokens are designed for least-privilege automation.

## Token storage

Boomin stores only token hashes and safe metadata:

- Prefix.
- Name.
- Organization id.
- Scopes.
- Status.
- Created by.
- Last used.
- Expiration and revocation timestamps.

The secret is shown once at creation.

## Rate limit

Object creation is limited to:

```txt
150 creates/hour per org + token + resource family
```

Updates are not create-limited, but they are still audited.

## Idempotency

Create endpoints support `Idempotency-Key`.

- Same key and same body returns the original result.
- Same key and different body returns conflict.
- Retries do not duplicate objects.

## Audit logs

Platform requests are audited without storing token secrets or full sensitive bodies. Audit records are used for debugging, abuse review, and future customer-visible logs.

## Scope failures

Missing scope returns `403`.

The CLI prints the required scope and suggests:

```bash
npx @boomin/cli scopes explain <scope>
```
