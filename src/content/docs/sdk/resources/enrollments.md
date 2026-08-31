---
title: enrollments
description: Invite, approve, reject, pause, and resume a relationship's participation in one program.
---

An **enrollment** is a relationship's participation in exactly one program. It is
where the `referralCode` lives, and it is the unit the evergreen rail runs on.

Enrollments are **flat** — there is no `/programs/{id}/enrollments` nesting. The
payload carries the program.

```js
const enrollment = await boomin.enrollments.create({
  program: "prog_...",
  email: "creator@example.com",
  name: "Creator",
});
await boomin.enrollments.approve(enrollment.id);
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(params, options)` | `POST /enrollments` | `enrollments:write` |
| `list(params, options)` | `GET /enrollments` | `enrollments:read` |
| `retrieve(id, options)` | `GET /enrollments/{id}` | `enrollments:read` |
| `approve(id, params, options)` | `POST /enrollments/{id}/approve` | `enrollments:write` |
| `reject(id, params, options)` | `POST /enrollments/{id}/reject` | `enrollments:write` |
| `pause(id, params, options)` | `POST /enrollments/{id}/pause` | `enrollments:write` |
| `resume(id, params, options)` | `POST /enrollments/{id}/resume` | `enrollments:write` |
| `update(id, params, options)` | `POST /enrollments/{id}` | `enrollments:write` |

Legacy `program_members:*` scopes are accepted as aliases on already-issued
tokens.

Per-member requirement adjustments live on the nested
[`enrollments.requirementOverrides`](/sdk/resources/requirement-overrides/)
subcollection.

## The enrollment object

```json
{
  "id": "enr_...",
  "object": "enrollment",
  "program": "prog_...",
  "relationship": "rel_...",
  "entity": "ent_...",
  "referralCode": "ABC123",
  "approvalStatus": "approved",
  "status": "active",
  "billingStatus": "billable",
  "qualificationStatus": "qualified",
  "operatingType": "otype_...",
  "source": "platform_api",
  "metadata": {},
  "livemode": true,
  "joinedAt": "2026-08-01T00:00:00.000Z",
  "approvedAt": "2026-08-01T00:00:00.000Z",
  "rejectedAt": null,
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```

Raw HTTP responses use the snake_case spellings (`referral_code`,
`approval_status`); the SDK camelCases every response key.

`qualificationStatus` is present on `create`, `retrieve`, `approve`, and
`reject` — it comes from the enrollment's evaluated performance, so the pause
and resume responses omit it rather than serve a stale value.

## Two orthogonal fields

This is the single most common source of confusion in the API, so it is worth
stating flatly:

| Field | Values | Moved by |
| --- | --- | --- |
| `approvalStatus` | `pending` `approved` `rejected` | `approve()` / `reject()` **only** |
| `status` | `active` `paused` `archived` | `pause()` / `resume()` **only** |

Approval commands never touch `status`. Pause and resume never touch
`approvalStatus`. An enrollment can perfectly well be `(approved, paused)` or
`(pending, active)` — those are not contradictions, they are two different
questions.

`resume` is the canonical verb on every surface. There is no `unpause`.

## create (invite)

```js
// by email — upserts the entity identity
await boomin.enrollments.create({
  program: "prog_...",
  email: "creator@example.com",
  name: "Creator",
  referralCode: "CREATOR10",    // optional; generated when omitted
  metadata: { cohort: "spring" },
});

// or against an existing entity
await boomin.enrollments.create({ program: "prog_...", entity: "ent_..." });
```

One of `email` or `entity` is required. `create` answers **201** for a new
enrollment and **200** when one already existed.

In one call it: upserts the entity identity, opens the durable relationship as
`pending` if there wasn't one, and creates the enrollment as
`(pending, active)`.

### Re-inviting a rejected enrollment

Rejection is **not** terminal. Re-inviting a rejected enrollment resets
`approvalStatus` to `pending`, leaving `status` untouched. You may also approve
a previously rejected enrollment directly, without a re-invite.

## approve and reject

```js
await boomin.enrollments.approve("enr_...");
await boomin.enrollments.reject("enr_...");
```

Approval fires a qualification evaluation and **activates the durable
relationship** if it was still `pending`. It is the one flip point where the
relationship becomes real.

## pause and resume

```js
await boomin.enrollments.pause("enr_...");
await boomin.enrollments.resume("enr_...");
```

While an enrollment is paused: links keep resolving, attribution continues,
standing evaluation continues, new deployments skip the enrollment, and
paused-period activity is permanently ineligible for reward grants — decided at
the event's `occurred_at`.

Billing continues while paused, deliberately: the entity's links still work.
Archiving is the billing exit, and it keeps the `referralCode` for attribution
history.

## update — operating capacity

```js
await boomin.enrollments.update("enr_...", { operatingType: "advisor" });
await boomin.enrollments.update("enr_...", { operatingType: null });   // clear
```

`operatingType` takes an [operating-type](/sdk/resources/operating-types/) KEY
(or `otype_...` id); `null` clears the capacity. Typed requirements and money
rules apply only while the enrollment operates in their capacity, and every
change re-evaluates standing. Assigning an archived type answers
`operating_type_archived` (409).

A [Signed Handoff](/partner-connect/signed-handoff/) can carry `operatingType`
on its signed payload, so your app sets the capacity at login time without a
second call.

## list

| Param | Values |
| --- | --- |
| `program` | A `prog_...` id |
| `status` | `active` `paused` `archived` |
| `approvalStatus` | `pending` `approved` `rejected` |
| `limit` | 1–100, default 20 |
| `startingAfter` | An `enr_...` cursor |

```js
for await (const enrollment of boomin.enrollments.list({
  program: "prog_...",
  approvalStatus: "pending",
})) {
  await boomin.enrollments.approve(enrollment.id);
}
```

Query params and body fields are both camel→snake converted by the client
(`approvalStatus` → `approval_status`, `referralCode` → `referral_code`).
Already-snake_case spellings still pass through; raw HTTP callers send
snake_case.
