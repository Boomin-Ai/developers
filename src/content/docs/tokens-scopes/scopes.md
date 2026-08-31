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
| `payouts:write` | Run a payout period; create, export, confirm, and cancel batches. |

`performance:write` (measurement in) and `events:read` (the operational feed
out) are explicitly distinct. Holding one never implies the other.

## Payout configuration

Payout **execution** and payout **configuration** are separate grants. Neither
`payouts:read` nor `payouts:write` implies any of these.

| Scope | Purpose |
| --- | --- |
| `payout_rules:read` | Read payout rules (how a entity earns). |
| `payout_rules:write` | Create, update, or archive payout rules. |
| `payout_rails:read` | Read payout rails and their delivery `config`. |
| `payout_rails:write` | Configure payout rails (where money physically lands). |

`payouts:write` moves money the brand already owes. A rail's column mapping
decides *which field of a payout row lands in the recipient column* of a file a
human uploads to a bank — closer to banking configuration than to payout
execution. So a key that runs the monthly payout job cannot also redirect where
the money goes. Mint the job `payouts:read,payouts:write`, and keep
`payout_rails:write` on a separate, rarely-used key.

For the same reason `payouts.connectStatus()` — a `payouts:read` surface —
reports rail identity and state but never `config`. Read config from
`GET /payouts/rails`, which needs `payout_rails:read`.

See [Getting entities paid](/payouts/#scopes).

## Relationships

| Scope | Purpose |
| --- | --- |
| `relationships:read` | Read durable brand ↔ entity relationships. |
| `relationships:write` | Pause, resume, end, and update relationship permissions. |
| `entities:read` | Read entity identities — see [`entities`](/sdk/resources/entities/). |
| `assertions:read` | Read tenant assertion claims and events. |
| `assertions:write` | Assert and revoke tenant truth (claim-addressed). |
| `operating_types:read` | Read the brand's capacity vocabulary. |
| `operating_types:write` | Create, update, archive, reactivate operating types. |
| `metric_keys:read` | Read the metric vocabulary (built-ins + registered `x:`). |
| `metric_keys:write` | Register, update, archive, reactivate tenant metric keys. |
| `requirement_overrides:read` | Read per-enrollment requirement overrides. |
| `requirement_overrides:write` | Patch, add, disable, clear per-enrollment overrides. |
| `enrollments:read` | Read program enrollments. |
| `enrollments:write` | Invite, approve, reject, pause, resume, set capacity. |
| `connections:read` | Read provider identities and grants. |
| `connections:write` | Revoke a connection or the brand's grants on it. |

Legacy spellings stay honored forever on already-issued tokens:
`relationships:read|write` (→ `relationships:*`), `entities:read`
(→ `entities:read`), and `program_members:read|approve` (→ the enrollment
scopes).

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
