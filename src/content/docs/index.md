---
title: Boomin Developers
description: Programmable distribution infrastructure — relationships, distributions, deployments, and performance through @boomin/sdk and the Platform API.
template: splash
hero:
  title: Programmable distribution infrastructure.
  tagline: Declare a business objective. Boomin fans it out across your entities, tracks what happened, and pays them. One SDK, one API, no provider plumbing.
  image:
    file: ../../assets/boomin-mark.png
  actions:
    - text: Quickstart
      link: /quickstart/
      icon: right-arrow
      variant: primary
    - text: The distribution model
      link: /concepts/model/
      icon: open-book
---

## Start here

```bash
npm install @boomin/sdk
```

```js
import Boomin from "@boomin/sdk";

const boomin = new Boomin(process.env.BOOMIN_SECRET_KEY);

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

A **Distribution** is Boomin's `PaymentIntent`: you declare the objective, Boomin
fans it out into **Deployments** and reports back what actually happened.

## Two rails

**An evergreen program** needs no distribution at all. Create a program, invite
entities, approve them — each approved enrollment gets a referral code,
qualification and tiers evaluate continuously, rewards accrue. That is a
complete product on its own.

**A distribution** layers a time-boxed, funded, measurable push on top of the
same entities, with its own promo link per entity on each deployment channel
and its own budget drawdown.

They compose. [Read the model →](/concepts/model/)

## The surface

### Server SDK

`@boomin/sdk` — twelve resource clients over `/v1/platform`. `fetch` +
WebCrypto only, zero dependencies: Node ≥ 18, Cloudflare Workers, Bun, Deno,
edge. [Install & client →](/sdk/)

### Browser

`@boomin/connect` adds OTP signup, Instagram connect, and approval status to any
UI. Already logged-in users skip the second OTP through
[Signed Handoff](/partner-connect/signed-handoff/).

### CLI

`npx @boomin/cli init` sets up an org, a brand, a program, a Connect surface, and
`.env.local`. Seven Platform v1 groups drive the whole distribution tree from a
terminal. [Command reference →](/cli/reference/)

### MCP and agents

Scoped `sk_boomin_live_...` keys are revocable, audited, idempotent, and
creation-rate-limited — safe to hand to an agent. [Boomin MCP →](/mcp/)

### OpenAPI

Interactive references for [Platform](/api/platform/) and
[Partner Connect](/api/connect/), or download
[`/openapi/platform.yaml`](/openapi/platform.yaml) and
[`/openapi/connect.yaml`](/openapi/connect.yaml).

## What Boomin owns

Entity enrollment, email OTP, Instagram OAuth, durable relationships, approval,
referral codes, qualification and tiers, distribution fan-out, attribution,
budgets, performance rollups, payouts, webhooks, and scoped server automation.

Your site owns its UI. Providers — Instagram, TikTok, Meta Ads — are **internal
adapters**: they never appear in the public API as a resource, a parameter, or a
route.

## Current production surfaces

- Platform API v1 at `https://api.boomin.ai/v1/platform` — Bearer-only, twelve
  resources, typed errors, cursor pagination.
- Partner Connect API at `https://api.boomin.ai/v1/connect`.
- `@boomin/sdk`, `@boomin/connect`, and `@boomin/cli` 0.3.0.
- Public Discover feed at `GET /v1/connect/discover`; entities browse and apply
  at `boomin.ai/connect`.
- Hosted Entities dashboard for brands at `boomin.ai`.
- CLI browser login through `https://boomin.ai/cli/login`.

## Agent entrypoints

```bash
npm install @boomin/sdk
npx @boomin/cli init
npx @boomin/cli scopes
npx @boomin/cli help distribution
```

For machine-readable docs, use [`/llms.txt`](/llms.txt) or
[`/llms-full.txt`](/llms-full.txt).
