---
title: enrollments.requirementOverrides
description: Negotiated per-enrollment terms — patch a program requirement, suppress it, or add one for a single member.
---

A **requirement override** adjusts program policy for **one enrollment**: the
negotiated-contract layer. Effective policy is always
`program defaults ∘ operating-type scoping ∘ enrollment overrides` — the
override merges first, then capacity and scope filters apply.

```js
// This member qualifies at 500 instead of the program's 1000:
await boomin.enrollments.requirementOverrides.create("enr_...", {
  requirement: "<requirement uuid>",
  threshold: 500,
});
```

| Method | Route | Scope |
| --- | --- | --- |
| `create(enrollmentId, params, options)` | `POST /enrollments/{id}/requirement_overrides` | `requirement_overrides:write` |
| `list(enrollmentId, params, options)` | `GET /enrollments/{id}/requirement_overrides` | `requirement_overrides:read` |
| `retrieve(enrollmentId, id, options)` | `GET /enrollments/{id}/requirement_overrides/{ovrId}` | `requirement_overrides:read` |
| `update(enrollmentId, id, params, options)` | `POST /enrollments/{id}/requirement_overrides/{ovrId}` | `requirement_overrides:write` |
| `del(enrollmentId, id, options)` | `DELETE /enrollments/{id}/requirement_overrides/{ovrId}` | `requirement_overrides:write` |

Every mutation re-evaluates the enrollment's standing.

## Three modes, one object

| Mode | How | Effect |
| --- | --- | --- |
| **Patch** | `requirement` set, fields present | Named fields replace the program requirement's — `threshold`, `operator`, `windowDays`, `failurePolicy`. Absent fields inherit. |
| **Disable** | `requirement` set, `disabled: true` | The requirement is suppressed for this enrollment. |
| **Add** | `requirement` omitted; full requirement fields | A net-new requirement that exists for this enrollment only. `metricKey` + `scope` required. |

One **active** patch per `(enrollment, requirement)` — a second answers
`requirement_override_already_exists` (409); update or archive the existing
one.

```js
// Suppress a requirement for one member:
await boomin.enrollments.requirementOverrides.create("enr_...", {
  requirement: "<requirement uuid>",
  disabled: true,
});

// Add a member-only gate:
await boomin.enrollments.requirementOverrides.create("enr_...", {
  metricKey: "x:demo_submitted",
  scope: "program_maintenance",
  operator: "gte",
  threshold: 1,
});
```

Added requirements pass the same
[metric vocabulary](/sdk/resources/metric-keys/) gate as program-level ones:
built-ins, active `x:` keys, and `assert:` claims.

## The override object

```json
{
  "id": "ovr_...",
  "object": "requirement_override",
  "enrollment": "enr_...",
  "requirement": "<uuid or null>",
  "disabled": false,
  "threshold": 500,
  "operator": null,
  "windowDays": null,
  "failurePolicy": null,
  "metricKey": null,
  "status": "active",
  "metadata": {},
  "livemode": true
}
```

`requirement` is the program requirement's bare uuid in patch/disable mode and
`null` in add mode. `null` policy fields mean *inherit*.

## The applicability gate

A patch against a requirement that **can never apply** to this enrollment's
current capacity — the requirement is scoped to an operating type the
enrollment doesn't hold — is refused with
`requirement_override_inapplicable` (409) rather than stored: configuration
that looks meaningful but can never execute is a bug factory. Set the
enrollment's [operating type](/sdk/resources/operating-types/) first, then
patch.

An override created while applicable whose enrollment *later* changes capacity
goes **dormant** instead: the patched requirement filters out with its patch,
and wakes if the capacity returns.

## Removing an override

`del` **archives** — the inherited requirement applies again, and the
override's history stays readable. Nothing under an enrollment is ever hard
deleted.

## Provenance

[`programs.standingPreview`](/sdk/resources/programs/#programsstandingpreview)
marks each enrollment's overrides `patched | disabled | added`, so
`boomin standing test` (and your own tooling) can show *why* a member's
effective policy differs from the program's:

```js
const preview = await boomin.programs.standingPreview("prog_...");
// preview.enrollments[n].overrides -> [{ id, requirement, mode }]
```
