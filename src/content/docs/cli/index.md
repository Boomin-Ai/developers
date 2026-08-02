---
title: CLI Guide
description: Log in, scaffold a program, mint keys, and drive the distribution tree from the terminal.
---

`@boomin/cli` **0.3.0** covers two jobs: getting a project set up, and driving
the live `/v1/platform` distribution tree without writing code.

```bash
npx @boomin/cli --help
npx @boomin/cli help distribution
```

Every command supports `-h` / `--help`. Agents should prefer `--json`.

For the exhaustive flag list, see [Command Reference](/cli/reference/).

## Login

```bash
npx @boomin/cli login
```

Creates a short-lived login session, opens Boomin in your browser, and waits for
approval — the same pattern Wrangler uses. Credentials are granted in the
browser, never typed into the terminal.

## Init

```bash
npx @boomin/cli init --program-name "Launch Partners" --yes
```

`init` logs in if needed, selects or creates an organization and program,
ensures a [Partner Connect](/partner-connect/browser-sdk/) surface exists,
appends local origins, and writes `.env.local`:

```env
VITE_BOOMIN_PUBLIC_KEY=pk_live_...
VITE_BOOMIN_PROGRAM_ID=...
VITE_BOOMIN_API_BASE=https://api.boomin.ai/v1/connect
```

Programs are **private by default**. Add `--list` to put yours on the public
[Discover feed](/partner-programs/discover/). Interactive `init` asks and
defaults to private; non-interactive `init` never lists.

Useful variants:

```bash
npx @boomin/cli init --dry-run
npx @boomin/cli init --origin http://localhost:3000
npx @boomin/cli init --program-id prog_...
```

## Mint a platform key

```bash
npx @boomin/cli token create \
  --name "Quickstart server" \
  --scopes org:read,enrollments:read,enrollments:write,distributions:read,distributions:write,distributions:launch,deployments:read,performance:read,performance:write,events:read,webhooks:read,webhooks:write,payouts:read,payouts:write \
  --save
```

The secret is shown once. See [Token Commands](/cli/tokens/) and
[Authentication](/concepts/authentication/).

## Drive the distribution tree

Seven groups over the live Platform API — `distribution`, `enrollment`,
`partnership`, `connection`, `payout`, `webhook`, `events`:

```bash
npx @boomin/cli enrollment invite --program prog_... --email creator@example.com
npx @boomin/cli enrollment approve enr_...

npx @boomin/cli distribution create --name "Spring launch" --objective launch \
  --programs prog_... --budget-mode funded --budget-asset credit --budget-total 50000
npx @boomin/cli distribution validate dist_...
npx @boomin/cli distribution launch dist_...

npx @boomin/cli webhook create --url https://your-app.com/webhooks/boomin
npx @boomin/cli payout export --out payouts.csv
```

`launch`, `pause`, `resume`, and `cancel` are asynchronous — they answer `202`
with an operation. The CLI **polls the operation to a terminal status by
default**; `--no-wait` returns immediately.

```bash
npx @boomin/cli distribution launch dist_... --timeout 300 --poll-interval 5
npx @boomin/cli distribution launch dist_... --no-wait
```

## Scaffolding

```bash
npx @boomin/cli referral init --framework next --auth custom --write
npx @boomin/cli handoff provision
```

`referral init` generates the partner join/status routes, the `/r/[code]`
redirect tracker, and a starter `/partner` page. `handoff provision` mints the
program's [signed-handoff](/partner-connect/signed-handoff/) secret and writes it
to `.env.local` (`--rotate` replaces it).

## Doctor

```bash
npx @boomin/cli doctor
npx @boomin/cli doctor --json --strict
```

Checks login, env, Connect config, handoff config, and referral-route readiness,
and prints a fix command for anything that fails.

## Status, scopes, logout

```bash
npx @boomin/cli status --json
npx @boomin/cli scopes
npx @boomin/cli scopes explain distributions:launch
npx @boomin/cli logout
```

## Platform smoke

```bash
npx @boomin/cli platform smoke --read-only --token sk_boomin_live_...
npx @boomin/cli platform smoke --write --cleanup --token sk_boomin_live_...
npx @boomin/cli platform smoke --all-scopes --cleanup --json
```

`--all-scopes` mints a temporary all-scope token when none is passed, executes
every registered scope through the platform scope executor, cleans up with
`--cleanup`, and revokes the temporary token.
