---
title: Atlantium Reference
description: The first production-style Creator Connect customer integration.
---

Atlantium is the first customer-style reference integration.

## Public page

```txt
https://atlantium.ai/creator-program
```

The page owns the visual UI. Boomin owns:

- Signed handoff from Atlantium's logged-in profile.
- Instagram OAuth.
- Durable creator session state.
- Program member creation.
- Pending approval status.
- Admin approve/reject.

## Clean redirect URI

```txt
https://atlantium.ai/creator-program
```

The integration intentionally avoids using a stale URL with prior `boomin_status`, `boomin_error`, or hash fragments.

## Expected success state

After OAuth, the creator returns to Atlantium with:

```txt
boomin_session_id=...
boomin_status=pending_approval
boomin_username=...
```

Atlantium then calls `Boomin.getConnectStatus(sessionId)` to read durable state from Boomin.

## Signed handoff

Atlantium authenticates users with Better Auth and signs the active profile into Boomin:

```txt
externalUserId = atlantium_profile_<profile_id>
issuer = atlantium.ai
audience = boomin.ai
```

If the user is not logged into Atlantium, the creator page sends them through Atlantium login first. The older Boomin OTP-first flow remains available as a fallback for public pages without app accounts.

## Referral links on the brand domain

Affiliates share one link, and it lives on Atlantium's domain — not Boomin's:

```txt
https://atlantium.ai/r/<code>
```

A Cloudflare Pages Function at `/r/[code]` proxies the click server-side through Atlantium's API worker — which signs and records a `link_clicks` event on Boomin (with `utm_source`, referrer, and user-agent metadata) — then 302s the visitor to the landing page with `?ref=<code>` attached. Because it is a plain HTTP redirect with no JavaScript or cookies at click time, the link works anywhere an affiliate pastes it: Instagram bios, Telegram, Discord, email. Tracking failures never block the redirect.

The surface's referral base points at this route, so the `referral.url` creators copy from their dashboard is the working brand-domain link.

## Signup attribution

The landing page stores `?ref=` locally with a 30-day window and forwards it as `referral_code` when a visitor completes signup. Atlantium's worker then records a `referral_count` event — only when the verification minted a **new** user, and keyed by user id (`atlantium_signup_<userId>`), so Boomin's event uniqueness makes repeat logins and replays structurally unable to double-credit. Attribution is best-effort and never blocks auth.

Clicks and signups feed the same qualification engine that drives the program's tiers (for Atlantium: entry requires a connected Instagram; Partner requires 10 referred signups; Elite requires $1,000 referred GMV), so tier changes happen automatically as referrals land.

## Channel requirement

The surface sets `requiredChannels: ["instagram"]`, so signed-handoff members are held at `needs_instagram` until they complete Instagram OAuth — the page shows a "Connect Instagram to finish" step rather than claiming a connection that does not exist yet.

## Admin surface

Admins review creators in Boomin:

```txt
Connect > Partners > Members
```

The members table shows account-level creator signal — followers, account type, post count, referral and GMV rollups, and per-requirement qualification state — synced daily from each creator's connected account. Only account-level metrics are read; Boomin never enumerates a creator's posts unless a campaign submission requires verifying a specific post.

Approving a connected creator makes them active and billable for the program.
