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

For the full referral-first starter surface, use:

```bash
npx @boomin/cli referral init --framework next --auth custom --write
```

That generates the join route plus a partner status route, `/r/[code]` click tracker, and a `/partner` UI that shows the user their referral link and metrics.

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

Boomin verifies the signature, consumes the nonce once, validates the redirect URI, links `externalUserId` to a partner, and returns either an Instagram `authUrl` or the existing member status.

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
