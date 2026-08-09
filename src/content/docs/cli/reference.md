---
title: Command Reference
description: Every group and subcommand in @boomin/cli 0.5.0.
---

`@boomin/cli` **0.5.0**. Every command supports `-h` / `--help`, and most support
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
`partnership`, `connection`, `payout`, `webhook`, `events`. `payout` has three
sub-groups of its own — `rules`, `rails`, `batches` — mirroring
`/payouts/{rules,rails,batches}`.

Operation-returning commands poll the operation to a terminal status by
**default**; `--no-wait` returns the 202 immediately.

| Flag | Default | Applies to |
| --- | --- | --- |
| `--no-wait` | off | `distribution launch\|pause\|resume\|cancel`, `payout export`, `payout batches export\|confirm` |
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
report the promo-link codes they moved (`links_paused` / `links_resumed`) plus
the channel ids those links live on — they never pause the shared deployment.
Needs `partnerships:read` / `partnerships:write`.

### connection

```bash
npx @boomin/cli connection list
npx @boomin/cli connection get <conn_id>
npx @boomin/cli connection revoke <conn_id>
```

Needs `connections:read` / `connections:write`.

### payout

The money-out group. Three sub-groups mirror the REST tree —
`payout rules`, `payout rails`, `payout batches` — plus the ledger verbs:

```bash
npx @boomin/cli payout list [--status pending|awaiting_account|processing|paid|failed] \
  [--period-start YYYY-MM-DD --period-end YYYY-MM-DD]
npx @boomin/cli payout run --period-start YYYY-MM-DD --period-end YYYY-MM-DD
npx @boomin/cli payout export [--out payouts.csv] [--period-start YYYY-MM-DD --period-end YYYY-MM-DD] [--no-wait]
npx @boomin/cli payout connect
```

`payout run` **exits non-zero** when the brand has no active payout rule and no
active content split (`payout_rules_required`) — a configuration error must fail
a scheduled job rather than look like a month with nothing owed. A run that
found nothing exits zero and prints `no_eligible_activity` plus the counters.

`payout export` is build **and** export in one call. The export is an operation,
so the command polls it to terminal, reads the batch for its re-minted
`download_url`, and writes `--out`. A failed operation exits non-zero rather
than leaving an empty path behind.

`payout connect` prints configured rails plus the Stripe Connect account
rollup — identity and state only, never rail `config`.

Needs `payouts:read` / `payouts:write`. Concepts: [Getting partners
paid](/payouts/).

### payout rules

How a partner **earns**. Needs `payout_rules:read` / `payout_rules:write`.

```bash
npx @boomin/cli payout rules list [--program prog_...] [--status active|paused|archived] \
  [--type revenue_split|cpa|threshold_bonus]
npx @boomin/cli payout rules create --name "Rev share" --type revenue_split --program prog_... --rate-bps 2000
npx @boomin/cli payout rules show <prule_id>
npx @boomin/cli payout rules update <prule_id> [--name "..."] [--status active|paused|archived]
npx @boomin/cli payout rules archive <prule_id>
```

Create flags:

| Flag | Meaning |
| --- | --- |
| `--name <text>` | **Required**, 1–200 chars |
| `--type <type>` | **Required**: `revenue_split` \| `cpa` \| `threshold_bonus` |
| `--program <prog_id>` | **Required on every scope**, including `member` |
| `--scope-type <type>` | `program` (default) \| `collection` \| `unit` \| `member` |
| `--collection` / `--unit` / `--member` | The scope target; also infers `--scope-type` |
| `--scope <json>` | The whole scope object, instead of the flags above |
| `--rate-bps <n>` | Required for `revenue_split`. 0–10000; `2000` = 20.00% |
| `--metric-key <key>` | Required for `cpa` and `threshold_bonus` |
| `--per-unit-minor <n>` | Required for `cpa`. Minor units — there is no `--*-cents` |
| `--threshold <n>` / `--bonus-minor <n>` | Required for `threshold_bonus` |
| `--window-key <text>` / `--window-days <n>` | Optional window for `threshold_bonus` |
| `--currency <iso>` | 3 letters, default `usd` |

