---
title: partnerships
description: The durable brand ↔ partner relationship — pause, resume, end, and permissions.
---

A **partnership** is the durable relationship between one brand and one partner.
Exactly one exists per `(brand, partner)` pair, and it outlives every individual
program.

```js
const page = await boomin.partnerships.list({ status: "active", limit: 20 });
const partnership = await boomin.partnerships.retrieve("pship_...");
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /partnerships` | `partnerships:read` |
| `retrieve(id, options)` | `GET /partnerships/{id}` | `partnerships:read` |
| `pause(id, params, options)` | `POST /partnerships/{id}/pause` | `partnerships:write` |
| `resume(id, params, options)` | `POST /partnerships/{id}/resume` | `partnerships:write` |
| `end(id, params, options)` | `POST /partnerships/{id}/end` | `partnerships:write` |
| `updatePermissions(id, params, options)` | `POST /partnerships/{id}/permissions` | `partnerships:write` |

## The partnership object

```json
{
  "id": "pship_...",
  "object": "partnership",
  "partner": { "id": "ptnr_...", "name": "Creator", "email": "creator@example.com" },
  "status": "active",
  "rights": {},
  "permissions": {},
  "compensationDefaults": {},
  "source": "platform_api",
  "livemode": true,
  "startedAt": "2026-08-01T00:00:00.000Z",
  "endedAt": null,
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```

`retrieve` additionally embeds `enrollments: [...]` — every enrollment this
partnership holds, across all your programs.

## Status

`pending` → `active` → (`paused`) → `ended`

- **`pending`** — created at the first invite, before anyone has approved.
- **`active`** — set automatically when the **first** enrollment is approved.
- **`paused`** — set by `pause()`.
- **`ended`** — set by `end()`. Terminal, and it never fires automatically: no
  amount of enrollment rejection, archival, or inactivity ends a partnership.

## list

| Param | Values |
| --- | --- |
| `status` | `pending` `active` `paused` `ended` |
| `limit` | 1–100, default 20 |
| `startingAfter` | A `pship_...` cursor |

An unrecognized `status` is `invalid_status` (400), not an empty list.

## pause and resume

`pause()` is the broad brake for one partner. It:

- pauses that partner's **promo links** across every program — never the shared
  deployment channel, so other partners on the same channel keep running,
- blocks the partner from receiving **new** links,
- leaves enrollments and connection grants **untouched** — pause never silently
  rewrites enrollment status, so resume is exact,
- keeps the paused links resolving, so attribution continues; the money stop is
  reward eligibility, decided at the event's `occurredAt`.

```js
const result = await boomin.partnerships.pause("pship_...");
console.log(result.linksPaused, result.channels);
// later
await boomin.partnerships.resume("pship_...");
```

The response includes `linksPaused` / `linksResumed` — the promo-link codes the
verb actually moved — plus `channels`, the `dep_...` ids those links live on
(wire fields: `links_paused` / `links_resumed` / `channels`). On resume, only
links on a channel the brand still wants live come back; a paused or canceled
channel outranks the relationship.

:::caution[Pausing is not a billing exit]
Activity that occurs while paused is **permanently ineligible for reward
grants** — resolved at the event's `occurred_at`, not at ingestion, so a
late-arriving provider sync cannot smuggle a paused-period conversion into
rewards.

Billing is unaffected: links still resolve and attribute, so the partner still
counts as active that month. `end()` (or archiving the enrollment) is the
billing exit. See [Pricing](/pricing/).
:::

## end

```js
await boomin.partnerships.end("pship_...");
```

Terminal. Rewards stop, billing stops, and the relationship does not resume —
re-inviting the same partner opens a new enrollment against the same partner
identity.

## updatePermissions

```js
await boomin.partnerships.updatePermissions("pship_...", {
  permissions: { publish_on_behalf: false },
  rights: { territory: "us" },
  compensationDefaults: { revenue_share_bps: 1500 },
});
```

All three fields are optional JSON objects; the response is the bare
partnership. These are the durable relationship terms — they carry across every
program the partner is enrolled in, and across every distribution that reaches
them.
