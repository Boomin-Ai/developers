---
title: Scope Reference
description: V1 platform token scopes.
---

Scope names follow `resource:action`.

## Setup

| Scope | Purpose |
| --- | --- |
| `org:read` | Read current organization context. |
| `connect_config:read` | Read Creator Connect developer setup. |
| `connect_config:write` | Update Creator Connect allowed origins and setup. |

## Programs

| Scope | Purpose |
| --- | --- |
| `programs:read` | Read creator programs. |
| `programs:create` | Create creator programs. |
| `programs:update` | Update creator programs. |
| `programs:delete` | Archive creator programs. |
| `program_members:read` | Read program members. |
| `program_members:approve` | Approve or reject program members. |
| `program_resources:read` | Read program resources. |
| `program_resources:write` | Create or update program resources. |
| `campaigns:read` | Read campaigns. |
| `campaigns:write` | Create or update campaigns. |
| `benefits:read` | Read benefits and entitlements. |
| `benefits:write` | Create or update benefits. |
| `webhooks:read` | Read webhook sources, endpoints, and deliveries. |
| `webhooks:write` | Create or update webhook configuration. |

## Content

Public API docs use `series`. Internally, Boomin may still call the same resource `productions`.

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
| `pages:read` | Read pages. |
| `pages:write` | Create or update pages. |
| `pages:delete` | Delete pages. |
| `canvas:read` | Read canvases. |
| `canvas:write` | Create or update canvases. |
| `canvas:delete` | Delete canvases. |
| `files:read` | Read files and folders. |
| `files:write` | Upload, register, or move files and folders. |
| `files:delete` | Delete files and folders. |

## Automation and data

| Scope | Purpose |
| --- | --- |
| `agents:read` | Read agents. |
| `agents:write` | Create or update agents. |
| `agents:run` | Run agents or read runs. |
| `workflows:read` | Read workflows. |
| `workflows:write` | Create or update workflows. |
| `workflows:run` | Trigger workflows or read runs. |
| `contacts:read` | Read contacts. |
| `segments:read` | Read segments. |
| `segments:write` | Create or update segments. |
| `events:read` | Read events. |
| `events:write` | Record safe platform events. |

## Commerce

| Scope | Purpose |
| --- | --- |
| `commerce:read` | Read commerce products, offers, and invoices. |
| `commerce:write` | Create or update safe commerce resources. Excludes billing and payouts. |
