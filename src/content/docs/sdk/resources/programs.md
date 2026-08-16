---
title: programs
description: Read programs and configure their requirements, tiers, Partner Connect surface, and signed-handoff issuers.
---

A **program** is the container partners enroll into. It owns the entry
requirements, the tier ladder, the Partner Connect surface, and — through its
enrollments — the referral codes that make the evergreen rail work.

```js
const page = await boomin.programs.list({ limit: 20 });
const program = await boomin.programs.retrieve("prog_...");
```

| Method | Route | Scope |
| --- | --- | --- |
| `programs.list(params, options)` | `GET /programs` | `programs:read` |
| `programs.retrieve(id, options)` | `GET /programs/{id}` | `programs:read` |

:::caution[Programs are created outside the Platform API]
The client object also carries `create()` and `update()`, but the v1 REST tree
does not serve `POST /programs` in this release — those calls 404. Create and
rename programs from the CLI (`npx @boomin/cli init --program-name "…"`) or in
the app. Everything below **is** served.
:::

## The program object

```json
{
  "id": "prog_...",
  "object": "program",
  "name": "Launch Partners",
  "type": "performance",
  "description": null,
  "status": "active",
  "visibility": "private",
  "metadata": {},
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```

`visibility` controls whether the program appears on the public
[Discover feed](/partner-programs/discover/). Programs are private by default.

## programs.requirements

Qualification rules. They evaluate continuously from tracked program activity —
this is the machinery behind the evergreen rail, and it runs whether or not a
distribution ever launches.

```js
await boomin.programs.requirements.create("prog_...", {
  scope: "program_entry",
  metricKey: "followers",
  operator: "gte",
  threshold: 5000,
  required: true,
});

const { data } = await boomin.programs.requirements.list("prog_...");
await boomin.programs.requirements.update("prog_...", requirementId, { threshold: 10000 });
await boomin.programs.requirements.del("prog_...", requirementId);
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(programId, params, options)` | `GET /programs/{id}/requirements` | `program_requirements:read` |
| `create(programId, params, options)` | `POST /programs/{id}/requirements` | `program_requirements:write` |
| `retrieve(programId, id, options)` | `GET /programs/{id}/requirements/{rid}` | `program_requirements:read` |
| `update(programId, id, params, options)` | `POST /programs/{id}/requirements/{rid}` | `program_requirements:write` |
| `del(programId, id, options)` | `DELETE /programs/{id}/requirements/{rid}` | `program_requirements:write` |

Deleting **archives** the requirement (`status: "archived"`, `deleted: true` in
the response) and re-evaluates the program.

### Fields

| Field | Values |
| --- | --- |
| `scope` | `program_entry` `program_maintenance` `tier` `campaign` `benefit` `invite` |
| `scopeId` | The tier/campaign/benefit the rule attaches to, when `scope` is not program-level |
| `metricKey` | See the metric vocabulary below |
| `operator` | `gte` `lte` `eq` `neq` `exists` |
| `threshold` | Integer, or `null` for `exists` |
| `windowDays` | Rolling window; `null` = lifetime |
| `weight` | Integer weight in the score |
| `required` | `true` = a hard gate; `false` = contributes to the score |
| `operatingType` | Optional [capacity](/sdk/resources/operating-types/) key/id — the requirement applies only to enrollments operating as that type |
| `failurePolicy` | `grace` or `immediate`; `null` = the surface default (`immediate` for `assert:` keys, `grace` otherwise) |
| `status` | `active` `paused` `archived` |

### Metric vocabulary

Three namespaces, and the standing surface accepts all three:

- **Built-ins** — `followers`, `views`, `post_count`, `collab_posts`,
  `link_clicks`, `referral_count`, `gmv_cents`, `sales_count`,
  `product_usage_count`, `channel_connected`, `manual_approval`,
  `event_registration`, `template_install`.
- **Tenant keys** — `x:`-namespaced, registered by API call:
  [`metricKeys`](/sdk/resources/metric-keys/). An unregistered or archived
  `x:` key is refused with `metric_key_invalid` and the precise reason.
- **Assertion claims** — `assert:<key>` gates standing on
  [tenant truth](/sdk/resources/assertions/) (`assert:advisor_verified` with
  `operator: "exists"`).

