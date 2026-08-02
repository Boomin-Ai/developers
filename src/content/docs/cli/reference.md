---
title: Command Reference
description: Every group and subcommand in @boomin/cli 0.3.0.
---

`@boomin/cli` **0.3.0**. Every command supports `-h` / `--help`, and most support
`--json` for machine-readable output.

```bash
npx @boomin/cli --help
npx @boomin/cli help distribution
```

## Global flags

| Flag | Purpose |
| --- | --- |
| `-h`, `--help` | Help for a command or group |
| `--json` | Machine-readable output where supported |
| `--api-base <url>` | Boomin app API base |
| `--platform-api-base <url>` | Platform API base |
| `--web-base <url>` | Browser login base URL |
| `--connect-api-base <url>` | Partner Connect API base |

Platform v1 groups also accept `--token sk_boomin_live_...` (or read
`BOOMIN_PLATFORM_TOKEN`, or the saved config) and `--brand <id-or-slug>` to set
the `Boomin-Brand` header.

## Setup and account

```bash
npx @boomin/cli login [--no-open]
npx @boomin/cli logout
npx @boomin/cli status [--json]
npx @boomin/cli doctor [--json] [--strict] [--origin <url>]
npx @boomin/cli init [--yes] [--dry-run] [--list]
```

`login` creates a short-lived login session, opens Boomin in your browser, and
waits for approval — credentials are granted in the browser, never typed into
the terminal.

`init` logs in if needed, selects or creates an organization and program,
ensures a Partner Connect surface exists, appends local origins, and writes
`.env.local`.

`doctor` checks runtime, API health, saved login, `.env.local`, Connect config,
admin config, optional handoff config, and optional platform token — and prints
a fix command for anything that fails. `--strict` treats warnings and skipped
optional checks as failures.

### Setup flags

| Flag | Purpose |
| --- | --- |
| `--origin <url>` | Add an allowed origin (repeatable) |
| `--program-id <id>` | Use an existing program |
| `--program-name <name>` | Select or create a program by name |
| `--list` | List the program on the public [Discover feed](/partner-programs/discover/) (default: private) |
| `--org-id <id>` / `--org-name <name>` | Select or create an organization |
| `--yes` | Accept defaults for non-interactive setup |
| `--dry-run` | Print intended changes without writing files |

## Tokens and scopes

```bash
npx @boomin/cli token create --name "Agent" --scopes org:read,distributions:read [--save] [--json]
npx @boomin/cli token list [--json]
npx @boomin/cli token revoke <token_id>
npx @boomin/cli token rotate <token_id> [--save]

npx @boomin/cli scopes [--json]
npx @boomin/cli scopes explain <scope>
```

The secret is shown **once** on create and rotate. `--save` stores it locally for
smoke commands only.

See [Token Commands](/cli/tokens/) and [Scope Reference](/tokens-scopes/scopes/).

## Scaffolding

```bash
npx @boomin/cli referral init --framework next --auth custom|clerk|supabase [--write] [--yes]
npx @boomin/cli handoff init --framework next --auth custom|clerk|supabase [--route <path>] [--write] [--yes]
npx @boomin/cli handoff provision [--issuer your-app.com] [--rotate]
npx @boomin/cli mcp install [--pack <name>]
npx @boomin/cli skill install [--target claude|codex] [--source <path>] [--yes]
```

`referral init` generates the partner join/status routes, the `/r/[code]`
redirect tracker, and a starter `/partner` page.

`handoff provision` mints the program's [signed-handoff](/partner-connect/signed-handoff/)
signing secret and writes it to `.env.local`; `--rotate` mints a new one and
invalidates the old. It requires login as an admin of the program.

`--framework next` is the only framework generated today.

## Platform smoke

```bash
npx @boomin/cli platform smoke --read-only [--token sk_boomin_live_...]
npx @boomin/cli platform smoke --write --cleanup [--token sk_boomin_live_...]
npx @boomin/cli platform smoke --all-scopes --cleanup [--json]
```

`--all-scopes` creates a temporary all-scope token when none is passed, executes
every registered scope through the platform scope executor, cleans up created
smoke objects with `--cleanup`, and revokes the temporary token.

---

## Platform v1 groups

Seven groups over the live `/v1/platform` tree: `distribution`, `enrollment`,
`partnership`, `connection`, `payout`, `webhook`, `events`.

Operation-returning commands poll the operation to a terminal status by
**default**; `--no-wait` returns the 202 immediately.

| Flag | Default | Applies to |
| --- | --- | --- |
| `--no-wait` | off | `distribution launch\|pause\|resume\|cancel` |
| `--timeout <seconds>` | `120` | Operation wait budget |
| `--poll-interval <secs>` | `2` | Poll interval |
| `--limit <n>` | 20 | Any `list` |
| `--starting-after <id>` | — | Any `list` |

