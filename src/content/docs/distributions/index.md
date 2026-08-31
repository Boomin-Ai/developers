---
title: Distributions
description: What a distribution is, when you need one, and the shape of the whole surface.
---

A **distribution** is a coordinated business objective that fans out into
concrete executions. It is intent — and only intent.

If you have used Stripe: a Distribution is Boomin's `PaymentIntent`. You declare
what you want to happen, Boomin does the fanning out, and an
[Operation](/sdk/resources/operations/) reports back what actually happened.

```js
const distribution = await boomin.distributions.create({
  name: "Spring launch",
  objective: "launch",
  programs: ["prog_..."],
  budget: { mode: "funded", asset: "credit", total: 50000 },
});

await boomin.distributions.validate(distribution.id);
const { operation } = await boomin.distributions.launch(distribution.id);
await boomin.operations.wait(operation, { timeout: 120000 });
```

## Do you need one?

Very possibly not — and that is not a trick question.

Boomin runs entity distribution on **two rails**, and the first one has no
distributions in it at all:

| | Evergreen program | Distribution |
| --- | --- | --- |
| What it is | An always-on referral/affiliate program | A time-boxed, funded, measurable push |
| Setup | Create a program, invite, approve | Everything on the left, **plus** a distribution |
| Attribution | One program `referralCode` per enrollment | One promo link per entity per **deployment** |
| Budget | None — rewards accrue | Optional `metered` or `funded` reservation |
| Lifecycle | Runs until paused or archived | `draft` → `ready` → `launching` → `active` → `completed` |
| Good for | Ambassador and affiliate programs | Launches, drops, events, seasonal pushes |

The rails compose. The program is the durable relationship layer; distributions
are what you run *through* it. Program activity that happens outside any
distribution stays on the program rail permanently and keeps feeding
qualification.

Read [The distribution model](/concepts/model/) for the full comparison.

## The pieces

```txt
Distribution      intent — objective, programs, budget, spec
  Deployment      execution — one concrete thing running somewhere
    Performance   measurement, recorded against the deployment
Operation         the async progress surface for every mutation
```

| Page | What it covers |
| --- | --- |
| [Lifecycle & launching](/distributions/lifecycle/) | Every status transition, validate, launch, pause, resume, cancel |
| [Deployments](/distributions/deployments/) | Fan-out, `deploymentKey`, desired vs observed, per-entity promo links |
| [Budgets](/distributions/budgets/) | `none` / `metered` / `funded`, reservation, drawdown, release |
| [Performance](/distributions/performance/) | Ingesting conversions and reading rollups |
| [Payouts](/distributions/payouts/) | From measured value to money out |

## What a distribution is not

- **Not a campaign.** There is no `kind` column, no channel column, and no
  program column. A distribution can reference many programs.
- **Not a post.** It never says "publish to Instagram". You express intent
  through the deployment plan, and an internal adapter resolves it.
- **Not synchronous.** `launch` answers `202` with an operation id. Every
  mutation that does real work behaves the same way.
- **Not a container for content.** `subjects` (an event, offer, or resource)
  are descriptive context. They never create or constrain a deployment, and they
  are excluded from `plan_hash`.

## Where providers live

Instagram, TikTok, Meta Ads and the rest are **internal adapters**. They never
appear in the public API as a resource, a parameter, or a route.

You declare intent in the plan — `mode`, `medium`, `channel`, `format` — and the
registry resolves an adapter, or rejects the combination up front during
`validate()` with `channel_type_not_yet_supported`.

Exactly one adapter is registered today: the Boomin relationship adapter,
supporting `program` / `referral` / `boomin` / `referral_link`. Everything else
fails validation rather than failing at launch, which is the cheap place to
fail.

## Scopes

| Scope | Grants |
| --- | --- |
| `distributions:read` | Read distributions |
| `distributions:write` | Create, update, validate, pause, resume, cancel — plus the deployment verbs |
| `distributions:launch` | Launch. Deliberately separate: spending is not editing |
| `deployments:read` | Read deployments |
| `performance:read` / `performance:write` | Read rollups / ingest measurements |
| `operations:read` | Implicitly granted to every valid token |
