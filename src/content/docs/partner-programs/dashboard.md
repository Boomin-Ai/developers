---
title: In-app Dashboards
description: The brand-side Partners dashboard and the creator-side Connect surface at boomin.ai.
---

Your app owns the partner-facing UI you scaffold with the CLI. Boomin additionally hosts two in-app surfaces at `boomin.ai` — one for the brand running the program, one for creators.

## Partners — the brand dashboard

Brand admins log into `boomin.ai` and open **Partners** to operate the program:

- **Standing metrics** — active partners and views this month, with month-over-month deltas.
- **Member table** — every partner with their verified social accounts, referral code, and results. Approve or reject members inline.
- **Applications inbox** — applications from the Connect Discover feed; approving one adds the creator to the program as a partner.
- **List on Connect discover** — toggle the program in or out of the public [Discover feed](/partner-programs/discover/).

Metrics are verified by OAuth: creators connect their accounts, so views are platform-verified — not self-reported handles.

## Connect — the creator surface

Creators log into `boomin.ai/connect` to:

- Browse the **Discover feed** of listed programs and apply.
- Track **their applications** and memberships across brands.
- Copy their **referral links** for approved programs.

Once a program approves a creator, a **Partners** tab appears in that creator's workspace.

## How it fits your integration

Nothing here replaces the SDK or scaffolded routes — the `/partner` page in your app is still where your users join and get their referral link. The hosted surfaces are the operations layer on top: the brand reviews and approves in Partners; creators who arrive through Discover manage their side in Connect.

Program plumbing (join, status, referral tracking) is the same underneath in both paths. Start with the [Quickstart](/quickstart/).
