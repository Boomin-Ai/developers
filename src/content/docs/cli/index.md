---
title: CLI Guide
description: Use npx @boomin/cli to log in, initialize apps, inspect scopes, and smoke-test APIs.
---

Boomin ships the browser SDK as `@boomin/connect` and the CLI as `@boomin/cli`.

```bash
npx @boomin/cli --help
```

Every command supports `-h` and `--help`.

## Login

```bash
npx @boomin/cli login
```

The CLI creates a short-lived login session, opens Boomin in your browser, and waits for approval. This is the same pattern used by tools like Wrangler: credentials are granted in the browser, not typed into the terminal.

## Init

```bash
npx @boomin/cli init
```

`init` logs in if needed, selects or creates an organization and creator program, ensures a Creator Connect public key exists, appends local origins, and writes `.env.local`.

Useful flags:

```bash
npx @boomin/cli init --yes
npx @boomin/cli init --dry-run
npx @boomin/cli init --origin http://localhost:3000
npx @boomin/cli init --program-name "Launch Creator Program"
npx @boomin/cli init --list
```

`--list` lists the program on Boomin Connect's public [Discover feed](/partner-programs/discover/). Without the flag, interactive `init` asks and defaults to private; a non-interactive `init` never lists.

## Referral scaffold and handoff

```bash
npx @boomin/cli referral init --framework next --auth custom --write
npx @boomin/cli handoff provision
```

`referral init` generates the partner join/status routes, the `/r/[code]` redirect tracker, and a starter `/partner` page. `handoff provision` mints the program's handoff signing secret and writes it to `.env.local` (`--rotate` mints a new one and invalidates the old).

## Doctor

```bash
npx @boomin/cli doctor
npx @boomin/cli doctor --json
```

`doctor` checks login, env, handoff config, and referral-route readiness, and prints a fix command for anything that fails.

## Status and logout

```bash
npx @boomin/cli status
npx @boomin/cli status --json
npx @boomin/cli logout
```

## Scopes

```bash
npx @boomin/cli scopes
npx @boomin/cli scopes --json
npx @boomin/cli scopes explain units:create
```

## Platform smoke

```bash
npx @boomin/cli platform smoke --read-only --token sk_boomin_live_...
npx @boomin/cli platform smoke --write --cleanup --token sk_boomin_live_...
npx @boomin/cli platform smoke --all-scopes --cleanup --json
```

Agents should prefer `--json` when they need machine-readable output.

`--all-scopes` creates a temporary all-scope token when no token is passed, executes every V1 scope through the Platform scope executor, cleans up created smoke objects when `--cleanup` is present, and revokes the temporary token.
