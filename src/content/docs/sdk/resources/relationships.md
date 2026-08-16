---
title: relationships
description: The durable brand ↔ entity bond — pause, resume, end, and permissions. Canonical since RELATIONSHIP_CORE.
---

A **relationship** is the durable bond between one brand and one
[entity](/sdk/resources/entities/). Exactly one exists per `(brand, entity)`
pair, and it outlives every individual program.

This is the canonical name for what the API called a **partnership**. The old
spelling is an alias forever — see the note below.

```js
const page = await boomin.relationships.list({ status: "active", limit: 20 });
const relationship = await boomin.relationships.retrieve("rel_...");
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /relationships` | `relationships:read` |
| `retrieve(id, options)` | `GET /relationships/{id}` | `relationships:read` |
| `pause(id, params, options)` | `POST /relationships/{id}/pause` | `relationships:write` |
| `resume(id, params, options)` | `POST /relationships/{id}/resume` | `relationships:write` |
| `end(id, params, options)` | `POST /relationships/{id}/end` | `relationships:write` |
| `updatePermissions(id, params, options)` | `POST /relationships/{id}/permissions` | `relationships:write` |

## The relationship object

```json
{
  "id": "rel_...",
  "object": "relationship",
  "partner": { "id": "ent_...", "name": "Creator", "email": "creator@example.com" },
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
relationship holds, across all your programs.

:::note[`partnerships` is the deprecated spelling — alias forever]
`boomin.partnerships` still works and always will: it is a deprecated getter
that **delegates** to `boomin.relationships`, so calls ride the canonical
`/relationships` routes. Old `pship_...` ids are accepted everywhere forever;
responses emit `rel_...` and `object: "relationship"`. Legacy `partnerships:*`
scopes stay honored (canonical: `relationships:*`), and webhook subscriptions
naming `partnership.*` still receive the canonical `relationship.*` events.
:::

## Status

`pending` → `active` → (`paused`) → `ended`

- **`pending`** — created at the first invite, before anyone has approved.
- **`active`** — set automatically when the **first** enrollment is approved.
- **`paused`** — set by `pause()`.
- **`ended`** — set by `end()`. Terminal, and it never fires automatically: no
  amount of enrollment rejection, archival, or inactivity ends a relationship.

Every transition emits a canonical event: `relationship.created` ·
`relationship.activated` · `relationship.paused` · `relationship.resumed` ·
`relationship.ended`. See the [event vocabulary](/sdk/resources/events/).

## list

| Param | Values |
| --- | --- |
| `status` | `pending` `active` `paused` `ended` |
| `limit` | 1–100, default 20 |
| `startingAfter` | A `rel_...` cursor |

An unrecognized `status` is `invalid_status` (400), not an empty list.

## pause and resume

`pause()` is the broad brake for one entity. It:

- pauses that entity's **promo links** across every program — never the shared
  deployment channel, so other partners on the same channel keep running,
- blocks the entity from receiving **new** links,
- leaves enrollments and connection grants **untouched** — pause never silently
  rewrites enrollment status, so resume is exact,
- keeps the paused links resolving, so attribution continues; the money stop is
  reward eligibility, decided at the event's `occurredAt`.

```js
const result = await boomin.relationships.pause("rel_...");
console.log(result.linksPaused, result.channels);
// later
await boomin.relationships.resume("rel_...");
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
await boomin.relationships.end("rel_...");
```

Terminal. Rewards stop, billing stops, and the relationship does not resume —
re-inviting the same entity opens a new enrollment against the same identity.

## updatePermissions

```js
await boomin.relationships.updatePermissions("rel_...", {
  permissions: { publish_on_behalf: false },
  rights: { territory: "us" },
  compensationDefaults: { revenue_share_bps: 1500 },
});
```

All three fields are optional JSON objects; the response is the bare
relationship. These are the durable relationship terms — they carry across
every program the entity is enrolled in, and across every distribution that
reaches them.

For **program-level** terms negotiated per member, see
[requirement overrides](/sdk/resources/requirement-overrides/); for what your
brand privately knows about the entity, see
[assertions](/sdk/resources/assertions/).
