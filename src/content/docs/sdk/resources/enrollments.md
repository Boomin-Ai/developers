---
title: enrollments
description: Invite, approve, reject, pause, and resume a partnership's participation in one program.
---

An **enrollment** is a partnership's participation in exactly one program. It is
where the `referral_code` lives, and it is the unit the evergreen rail runs on.

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

Legacy `program_members:*` scopes are accepted as aliases on already-issued
tokens.

## The enrollment object

```json
{
  "id": "enr_...",
  "object": "enrollment",
  "program": "prog_...",
  "partnership": "pship_...",
  "partner": "ptnr_...",
  "referral_code": "ABC123",
  "approval_status": "approved",
  "status": "active",
  "billing_status": "billable",
  "qualification_status": "qualified",
  "source": "platform_api",
  "metadata": {},
  "livemode": true,
  "joined_at": "2026-08-01T00:00:00.000Z",
  "approved_at": "2026-08-01T00:00:00.000Z",
  "rejected_at": null,
  "created_at": "2026-08-01T00:00:00.000Z",
  "updated_at": "2026-08-01T00:00:00.000Z"
}
```

`qualification_status` is present on `create`, `retrieve`, `approve`, and
`reject` — it comes from the enrollment's evaluated performance, so the pause
and resume responses omit it rather than serve a stale value.

## Two orthogonal fields

This is the single most common source of confusion in the API, so it is worth
stating flatly:

| Field | Values | Moved by |
| --- | --- | --- |
| `approval_status` | `pending` `approved` `rejected` | `approve()` / `reject()` **only** |
| `status` | `active` `paused` `archived` | `pause()` / `resume()` **only** |

Approval commands never touch `status`. Pause and resume never touch
`approval_status`. An enrollment can perfectly well be `(approved, paused)` or
`(pending, active)` — those are not contradictions, they are two different
questions.

`resume` is the canonical verb on every surface. There is no `unpause`.

## create (invite)

```js
// by email — upserts the partner identity
await boomin.enrollments.create({
  program: "prog_...",
  email: "creator@example.com",
  name: "Creator",
  referral_code: "CREATOR10",   // optional; generated when omitted
  metadata: { cohort: "spring" },
});

// or against an existing partner
await boomin.enrollments.create({ program: "prog_...", partner: "ptnr_..." });
```

One of `email` or `partner` is required. `create` answers **201** for a new
enrollment and **200** when one already existed.

In one call it: upserts the partner identity, opens the durable partnership as
`pending` if there wasn't one, and creates the enrollment as
`(pending, active)`.

### Re-inviting a rejected enrollment

Rejection is **not** terminal. Re-inviting a rejected enrollment resets
`approval_status` to `pending`, leaving `status` untouched. You may also approve
a previously rejected enrollment directly, without a re-invite.

## approve and reject

```js
await boomin.enrollments.approve("enr_...");
await boomin.enrollments.reject("enr_...");
```

Approval fires a qualification evaluation and **activates the durable
partnership** if it was still `pending`. It is the one flip point where the
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

Billing continues while paused, deliberately: the partner's links still work.
Archiving is the billing exit, and it keeps the `referral_code` for attribution
history.

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

Remember that query params are camel→snake converted by the client
(`approvalStatus` → `approval_status`) but **body** fields are not — send
`referral_code`, not `referralCode`.
