---
title: Roadmap
description: What is live now and what comes next.
---

## Live now

### Distribution core

- `@boomin/sdk` — twelve resource clients over `/v1/platform`.
- Distributions: create, validate, launch, pause, resume, cancel — every
  mutation returns an [Operation](/sdk/resources/operations/).
- Program-grain deployments — one channel per (distribution × program × slot),
  with stable `deploymentKey`s, desired-vs-observed state, and one promo link
  per approved partner.
- Funded and metered [budgets](/distributions/budgets/): wallet reservation at
  launch, exactly-once drawdown, remainder release on cancel.
- [Performance](/distributions/performance/) ingestion with exactly-once keys
  and event-time reward eligibility.
- [Payouts](/distributions/payouts/): period runs, batches, the `csv_batch`
  operator rail, Stripe Connect readiness.
- [Webhooks](/sdk/webhooks/) with `Boomin-Signature`, a 24-hour rotation
  overlap, and a 6-attempt retry schedule.
- The [events feed](/sdk/resources/events/) over the same append-only spine.

### Relationships and programs

- Durable partnerships, program enrollments, and the two orthogonal enrollment
  fields (`approvalStatus` vs `status`).
- Qualification requirements and tiers.
- Connections and per-partnership grants.

### Surfaces

- `@boomin/connect` browser SDK and `@boomin/cli` **0.5.0**.
- Account-first [Partner Connect](/partner-connect/account-first/), email OTP
  before Instagram OAuth, pending approval and admin approve/reject.
- Referral-first scaffold (`referral init`) and signed handoff provisioning
  (`handoff provision`).
- Opt-in [Discover listing](/partner-programs/discover/) (`--list`) with the
  public feed at `GET /v1/connect/discover`.
- Hosted Partners dashboard for brands and the Connect surface for partners at
  `boomin.ai`.
- Plans billed on monthly active partners ([Pricing](/pricing/)).
- Scoped platform keys, CLI key management, and platform smoke tests.
- OpenAPI documents for the Partner Connect and Platform APIs.

## Next

- Adapters beyond the Boomin partnership adapter — owned publication first, then
  paid. The adapter contract does not change when they land.
- SDK methods for the deployment verbs (the routes are already live — see
  [Deployments](/distributions/deployments/)).
- `/v1/platform/partners` routes for the [`partners`](/sdk/resources/partners/)
  client.
- Test mode: `sk_test_` / `pk_test_` keys are reserved and every object already
  carries `livemode`, so no backfill will be needed.
- Hosted customer portals on custom domains.
- Webhook delivery logs in the app.

## Principle

Distribution is intent; deployments are execution; performance is measurement.
Programs stay durable — a distribution runs *through* a program, never instead of
one. Providers are internal adapters and never become public API surface.
