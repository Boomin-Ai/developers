---
title: Quickstart
description: Install @boomin/connect, initialize a program, and connect a creator.
---

This is the fastest path to first value: a logged-in user gets a referral link inside your app, then can connect Instagram only when the program requires it.

## Referral-first install

For apps that already have users, start here:

```bash
npm install @boomin/connect @boomin/server
npx @boomin/cli init
npx @boomin/cli referral init --framework next --auth custom --write
npx @boomin/cli handoff provision
npx @boomin/cli doctor
```

- `init` opens Boomin in the browser, logs you in, creates or selects a program, and writes `.env.local`. Add `--list` to list the program on Boomin Connect's public [Discover feed](/partner-programs/discover/); the default is private.
- `referral init` scaffolds `app/api/boomin/partner/join` and `status` routes, an `app/r/[code]` referral redirect tracker, and an `app/partner` page with referral link, copy button, metrics, approval state, qualification state, and optional channel connect action. With `--auth custom`, wire the generated `getCurrentUser` to your auth; `clerk` and `supabase` are prewired.
- `handoff provision` mints the program's handoff signing secret and saves it to `.env.local` so the join route can sign your logged-in users.
- `doctor` verifies the whole install — env, handoff config, referral routes.

When a user clicks join on `/partner`, Boomin creates the partner, the program member, and their referral code in one call. Clicks on `/r/CODE` are tracked from then on — standing metrics show them as link clicks on the partner page and in the [Partners dashboard](/partner-programs/dashboard/).

Referral-only programs use `requiredChannels: []`, so the user can receive their referral link immediately. Instagram is an optional channel requirement, not a dependency of every program. Two settings decide the flow — set them deliberately, then confirm with `npx @boomin/cli doctor`:

- `requiredChannels: ["instagram"]` holds members at `needs_instagram` until they connect; `[]` skips the Instagram step entirely. Provisioned surfaces start at `[]`.
- The referral base must point at your `/r/[code]` route, or `referral.url` falls back to a `boomin.ai` link that is not your tracker.

Both are covered in [Signed handoff](/creator-connect/signed-handoff/).

Agent install path:

```bash
npx @boomin/cli@latest skill install
npx @boomin/cli@latest mcp install
npx @boomin/cli@latest doctor
```

Restart Claude Code or Codex after install so the Boomin skill and MCP tools are loaded. The whole referral-first install works with an AI agent driving it end to end. Use the default `Referral Program Installer` MCP pack for app scaffolding. Grant `Program Operator` only when the agent should change program requirements, tiers, channels, or referral settings.

## Install

```bash
npm install @boomin/connect
npx @boomin/cli init
```

`init` opens Boomin in the browser, lets you log in or sign up, creates or selects an organization and creator program, ensures a Creator Connect config exists, adds localhost origins, and writes:

```txt
VITE_BOOMIN_PUBLIC_KEY=pk_live_...
VITE_BOOMIN_PROGRAM_ID=...
VITE_BOOMIN_API_BASE=https://api.boomin.ai/v1/connect
```

## Add the SDK

```js
import Boomin from "@boomin/connect";

Boomin.init({
  publicKey: import.meta.env.VITE_BOOMIN_PUBLIC_KEY,
  programId: import.meta.env.VITE_BOOMIN_PROGRAM_ID,
  apiBase: import.meta.env.VITE_BOOMIN_API_BASE,
  redirectUri: window.location.origin + window.location.pathname,
});
```

## Verify a creator by email

```js
await Boomin.requestOtp({
  email: "creator@example.com",
  name: "Creator Name",
});

const creator = await Boomin.verifyOtp({
  email: "creator@example.com",
  code: "123456",
});

console.log(creator.status); // pending
```

## Connect Instagram

```js
await Boomin.connectInstagram({
  requireCreator: true,
  referralCode: new URLSearchParams(window.location.search).get("ref"),
  metadata: { source: "creator_program_page" },
});
```

`requireCreator: true` means the creator must complete OTP first. That gives the brand an email/contact record before Instagram OAuth.

## Read status after redirect

```js
const redirectResult = Boomin.consumeRedirectResult();

if (redirectResult?.sessionId) {
  const status = await Boomin.getConnectStatus(redirectResult.sessionId);
  console.log(status.status); // pending_approval, approved, rejected, failed
}
```

## Smoke from the CLI

```bash
npx @boomin/cli --help
npx @boomin/cli status
npx @boomin/cli platform smoke --read-only
```

Use platform smoke only with a private platform token. Do not put `sk_boomin_live_...` tokens in browser code.

## If your app already has users

Use Signed Handoff instead of asking for a second creator email OTP:

```bash
npx @boomin/cli referral init --framework next --auth custom --write
npx @boomin/cli handoff provision
```

Your server signs the logged-in user, Boomin links that external user to the program, then Instagram OAuth starts from the same durable session model.