### distribution

```bash
npx @boomin/cli distribution create --name "Launch" --objective acquisition --programs prog_...
npx @boomin/cli distribution list [--status draft|ready|launching|active|paused|...]
npx @boomin/cli distribution get <dist_id>
npx @boomin/cli distribution validate <dist_id>
npx @boomin/cli distribution launch <dist_id> [--no-wait]
npx @boomin/cli distribution pause <dist_id> [--no-wait]
npx @boomin/cli distribution resume <dist_id> [--no-wait]
npx @boomin/cli distribution cancel <dist_id> [--no-wait]
```

Create flags:

| Flag | Meaning |
| --- | --- |
| `--name <text>` | **Required** |
| `--objective <text>` | `awareness` \| `acquisition` \| `launch` \| `conversion` \| `retention` \| `event_promotion` \| `custom` |
| `--programs <csv>` | Program ids supplying eligible enrollments |
| `--description <text>` | Optional |
| `--spec <json>` | Deployment plan as a JSON string |
| `--budget <json>` | `{"mode":"funded","asset":"credit","total":10000}` (minor units) |
| `--budget-mode <mode>` | `none` \| `metered` \| `funded`, with `--budget-asset usd\|credit` and `--budget-total <minor>` |

Needs `distributions:read`, `distributions:write`, and `distributions:launch`.

```bash
npx @boomin/cli distribution create --name "Spring launch" --objective launch \
  --programs prog_... --budget-mode funded --budget-asset credit --budget-total 50000
npx @boomin/cli distribution validate dist_...
npx @boomin/cli distribution launch dist_...
```

### enrollment

```bash
npx @boomin/cli enrollment invite --program prog_... --email partner@example.com [--name "Ada"]
npx @boomin/cli enrollment invite --program prog_... --partner ptnr_...
npx @boomin/cli enrollment approve <enr_id>
npx @boomin/cli enrollment reject <enr_id>
npx @boomin/cli enrollment list [--program prog_...] [--status active|paused|archived] [--approval-status pending|approved|rejected]
npx @boomin/cli enrollment get <enr_id>
```

`invite` also accepts `--referral-code <code>` and `--metadata <json>`. One of
`--email` or `--partner` is required. Needs `enrollments:read` /
`enrollments:write`.

### partnership

```bash
npx @boomin/cli partnership list [--status pending|active|paused|ended]
npx @boomin/cli partnership get <pship_id>
npx @boomin/cli partnership pause <pship_id>
npx @boomin/cli partnership resume <pship_id>
npx @boomin/cli partnership end <pship_id>
```

`get` prints the partnership followed by its enrollments. `pause` and `resume`
report the deployment ids they moved. Needs `partnerships:read` /
`partnerships:write`.

### connection

```bash
npx @boomin/cli connection list
npx @boomin/cli connection get <conn_id>
npx @boomin/cli connection revoke <conn_id>
```

Needs `connections:read` / `connections:write`.

### payout

```bash
npx @boomin/cli payout list [--status pending|awaiting_account|processing|paid|failed] \
  [--period-start YYYY-MM-DD --period-end YYYY-MM-DD]
npx @boomin/cli payout run --period-start YYYY-MM-DD --period-end YYYY-MM-DD
npx @boomin/cli payout export [--out payouts.csv] [--period-start YYYY-MM-DD --period-end YYYY-MM-DD]
npx @boomin/cli payout connect
```

`payout export --out <file>` downloads the generated CSV to that path. `payout
connect` prints configured rails plus the Stripe Connect account rollup. Needs
`payouts:read` / `payouts:write`.

### webhook

```bash
npx @boomin/cli webhook create --url https://your-app.com/webhooks/boomin \
  [--events distribution.live,payout.settled] [--description "Prod"]
npx @boomin/cli webhook list
npx @boomin/cli webhook rotate-secret <we_id>
npx @boomin/cli webhook delete <we_id>
```

The signing secret is printed **once**, on `create` and `rotate-secret`. An
empty `--events` subscribes the endpoint to every public event type. Needs
`webhooks:read` / `webhooks:write`.

### events

```bash
npx @boomin/cli events list [--type distribution.live] [--limit 50] [--starting-after <seq-or-evt_id>]
```

The operational feed out, ordered by `seq`. Needs `events:read`.

## Missing a scope?

When a command fails on scope, the CLI prints the typed code, the required
scope, and a ready-to-run fix:

```txt
missing_scope: distributions:launch
Try: npx @boomin/cli token create --name "Platform" --scopes org:read,distributions:launch --save
```