```bash
npx @boomin/cli payout rules create --name "Registration CPA" --type cpa \
  --program prog_... --metric-key event_registration --per-unit-minor 500

npx @boomin/cli payout rules create --name "100 referrals" --type threshold_bonus \
  --program prog_... --metric-key referral_count --threshold 100 --bonus-minor 25000 --window-days 90
```

`update` takes `--name` and `--status` **only** — a rule's economics freeze at
creation. Sending anything else answers `immutable_parameter` naming the frozen
concept. To change money: create a replacement rule, then archive the old one.

`archive` is the removal verb; there is no delete, because ledger rows reference
rules. [Why](/payouts/#3-rules-are-archived-never-deleted)

### payout rails

How money physically **leaves**. Needs `payout_rails:read` /
`payout_rails:write` — a separate grant from `payouts:write`, because a column
mapping decides where money lands.

```bash
npx @boomin/cli payout rails list
npx @boomin/cli payout rails create --rail csv_batch --format paypal_payouts_csv [--default] \
  [--wallet-funded] [--columns '[{"key":"email","header":"Email Address"}]']
npx @boomin/cli payout rails show <prail_id>
npx @boomin/cli payout rails update <prail_id> [--config '{...}'] [--status active|disabled] [--default]
```

| Flag | Meaning |
| --- | --- |
| `--rail <kind>` | **Required**: `csv_batch` \| `stripe_connect` |
| `--format <fmt>` | **Required for `csv_batch`**: `paypal_payouts_csv` \| `wise_batch_csv` |
| `--columns <json>` | Your column mapping, passed to the API untouched |
| `--wallet-funded` | Bare boolean. Settlement debits the brand wallet per item |
| `--default` | Bare boolean. Claims the brand's one default rail |
| `--config <json>` | The whole config object, instead of the three flags above |
| `--status <s>` | `active` \| `disabled` |

`--wallet-funded` and `--default` are bare flags; `--default=false` also works.

```bash
npx @boomin/cli payout rails create --rail csv_batch --format wise_batch_csv --default \
  --columns '[{"key":"email","header":"Email Address"},{"key":"amount","header":"payoutAmount"},{"key":"currency","header":"Currency_Code"},{"key":"reference","header":"REF"}]'
```

Those headers reach the rendered file byte-for-byte —
`payoutAmount` is **not** re-cased on its way through the CLI or the SDK.
[Why](/payouts/#4-configcolumns-is-your-data)

`create` is not an upsert: a second create for a configured rail answers
`payout_rail_already_exists` (409) and you must say `update` out loud. On
`update`, `--config` **replaces** the stored object wholesale; omit the config
flags to leave it alone.

### payout batches

One frozen disbursement run. Needs `payouts:read` / `payouts:write`.

```bash
npx @boomin/cli payout batches list
npx @boomin/cli payout batches show <pob_id>
npx @boomin/cli payout batches create [--rail csv_batch] [--period-start YYYY-MM-DD --period-end YYYY-MM-DD]
npx @boomin/cli payout batches export <pob_id> [--out payouts.csv] [--no-wait]
npx @boomin/cli payout batches confirm <pob_id> [--external-batch-ref PAYPAL-2026-08] \
  [--results '[{"item":"<uuid>","status":"paid"}]'] [--no-wait]
npx @boomin/cli payout batches cancel <pob_id>
```

The full lifecycle, end to end:

```bash
npx @boomin/cli payout batches create --period-start 2026-08-01 --period-end 2026-09-01
npx @boomin/cli payout batches export pob_... --out payouts.csv
# pay it out of band, then:
npx @boomin/cli payout batches confirm pob_... --external-batch-ref PAYPAL-2026-08
```

`export` and `confirm` are operations and poll to terminal by default;
`--no-wait` prints the 202 and the operation id instead.

`--results` names batch **item** ids — bare uuids from `payout batches show
<pob_id> --json`, not prefixed ids. Per-item `status` is `paid`, `failed`, or
`returned`, with an optional `reason`. Omit `--results` and every item settles
as `paid`.

Repeating a confirm with the same `--external-batch-ref` replays one operation,
so a retry after a timeout cannot settle twice.

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
