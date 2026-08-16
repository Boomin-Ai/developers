---
title: The relationship model
description: Entity, Relationship, Enrollment — the relationship stack — plus Distribution, Deployment, Performance, and the two rails a brand can run them on.
---

Boomin is a programmable relationship engine, and distribution is what it runs
over those relationships. Everything in the Platform API is one of six nouns,
plus an **Operation** that carries async work.

The first three are **the relationship stack** — two peers and the durable
bond between them:

```txt
        YOUR BRAND ─────────── Relationship ─────────── Entity
                                (rel_...)              (ent_...)
                                    │
        what the bond carries       │       what each peer contributes
        ────────────────────       │       ─────────────────────────
        Enrollment (enr_...)  — participation in ONE program
          · operating type    — the CAPACITY the entity acts in (otype_...)
          · requirement       — negotiated per-member terms (ovr_...)
            overrides
        Assertions (asrt_...) — facts YOUR system states about the entity,
                                without handing Boomin the underlying data
```

Both peers stay thin; the **relationship is where the richness lives** —
terms, capacity, negotiated policy, and the tenant truth your backend asserts.

```txt
Entity             a durable identity you have relationships with
  Relationship     the durable brand ↔ entity bond (program-independent)
    Enrollment     that relationship's participation in ONE program

Distribution       intent — a coordinated objective. Never an execution mode.
  Deployment       execution — one concrete thing running somewhere
    Performance    measurement, recorded against the deployment
```

A **Distribution** is Boomin's `PaymentIntent`: you declare the objective, Boomin
fans it out into **Deployments** and reports back what actually happened.

## The nouns

### Entity

A durable identity you have relationships with: a creator, an affiliate, an
advisor, an agency, another company. Entities exist independently of any one
program, and you never create them directly — inviting someone by email
upserts the identity for you.

Read-only in the API: `boomin.entities.list()`, `boomin.entities.retrieve(id)`.
(*Partner* is the legacy name; `boomin.partners` delegates here forever.)

### Relationship

The durable bond between one brand and one entity. Exactly one relationship
exists per `(brand, entity)` pair, and it outlives any individual program.
(*Partnership* is the legacy name; aliased forever.)

`status`: `pending` → `active` → (`paused`) → `ended`.

- Created **pending** at the first invite.
- Flips to **active** when the first enrollment is approved.
- `pause()` pauses that entity's promo **links** across every program — never
  the shared deployment channel. Enrollments and connection grants are preserved
  untouched, and the paused links keep resolving, so attribution continues.
- `end()` is the explicit terminal command. It never fires automatically.

Three primitives make the relationship *programmable* rather than a flat row:

- **[Assertions](/sdk/resources/assertions/)** — tenant truth. Your backend
  computes a private condition (verification, membership, KYC) and asserts
  only the outcome; requirements gate standing on the claim via
  `assert:<key>`, and revocation or expiry de-qualifies. Boomin never sees the
  underlying data.
- **[Operating types](/sdk/resources/operating-types/)** — capacity. Your
  vocabulary for *how* an entity participates (advisor, reseller, agency);
  typed requirements and money rules apply only to enrollments operating in
  that capacity.
- **[Requirement overrides](/sdk/resources/requirement-overrides/)** —
  negotiated terms. Patch, suppress, or add requirements for one enrollment;
  effective policy is `program ∘ operating type ∘ enrollment`.

The fact vocabulary these evaluate over is extensible too:
[**metric keys**](/sdk/resources/metric-keys/) let a brand register its own
`x:`-namespaced metrics by API call — with each surface admitting exactly the
vocabulary its rail can execute.

### Enrollment

A partnership's participation in one program. This is where the referral code
lives (`referralCode` is unique per program by design).

Enrollments carry **two orthogonal fields** — this trips people up, so be
precise:

| Field | Values | Moved by |
| --- | --- | --- |
| `approvalStatus` | `pending` `approved` `rejected` | `approve()` / `reject()` only |
| `status` | `active` `paused` `archived` | `pause()` / `resume()` only |

Approval commands never touch `status`. Pause/resume never touch
`approvalStatus`. Rejection is **not terminal** — re-inviting a rejected
enrollment resets approval to `pending`, and you may approve a previously
rejected enrollment directly.

`resume` is the canonical verb on every surface. There is no `unpause`.

### Distribution

Intent, and only intent. A distribution says *what business outcome you want*
and *which programs supply eligible partners*; it never says "post to
Instagram". It carries:

- an `objective` (open text; the suggested set is `awareness`, `acquisition`,
  `launch`, `conversion`, `retention`, `event_promotion`, `custom`),
- `programs` — the programs whose approved enrollments are eligible,
- an optional `budget` (`none` | `metered` | `funded`),
- a `spec` — the deployment plan,
- optional `subjects` — descriptive context (an event, offer, or resource) that
  never constrains execution.

There is no `kind` column and no program column. A distribution is not a
campaign, not a channel, and not a post.

