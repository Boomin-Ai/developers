---
title: assertions
description: Tenant truth — claim-addressed facts your backend asserts about an entity, without handing Boomin the underlying data.
---

An **assertion** is a fact your backend states about an entity: *this user is a
verified advisor*, *this member's subscription is active*, *this account passed
KYC*. Your system computes the condition privately and asserts only the
**outcome** — Boomin never sees the underlying data, and
[requirements](/sdk/resources/programs/#programsrequirements) can gate standing
on the claim via the `assert:` metric namespace.

```js
await boomin.assertions.create({
  externalUserId: "your_user_42",
  issuer: "yourapp.com",
  key: "advisor_verified",
  value: true,
  expiresAt: "2027-01-01T00:00:00Z",
});
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(params, options)` | `POST /assertions` | `assertions:write` |
| `revoke(params, options)` | `POST /assertions/revoke` | `assertions:write` |
| `list(params, options)` | `GET /assertions` | `assertions:read` |
| `retrieveEvent(id, options)` | `GET /assertions/{id}` | `assertions:read` |

## Claims are the state; events are the history

Assertions are **claim-addressed**: the unit you assert and revoke is
`(subject, key)`, never an `asrt_...` id. Every assert and revoke appends an
immutable **event** (readable with `retrieveEvent` and `list`), and the current
claim is whatever the newest event says. There is no `del` — history is never
rewritten.

The subject is one of:

- **`entity`** — an `ent_...` id, or
- **`externalUserId` + `issuer`** — *your* user id under *your* issuer, the
  same pair a [Signed Handoff](/partner-connect/signed-handoff/) binds. This is
  the form a backend usually holds, and the two always travel together.

## The assertion event object

```json
{
  "id": "asrt_...",
  "object": "assertion",
  "entity": "ent_...",
  "key": "advisor_verified",
  "action": "asserted",
  "value": 1,
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "effectiveAt": "2026-08-16T00:00:00.000Z",
  "livemode": true
}
```

`value` is numeric on the wire — `true`/`false` you send become `1`/`0`.
Numbers pass through, so a claim can carry a magnitude
(`{ key: "portfolio_companies", value: 12 }`) and requirements can threshold
on it.

## create (assert)

```js
await boomin.assertions.create({
  entity: "ent_...",             // or externalUserId + issuer
  key: "advisor_verified",       // lowercase slug, ^[a-z][a-z0-9_]{0,63}$
  value: true,                   // boolean or finite number
  expiresAt: "2027-01-01T00:00:00Z",  // optional, RFC 3339, must be future
});
```

Answers **201** when the claim changed, **200** when it was already in that
state (idempotent by content). Re-asserting the same value with a **fresh
`expiresAt` extends the claim** — a refreshed expiry is a new event on the same
claim, so periodic re-assertion from your backend is the natural pattern.

Every change **re-evaluates standing** for the entity's enrollments
automatically. A transition into or out of qualification emits
`enrollment.qualified` / `enrollment.disqualified` — see
[events](/sdk/resources/events/).

## revoke

```js
await boomin.assertions.revoke({
  externalUserId: "your_user_42",
  issuer: "yourapp.com",
  key: "advisor_verified",
});
```

Claim-addressed, like create. Revocation appends a `revoked` event; the claim
then reads as absent. Idempotent — revoking an absent claim answers 200.

:::caution[Revocation can disqualify immediately]
A requirement on `assert:advisor_verified` with no explicit `failurePolicy`
uses **`immediate`** — hard invalidation is the default for assertion-backed
gates, because "no longer verified" usually must not linger through a grace
window. Set `failurePolicy: "grace"` on the requirement (or per enrollment via
an [override](/sdk/resources/requirement-overrides/)) when you want the softer
behavior. Non-assertion requirements default to `grace`.
:::

Expiry behaves like revocation without the event: an expired claim reads as
absent (`value` resolves to `0` in the evaluator) from `expiresAt` onward.

## list

Current claims for **one subject**:

```js
const page = await boomin.assertions.list({ entity: "ent_..." });
// or { externalUserId, issuer }
```

| Param | Values |
| --- | --- |
| `entity` **or** `externalUserId`+`issuer` | The subject (required) |
| `key` | Filter to one claim |
| `includeExpired` | `true` to include expired claims |
| `limit` / `startingAfter` | Standard pagination |

## Gating standing on a claim

Reference a claim from any requirement with the `assert:` namespace:

```js
await boomin.programs.requirements.create("prog_...", {
  scope: "program_maintenance",
  metricKey: "assert:advisor_verified",
  operator: "exists",
});
```

`exists` passes while the claim is present, unexpired, and non-zero. Numeric
claims work with `gte`/`lte`/`eq`/`neq` and `threshold`. Test the effect
without touching state using
[`programs.standingPreview`](/sdk/resources/programs/#programsstandingpreview)
— it can *simulate* claims before you assert them, and the CLI wraps it as
`boomin standing test`.

## From your server

[`@boomin/server`](/partner-connect/signed-handoff/) ships `assert` and
`revokeAssertion` helpers that take the platform key and the
`externalUserId`+`issuer` address directly — the natural fit for calling out of
your own verification and billing webhooks.