Which namespaces each surface accepts differs on purpose — reward rules take
built-ins ∪ `x:`, payout rules stay built-ins-only in v1. The
[vocabulary ≠ capability table](/sdk/resources/metric-keys/#vocabulary--capability)
is the reference.

Per-enrollment adjustments to any requirement live on
[`enrollments.requirementOverrides`](/sdk/resources/requirement-overrides/).

## programs.tiers

The ladder enrollments climb as requirements are met.

```js
await boomin.programs.tiers.create("prog_...", { name: "Gold", rank: 3 });
const { data } = await boomin.programs.tiers.list("prog_...");
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(programId, params, options)` | `GET /programs/{id}/tiers` | `program_tiers:read` |
| `create(programId, params, options)` | `POST /programs/{id}/tiers` | `program_tiers:write` |
| `retrieve(programId, id, options)` | `GET /programs/{id}/tiers/{tid}` | `program_tiers:read` |
| `update(programId, id, params, options)` | `POST /programs/{id}/tiers/{tid}` | `program_tiers:write` |
| `del(programId, id, options)` | `DELETE /programs/{id}/tiers/{tid}` | `program_tiers:write` |

Tiers are keyed by `rank` — creating a tier at an existing rank upserts it.
Lists come back ordered by ascending rank.

## programs.connectConfig

The [Partner Connect](/partner-connect/browser-sdk/) surface: the public key
your browser code uses, the origins allowed to call it, and what happens when a
partner joins.

```js
const config = await boomin.programs.connectConfig.retrieve("prog_...");
console.log(config.publicKey, config.allowedOrigins);

await boomin.programs.connectConfig.update("prog_...", {
  allowedOrigins: ["https://your-app.com", "http://localhost:5173"],
  allowedRedirectOrigins: ["https://your-app.com"],
  requiredChannels: ["instagram"],
  defaultApprovalStatus: "pending",
});
```

| Method | Route | Scope |
| --- | --- | --- |
| `retrieve(programId, options)` | `GET /programs/{id}/connect_config` | `connect_config:read` |
| `update(programId, params, options)` | `POST /programs/{id}/connect_config` | `connect_config:write` |

`retrieve` answers JSON `null` when the surface has not been minted yet; the
first `update` mints it. `defaultApprovalStatus` accepts `pending` (an
applications inbox) or `approved` (open enrollment).

## programs.handoffConfig

Signing configuration for [Signed Handoff](/partner-connect/signed-handoff/) —
one entry per issuer, so an app with several trusted front ends can rotate them
independently.

```js
const { data } = await boomin.programs.handoffConfig.retrieve("prog_...");

const config = await boomin.programs.handoffConfig.update("prog_...", {
  issuer: "your-app.com",
  audience: "boomin.ai",
});
console.log(config.signingSecret); // present only when just minted or supplied
```

| Method | Route | Scope |
| --- | --- | --- |
| `retrieve(programId, options)` | `GET /programs/{id}/handoff_config` | `handoff:read` |
| `update(programId, params, options)` | `POST /programs/{id}/handoff_config` | `handoff:write` |

`retrieve` returns a `{ object: "list", data, hasMore }` envelope of issuer
configs (filter with `?issuer=`). `update` is create-or-update **per issuer**:
omit `signingSecret` on first call and Boomin mints an `hs_boomin_live_...`
secret, returned in that response only. Pass `signingSecret` explicitly to
rotate it.

## programs.standingPreview

Read-only standing — `programs:read`, and it **persists nothing**: no state,
no run row, no events.

```js
// The whole-program reporting shape:
const preview = await boomin.programs.standingPreview("prog_...");
// counts, requirements, tiers, enrollments with override provenance

// One member's pass/fail through the evaluator's exact read half:
const targeted = await boomin.programs.standingPreview("prog_...", {
  enrollment: "enr_...",
});

// What-ifs — simulate claims and capacity before committing them:
const simulated = await boomin.programs.standingPreview("prog_...", {
  enrollment: "enr_...",
  simulate: {
    assertions: { advisor_verified: true },  // null = simulate absence
    operatingType: "advisor",                // null = simulate untyped
  },
});
```

| Method | Route | Scope |
| --- | --- | --- |
| `standingPreview(id, params, options)` | `POST /programs/{id}/standing_preview` | `programs:read` |

The targeted response's `enrollment` carries the **would-be** `status` next to
`storedStatus` (what the ledger currently says), `met`/`failed` as
`{ requirement, metricKey, scope }` entries, the effective `operatingType`,
and every assertion claim the evaluation saw — simulated overlays flagged
`simulated: true`. Simulation runs through the evaluator's exact read half, so
what the preview says is what a real evaluation would decide.

`simulate` requires `enrollment` — a what-if is asked of one member's
standing. The CLI wraps this as `boomin standing test`:

```bash
npx @boomin/cli standing test --program prog_... --enrollment enr_... \
  --assert advisor_verified=true --operating-type advisor
```
