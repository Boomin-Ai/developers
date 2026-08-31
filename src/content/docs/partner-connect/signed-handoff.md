---
title: Signed Handoff
description: Let your logged-in app user join a Boomin partner program without a second email OTP.
---

Signed Handoff is the server-side bridge for apps that already have users.

The app authenticates the user, chooses the active account/profile, signs that identity on the server, and sends it to Boomin. Boomin links that external user to a partner program member and starts Instagram OAuth when needed.

## When to use it

Use Signed Handoff when your product already has login:

- SaaS users joining a creator or affiliate program.
- Member profiles that should own referral rewards.
- Apps with Clerk, Supabase, Auth0, Better Auth, or custom auth.

Use the browser OTP flow when the creator is entering from a public page and does not already have an account in your app.

## Install

```bash
npm install @boomin/server
npx @boomin/cli handoff init --framework next --auth custom
```

:::note[Which package?]
`@boomin/server` is **maintenance only** — it exists for the generated handoff
routes below and nothing else. Server-side work against the Platform API
(distributions, enrollments, payouts, webhooks) uses
[`@boomin/sdk`](/sdk/). The deprecated `boominjs` package is superseded by both.
:::

For the full referral-first starter surface, use:

```bash
npx @boomin/cli referral init --framework next --auth custom --write
```

That generates the join route plus a entity status route, `/r/[code]` click tracker, and a `/entity` UI that shows the user their referral link and metrics.

## Next.js route

```js
import { createBoominCreatorJoinHandler } from "@boomin/server/next";

async function getCurrentUser(request) {
  const user = await yourAuthGetCurrentUser(request);
  if (!user) return null;
  return {
    externalUserId: user.id,
    email: user.email,
    name: user.name || user.email,
    metadata: { source: "custom" },
  };
}

export const GET = createBoominCreatorJoinHandler({
  publicKey: process.env.BOOMIN_CONNECT_PUBLIC_KEY,
  programId: process.env.BOOMIN_CONNECT_PROGRAM_ID,
  redirectUri: process.env.BOOMIN_CONNECT_REDIRECT_URI,
  signingSecret: process.env.BOOMIN_HANDOFF_SIGNING_SECRET,
  issuer: "your-app.com",
  loginUrl: "/login",
  getCurrentUser,
});
```

Your frontend button stays simple:

```html
<a href="/api/boomin/creator/join">Join creator program</a>
```

## Payload

The server signs stable JSON with HMAC-SHA256:

```json
{
  "iss": "your-app.com",
  "aud": "boomin.ai",
  "iat": 1779980000,
  "exp": 1779980300,
  "nonce": "uuid",
  "publicKey": "pk_live_...",
  "programId": "program-id",
  "redirectUri": "https://your-app.com/creator-program",
  "externalUserId": "user_123",
  "email": "creator@example.com",
  "name": "Creator Name",
  "metadata": {}
}
```

Boomin verifies the signature, consumes the nonce once, validates the redirect URI, links `externalUserId` to a entity, and returns either an Instagram `authUrl` or the existing member status.

## Security rules

- Never expose `BOOMIN_HANDOFF_SIGNING_SECRET` in browser code.
- Handoff payloads expire in 5 minutes by default.
- Nonces are one-time use.
- Redirect URIs must match the program's allowed redirect origins.
- Public keys are browser-safe; handoff signing secrets are server-only.

## Atlantium reference

Atlantium signs the active Better Auth profile:

```txt
externalUserId = atlantium_profile_<profile_id>
email = Better Auth user email
name = active profile display name
metadata = { atlantiumUserId, atlantiumProfileId, profileType }
```

That lets Atlantium users join the creator program without entering a second email OTP.

## Referral-first status

Signed handoff responses and standing responses include a stable referral surface:

```json
{
  "referral": { "code": "KLEVELAND42", "url": "https://your-app.com/r/KLEVELAND42", "active": true },
  "metrics": { "linkClicks": 4, "signups": 1, "sales": 0, "gmvCents": 0, "productUsage": 0 },
  "approvalStatus": "pending",
  "qualificationStatus": "qualified",
  "requiredChannels": [],
  "missingChannels": []
}
```

If a program requires Instagram, `missingChannels` includes `instagram` until the user connects it. Referral links still exist before channel connection.

## Channel requirements drive the flow

The handoff response's `status` is computed from the surface's `requiredChannels`:

- `requiredChannels: ["instagram"]` — a member without a connected Instagram gets `status: "needs_instagram"`. Send them through the channel connect step before treating them as pending.
- `requiredChannels: []` — the Instagram step is **skipped entirely** and members land at `pending_approval` with no connected channel.

A surface created by `handoff provision` starts with `requiredChannels: []`. If your program expects creators to connect Instagram, set it explicitly after provisioning with the Platform API (or the `Program Operator` MCP pack):

```bash
curl -X POST https://api.boomin.ai/v1/platform/programs/connect-config/update \
  -H "Content-Type: application/json" \
  -d '{ "token": "sk_boomin_live_...", "programId": "<programId>", "requiredChannels": ["instagram"] }'
```

Do not show "Instagram is connected" copy on `pending_approval` alone — check the member's connection state. With `requiredChannels` set this cannot normally diverge, but belt-and-suspenders UI copy stays honest.

## Referral link base

`referral.url` is built from the surface's referral base. If unset it falls back to `https://boomin.ai/r/<code>`, which is **not** your app's click tracker — point it at the click-through route on your own domain (the `/r/[code]` route the referral scaffold generates) via connect-config metadata:

```bash
curl -X POST https://api.boomin.ai/v1/platform/programs/connect-config/update \
  -H "Content-Type: application/json" \
  -d '{ "token": "sk_boomin_live_...", "programId": "<programId>", "metadata": { "referralBaseUrl": "https://your-app.com/r" } }'
```

`npx @boomin/cli doctor` warns when the referral route, referral base, or destination env are missing.

Keeping the link on your domain is deliberate: affiliates share it in Instagram bios, Telegram, and Discord, and a brand-domain URL is what people trust enough to click. The route works from any of those — it is a plain HTTP redirect that records the click server-side with your signing secret, so no cookie or JavaScript is required at click time.

## Your app appears as a channel

Provisioning a handoff config for a real issuer automatically installs your app as a channel on that brand's Channels page in Boomin, with live program metrics (clicks, signups, GMV, member counts). Smoke/test issuers (`.local`, `.invalid`, `.test`, `.example`) are ignored.