### Deployment

Execution truth. Launching a distribution fans it out into one deployment per
(program × planned slot) — a **channel**, never a person — each with a stable
`deploymentKey` like `program_<id>:boomin:referral_link:primary`. The adapter
mints one promo link per approved partner beneath each partner-program channel;
per-partner attribution rides on each performance event's `enrollment`.

A deployment separates what you asked for from what the world reports back:

- **desired** — `status`: `active` | `paused` | `canceled`
- **observed** — `observedStatus`: `pending` | `provisioning` | `live` |
  `paused` | `pending_review` | `rejected` | `failed` | `completed` | `unknown`

### Performance

Measurement, always recorded against a deployment. Ingest business events with
`boomin.performance.events.create(...)`; read rollups with
`boomin.performance.summary(...)`.

### Operation

Every external mutation returns an **Operation** — launch, pause, resume,
cancel. Operations are the progress surface; they are never "the response you
were waiting for". Statuses: `pending`, `running`, `waiting`, `succeeded`,
`partial`, `failed`, `canceled`.

`operations:read` is granted to every valid token implicitly, so any key can
poll the operations it caused.

## The two rails

This is the part worth reading twice. A brand can run partner distribution on
**either** of two rails, and they compose.

### Rail 1 — an evergreen program, no distribution

The classic referral/affiliate rail. It needs no distribution at all.

1. Create a program, invite partners (`enrollments.create`), approve them.
2. Each approved enrollment gets a program `referralCode`.
3. Qualification requirements and tiers evaluate continuously from tracked
   activity.
4. Rewards and payouts accrue against the program.

Nothing is launched. Nothing is budgeted. The program simply *runs*, and it
keeps running until you pause or archive the enrollment. Activity on this rail
is written as program metric events and feeds qualification and rewards.

```js
const enrollment = await boomin.enrollments.create({
  program: "prog_...",
  email: "creator@example.com",
});
await boomin.enrollments.approve(enrollment.id);
// enrollment.referralCode is live. That is the whole rail.
```

### Rail 2 — a distribution layered on top

A distribution is a *time-boxed, funded, measurable push* that uses the same
partners.

1. Create a distribution referencing one or more programs.
2. Validate, then launch.
3. Boomin creates **one deployment per (program × slot)** — a shared channel
   whose adapter mints one promo link per approved partner, distinct from the
   program's evergreen referral code.
4. Conversions route by deployment and carry their own `enrollment`, so two
   distributions sharing the same program credit separately — each has its own
   channel and links.
5. A funded budget draws down as rewards are granted, and the unconsumed
   remainder is released when the distribution is canceled or completed.

```js
const distribution = await boomin.distributions.create({
  name: "Spring launch",
  objective: "launch",
  programs: ["prog_..."],
  budget: { mode: "funded", asset: "credit", total: 100000 },
});
await boomin.distributions.validate(distribution.id);
const { operation } = await boomin.distributions.launch(distribution.id);
```

### Choosing a rail

| | Evergreen program | Distribution |
| --- | --- | --- |
| Lifecycle | Runs until paused/archived | `draft` → `ready` → `launching` → `active` → `completed` |
| Attribution | One program referral code per enrollment | One promo link per partner per **deployment** |
| Budget | None (rewards accrue) | Optional `metered` or `funded` reservation |
| Measurement | Program metric events → qualification, rewards | Performance events → deployment/distribution rollups |
| Pausing | Pause an enrollment | Pause the distribution or one deployment |
| Good for | Always-on affiliate/ambassador programs | Launches, drops, events, seasonal pushes |

The rails are not exclusive. The evergreen program is the durable relationship
layer; distributions are what you run *through* it. Program activity that
happens outside any distribution stays on the program rail permanently — it is
not migrated, and it keeps feeding qualification.

## Pausing, money, and event time

Pausing has deliberately asymmetric consequences, and they are resolved at
**event time** (when the activity occurred), not at ingestion time:

| While paused | Links resolve | Attribution | Rewards | Billing |
| --- | --- | --- | --- | --- |
| Enrollment paused | yes | continues | **stops** | continues |
| Partnership paused | yes | continues | **stops** | continues |
| Enrollment archived | code retained for history | — | stops | stops |
| Partnership ended | — | — | stops | stops |

Pausing never dodges the active-partner fee while the partner's links still
resolve. `archive` and `partnership.end` are the billing exits. See
[Pricing](/pricing/) for what "active partner" means.

## Where providers live

Instagram, TikTok, Meta Ads and the rest are **internal adapters**. They never
appear in the public API as a resource, a parameter, or a route. You express
intent (`mode` / `medium` / `channel` / `format` in the deployment plan) and the
registry resolves an adapter — or rejects the combination up front with
`channel_type_not_yet_supported` during `validate()`.

Today exactly one adapter is registered: the Boomin partnership adapter, which
supports `partner_program` / `referral` / `boomin` / `referral_link`. Everything
else fails validation rather than failing at launch.
