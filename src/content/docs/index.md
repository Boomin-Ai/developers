---
title: Boomin Developers
description: Build creator programs, creator auth, admin approval, and scoped agent automation with Boomin.
template: splash
hero:
  title: Creator-program infrastructure for builders and agents.
  tagline: Add referral programs, account-first Partner Connect, Instagram OAuth, and scoped platform automation — with a hosted Partners dashboard and a public Discover feed for creators.
  image:
    file: ../../assets/boomin-mark.svg
  actions:
    - text: Start with Boomin
      link: /quickstart/
      icon: right-arrow
      variant: primary
    - text: Platform API
      link: /platform-api/
      icon: external
---

## Developer surface

### Install in a customer app

Use `npm install @boomin/connect` to add OTP signup, Instagram connect, and approval status to any browser UI.

### Configure from the CLI

`npx @boomin/cli init` opens Boomin login, creates or selects a program, adds localhost origins, and writes `.env.local`. Add `--list` to put the program on Connect's public Discover feed.

### Operate from the Partners dashboard

Brands run the program at `boomin.ai` under Partners: active partners and views this month, member table with OAuth-verified socials, applications inbox, and the Discover listing toggle.

### Let creators find you

Listed programs appear in the public Discover feed at `boomin.ai/connect`, where creators browse and apply. First 10 active creators free — see [Pricing](/pricing/).

### Automate safely

Private `sk_boomin_live_...` platform tokens are scoped, revocable, audited, idempotent, and create-limited.

### Ship with OpenAPI

Use the interactive API references or download `/openapi/connect.yaml` and `/openapi/platform.yaml`.

## What Boomin owns

Boomin owns the infrastructure that every creator program needs but most teams do not want to rebuild: creator enrollment, email OTP, Instagram OAuth, durable program membership, admin approval, referral codes, creator status, and scoped agent/server automation.

Customer sites own their UI. Boomin provides the SDK, API, OAuth bridge, admin surface, and safe platform tokens.

## Current production surfaces

- `@boomin/connect` browser SDK and `@boomin/cli` CLI.
- Creator Connect API at `https://api.boomin.ai/v1/connect`.
- Public Discover feed at `GET /v1/connect/discover`; creators browse and apply at `boomin.ai/connect`.
- Hosted Partners dashboard for brands at `boomin.ai` (members, applications, verified metrics).
- CLI browser login through `https://boomin.ai/cli/login`.
- Scoped platform tokens with `sk_boomin_live_...` secrets.
- Platform smoke commands for read-only and write/cleanup validation.

## Agent entrypoints

Agents should start with:

```bash
npm install @boomin/connect
npx @boomin/cli init
npx @boomin/cli scopes
```

For machine-readable docs, use [`/llms.txt`](/llms.txt) or [`/llms-full.txt`](/llms-full.txt).
