---
title: Scope Reference
description: Every scope a platform key can carry.
---

Scope names follow `resource:action`. A route that needs a scope your key lacks
answers `missing_scope` (403) with the message `missing_scope:<scope>`.

```bash
npx @boomin/cli scopes
npx @boomin/cli scopes explain distributions:launch
```

Mint the narrowest key that does the job. See
[Authentication](/concepts/authentication/).

## Distribution core

The scopes the `/v1/platform` distribution tree uses.

| Scope | Purpose |
| --- | --- |
| `org:read` | Read current organization context. |
| `distributions:read` | Read distributions. |
| `distributions:write` | Create, update, validate, pause, resume, cancel a distribution — and the deployment pause/resume/cancel verbs. |
| `distributions:launch` | Launch a distribution. Deliberately separate from `:write` — this is the scope that spends money. |
| `deployments:read` | Read deployments. Read-only by design. |
| `performance:read` | Read performance rollups. |
| `performance:write` | Ingest business measurements. |
| `operations:read` | Read operations. **Implicitly granted to every valid token**, so any key can poll the operations it caused. |
| `events:read` | Read the operational domain-event feed. |
| `payouts:read` | Read the payout ledger, batches, and rail readiness. |
| `payouts:write` | Run a payout period and export batches. |

`performance:write` (measurement in) and `events:read` (the operational feed
out) are explicitly distinct. Holding one never implies the other.

## Relationships

| Scope | Purpose |
| --- | --- |
| `partnerships:read` | Read durable brand ↔ partner relationships. |
| `partnerships:write` | Pause, resume, end, and update partnership permissions. |
| `enrollments:read` | Read program enrollments. |
| `enrollments:write` | Invite, approve, reject, pause, resume enrollments. |
| `connections:read` | Read provider identities and grants. |
| `connections:write` | Revoke a connection or the brand's grants on it. |
| `partners:read` | Reserved for the `partners` routes — see [`partners`](/sdk/resources/partners/). |

Legacy `program_members:read` and `program_members:approve` are accepted as
aliases for the enrollment scopes on already-issued tokens.

## Programs

| Scope | Purpose |
| --- | --- |
| `programs:read` | Read partner programs. |
| `programs:create` | Create partner programs (legacy RPC surface). |
| `programs:update` | Update partner programs (legacy RPC surface). |
| `programs:delete` | Archive partner programs (legacy RPC surface). |
| `program_requirements:read` | Read qualification requirements. |
| `program_requirements:write` | Create, update, or archive requirements. |
| `program_tiers:read` | Read the tier ladder. |
| `program_tiers:write` | Create, update, or archive tiers. |
| `program_resources:read` | Read program resources. |
| `program_resources:write` | Create or update program resources. |
| `connect_config:read` | Read the Partner Connect surface configuration. |
| `connect_config:write` | Update allowed origins and Connect setup. |
| `handoff:read` | Read signed-handoff issuer configuration. |
| `handoff:write` | Mint or rotate a signed-handoff signing secret. |
| `campaigns:read` / `campaigns:write` | Campaigns. |
| `benefits:read` / `benefits:write` | Benefits and entitlements. |
| `webhooks:read` | Read webhook endpoints. |
| `webhooks:write` | Create, update, rotate, and delete webhook endpoints. |

## Content

Public API docs use `series`. Internally, Boomin may still call the same
resource `productions`.

| Scope | Purpose |
| --- | --- |
| `series:read` | Read series. |
| `series:create` | Create series. |
| `series:update` | Update series. |
| `series:delete` | Archive or delete series. |
| `units:read` | Read units. |
| `units:create` | Create units. |
| `units:update` | Update units. |
| `units:delete` | Delete draft units. |
| `units:publish` | Publish units to connected channels. |

## UI and assets

| Scope | Purpose |
| --- | --- |
| `pages:read` / `pages:write` / `pages:delete` | Pages. |
| `canvas:read` / `canvas:write` / `canvas:delete` | Canvases. |
| `files:read` / `files:write` / `files:delete` | Files and folders. |

## Automation and data

| Scope | Purpose |
| --- | --- |
| `agents:read` / `agents:write` / `agents:run` | Agents and runs. |
| `workflows:read` / `workflows:write` / `workflows:run` | Workflows and runs. |
| `contacts:read` | Read contacts. |
| `segments:read` / `segments:write` | Segments. |
| `events:write` | Record safe platform events. |

## Commerce

| Scope | Purpose |
| --- | --- |
| `commerce:read` | Read commerce products, offers, and invoices. |
| `commerce:write` | Create or update safe commerce resources. Excludes billing and payouts. |
