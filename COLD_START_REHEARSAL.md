# Cold-start rehearsal — hostile stranger, zero help

**Date:** 2026-08-02
**Rehearsed against:** `api` @ `dabead4` (= `origin/main`), local `wrangler dev --port 8793`, dev Neon branch.
**Rules of the exercise:** the only permitted instruction sources were the **published docs**
(`developers/` built with `npm run build`, then `src/content/docs/**`) and the CLI's own `--help`.
API/SDK source was opened **only to diagnose a failure already hit**. Every time insider knowledge
was needed to know *what to do next*, that is recorded as a finding.

**Founder's launch bar:** configure Boomin from a different PC and a different domain, using only the
published docs + CLI + SDK, with zero help.

---

## VERDICT: **NO.**

> **Verdict revised 2026-08-02 after B1 was retracted.** The original verdict rested partly on a
> false premise (that the docs omit the distribution flow — they do not; see B1). **The verdict is
> still NO**, but for narrower and more tractable reasons: the packages are unpublished, and three
> steps of the flow have no CLI/SDK surface at all.

A stranger cannot complete the run today because **nothing is published to npm**, and because the
run dies at three points that have no CLI, SDK, or documented surface: **funding a funded
distribution**, **creating a payout rail**, and **creating payout rules** — the last two being what
make `payout run` and `payout export` return anything but zero.

**Three things must change before the run is attemptable:**

1. Publish `@boomin/sdk@1.0.0-beta.1`, `@boomin/cli@0.3.0`, `@boomin/mcp` to npm. (`npx @boomin/cli`
   today resolves to **0.2.0**, which has no `distribution`, `payout`, `webhook`, `enrollment`,
   `partnership`, or `events` commands at all — verified by unpacking the published tarball.)
2. Give funding, payout rails, and payout rules a v1/CLI surface — or make `validate` and
   `payout run` say what is missing instead of returning "ready" and `0`.
3. Fix the **silent camelCase-drop class** (see the Traps section) — it is the single highest-value
   fix in this document, because it fails *quietly* and one of its instances silently subscribes a
   webhook endpoint to every event type.

Regenerating `public/openapi/platform.yaml` from the v1 router is also needed, but is a PAPERCUT
rather than a blocker now that the prose docs cover the flow.

---

## How far the run actually got

| # | Quickstart step | Result |
|---|---|---|
| 1 | signup / org creation | **PASS** (magic code; one code creates user+org+brand) |
| 2 | mint a platform key | **PASS** — but scope list had to be reverse-engineered from `--help`, not docs |
| 3 | install `@boomin/sdk` | **BLOCKED** — 404 on npm; proceeded with the local package |
| 4 | create a program | **PASS** via SDK; **no CLI command exists** (docs say `init`, which needs a browser) |
| 5 | connect embed setup | **DEGRADED** — 403 on first token (scopes), then silently no-op'd (camelCase) |
| 6 | invite + approve a partner | **PASS** |
| 7 | create a **funded** distribution | **PASS** to create — **BLOCKED** to launch |
| 8 | validate | **PASS**, but reports `"Valid: true"` on a distribution that cannot launch |
| 9 | launch | **BLOCKED** on `funded`; **PASS** only after downgrading the budget to `metered` |
| 10 | poll the operation | **PASS** via CLI; **BROKEN** via the SDK README snippet |
| 11 | confirm deployments + links | **PARTIAL** — deployment exists; no link URL is ever returned |
| 12 | ingest a conversion | **TRAP** — `type:"conversion"` returns 200 and silently does nothing |
| 13 | create webhook + verify signature | **PASS** via CLI; **BROKEN** via SDK (secret unreachable) |
| 14 | run payouts | **BLOCKED** — always `0` until payout rules exist, which have no v1 surface |
| 15 | export the payout CSV | **BLOCKED** — payout rail has no v1 surface |

Reached the end of the flow only by stepping **outside** the stranger's permitted sources four times
(app-API rail creation, app-API payout-rule creation, source-read for the ingest schema, source-read
for the accepted event types). Every one of those is a finding below.

---

# Findings, ranked

## BLOCKERS

### B1 — ~~The published docs contain zero coverage of the entire distribution flow~~ **RETRACTED — INVALID**

> **CORRECTION (verified 2026-08-02, after this rehearsal was written).** This finding is **wrong**,
> and the error was in the rehearsal method, not the docs. The rehearsal grepped a **stale local
> checkout** of `developers/` that sat one commit behind `origin/main`. The distribution docs had
> already merged as `2c4cde6` ("Developer docs v1: distribution model, SDK reference, CLI 0.3.0")
> at 13:13 local time. On current `main`, `grep -ril distribution src/content/docs/` returns
> **28 files**, including `quickstart.md` (which references `distributions.launch` four times),
> the full `sdk/resources/*` tree, `distributions/*`, `concepts/model.md`, and `sdk/webhooks.md`.
>
> **What survives from this finding:** `public/openapi/platform.yaml` really does describe only the
> legacy RPC paths and not the v1 tree, and `roadmap.md` really does still list shipped items under
> "Next." Those are downgraded to **PAPERCUT** (see P2 items below). The headline claim — that a
> stranger cannot find the distribution flow in the docs — is **false**.
>
> **Method lesson, which is the more important finding:** a rehearsal that reads a local working
> copy is testing *this machine*, not *the published artifact*. Any future cold-start rehearsal must
> `git fetch && git status` every repo it reads, or better, read the deployed docs site over HTTP.

**Original finding as written (retained for the record, but do not act on it):**

**What the docs said:** the quickstart at `developers/src/content/docs/quickstart.md` is titled
"Install `@boomin/connect`, initialize a program, and connect a creator." It covers referral
scaffolding, Instagram OAuth, and OTP. `platform-api/index.md` describes the Platform API as a way
to "create units, manage pages, inspect programs, or run safe platform smoke tests."

**What I did:** built the docs, then grepped the whole content tree for every noun in the launch bar.

```
$ cd developers/src/content/docs && for t in distribution deployment payout conversion partnership funded wallet CSV; do
    printf "%-14s %s\n" "$t" "$(grep -ril "$t" . | tr '\n' ' ')"; done
distribution
deployment
payout         tokens-scopes/scopes.md
conversion
partnership
funded
wallet
CSV
```

The single `payout` hit is a **negation**: `commerce:write` — "Create or update safe commerce
resources. **Excludes billing and payouts.**"

The published machine-readable artifacts are no better:

```
$ grep -E '^  /' developers/public/openapi/platform.yaml
  /scopes:
  /scopes_exec:
  /platform/tokens:
  /platform/tokens/create:
  /platform/tokens/revoke:
  /platform/tokens/rotate:
  /smoke:
  /units/list:
  /units/create:
  /units/delete:
```

Ten legacy RPC paths. The v1 REST tree has 60+ routes, none of them described. `llms.txt` — the file
the docs explicitly offer to agents — never mentions a distribution, deployment, or payout.
`roadmap.md` still lists "Webhook management docs and delivery logs" and "More Platform API resource
families" under **Next**, i.e. the docs actively tell the stranger this does not exist yet.

**What the stranger would have to guess:** everything. There is no path from the published docs to
`boomin distribution create`. The only reason this rehearsal continued is that `--help` (the other
permitted source) does carry the tree.

**Rating: BLOCKER.**

**Minimal fix:**
- New page `docs/platform-v1/quickstart.md` walking program → enrollment → distribution → launch →
  deployments → performance → payouts, with the *exact* wire payloads (snake_case).
- Regenerate `public/openapi/platform.yaml` from `api/src/routes/platform-v1/*` in CI.
- Add the v1 command tree and the `sk_` → v1 base URL to `public/llms.txt`.
- Move the shipped items out of `roadmap.md` → "Live now".

---

### B2 — Nothing needed for this flow is published to npm

**What the docs said:** every page instructs `npm install @boomin/connect @boomin/server` and
`npx @boomin/cli ...`. `llms.txt` additionally advertises `npx @boomin/mcp`.

**What actually happened:**

```
$ npm view @boomin/sdk version
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@boomin%2fsdk - Not found

$ npm view @boomin/mcp version
npm error 404 Not Found - GET https://registry.npmjs.org/@boomin%2fmcp - Not found

$ npm view @boomin/cli version
0.2.0          # local source is 0.3.0
```

The published CLI is a **different product**:

```
$ npm pack @boomin/cli@0.2.0 && tar -xzf boomin-cli-0.2.0.tgz
$ node package/src/cli.js distribution create --name "Launch" --objective acquisition
Unknown command: distribution

$ node package/src/cli.js payout run
Unknown command: payout

$ node package/src/cli.js webhook create --url https://x.com/h
Unknown command: webhook
```

`0.2.0`'s `--help` has no "Platform v1" section at all. A stranger who reads a (future) correct
quickstart and runs `npx @boomin/cli distribution create` gets `Unknown command` and a help screen
that does not contain the word "distribution" — with no indication that a newer version exists.

**Rating: BLOCKER.**

**Minimal fix:** publish `@boomin/sdk@1.0.0-beta.1`, `@boomin/cli@0.3.0`, `@boomin/mcp`. Until then
every doc snippet in the repo is a lie. (Flagged in the brief as known — recorded here because it is
the first thing the stranger hits and it invalidates every copy-paste block on the site.)

---

### B3 — A `funded` distribution cannot be funded from the CLI, the SDK, or the docs

This is the single worst experience in the run, because **every signal says it is going to work.**

```
$ boomin distribution create --name "CLI Launch" --objective acquisition \
    --programs prog_8c11f8d4-... --budget-mode funded --budget-asset credit --budget-total 10000
Distribution: dist_eb045894-4b33-42ad-8cfd-48986ef029e6
Status: draft
Budget: funded credit 10000 (consumed 0)

Next: npx @boomin/cli distribution validate dist_eb045894-4b33-42ad-8cfd-48986ef029e6

$ boomin distribution validate dist_eb045894-4b33-42ad-8cfd-48986ef029e6
Status: ready
Budget: funded credit 10000 (consumed 0)
Valid: true

Ready. Next: npx @boomin/cli distribution launch dist_eb045894-4b33-42ad-8cfd-48986ef029e6

$ boomin distribution launch dist_eb045894-4b33-42ad-8cfd-48986ef029e6 --timeout 25
Waiting on op_a2718287-9a55-46ad-8f22-cc833f9c996c ...
Operation op_a2718287-9a55-46ad-8f22-cc833f9c996c did not reach a terminal status within 25000ms (last status: waiting).
```

`validate` returns **`Valid: true`** and status `ready` for a distribution reserving 10,000 credits
against a wallet holding 0. `launch` then blocks for the full timeout (**default 120s**) and dies
with a message that never uses the word *funding*. Retrying makes it worse:

```
$ boomin distribution launch dist_eb045894-4b33-42ad-8cfd-48986ef029e6 --timeout 12
Another live operation holds this subject's mutation lane.     # exit 1
```

The true reason is only visible if you already know to look at the operation object:

```
$ curl .../v1/platform/operations/op_a2718287-... -H "Authorization: Bearer sk_..."
{ "kind": "distribution.launch", "status": "waiting", "waiting_reason": "funding_required", ... }
```

`waiting_reason` is on the object, but **`operations.wait()` never reads it** — it polls for a
terminal status and throws `operation_wait_timeout` with `last status: waiting`. The CLI inherits
that. A `budget.reserve_failed` domain event *is* emitted and *is* visible in `boomin events list`,
but nothing points the stranger there.

And there is no way out: `boomin --help` has no `wallet`, `fund`, `topup`, or `billing` command; the
SDK resource table has no wallet client; the docs have no funding page. The wallet is fundable only
by a Stripe checkout inside the web app.

**Cannot be done locally:** topping up a USD wallet needs real Stripe money at the platform boundary.
**On prod the stranger would face:** a distribution stuck in `launching` forever, an operation parked
in `waiting`, no error naming funding, and no CLI/SDK/doc path to resolve it — they would have to
discover the web app's billing page on their own, and separately discover that credits (not USD) are
what `--budget-asset credit` wants.

**Rating: BLOCKER.**

**Minimal fix (smallest first):**
1. Make `validate` fail with `funding_required` when `mode=funded` and available balance < total.
   This is the one-line change that converts a 120-second silent hang into a clear pre-flight error.
2. Surface `waiting_reason` in `operations.wait()`'s timeout error and in the CLI's launch output
   (`last status: waiting (funding_required)`).
3. Add a `Funding` docs page naming the web-app top-up as the funding path, and `boomin distribution
   launch --allow-wait` semantics so the parked state is intentional rather than surprising.

---

### B4 — `payout export` needs a payout rail that has no v1, SDK, CLI, or docs surface

```
$ boomin payout connect
Rails: (none configured)
Stripe configured: yes
Partner payout accounts: 0 (0 payouts-enabled)

$ boomin payout export --period-start 2026-08-01 --period-end 2026-08-31 --out payouts.csv
The 'csv_batch' payout rail is not configured for this brand.     # exit 1
```

The error names the thing but not how to create it. `boomin help payout` lists only
`list|run|export|connect` — no `rail` verb. The SDK's resource table lists `payouts: list run
exportCsv connectStatus + batches.list/retrieve` — no rail creation. `payout connect` prints
`Rails: (none configured)` and then gives no fix line.

Diagnosis (source read, after the failure) found the only creation path:
`POST /v1/app/brands/:brandId/payout-rails`, guarded by `requireBrandAdmin` — i.e. a **logged-in
dashboard session**, not a platform token. Confirming it unblocks the step:

```
$ curl -X POST .../v1/app/brands/$BRAND/payout-rails -H "Authorization: Bearer <user JWT>" \
    -d '{"rail":"csv_batch","is_default":true,"status":"active"}'
{"rail":{"id":"cdf0bd14-...","rail":"csv_batch","status":"active","is_default":true}}
```

**What the stranger would have to guess:** that a "rail" is a thing they must create; that it is
created on the *app* API not the platform API; the brand id; and that a user session — not their
`sk_boomin_live_...` token — is required. All four are unguessable.

**Rating: BLOCKER.**

**Minimal fix:** auto-provision the `csv_batch` rail on first `export_csv` (it is the zero-onboarding
rail and requires no config — the row is literally `{rail:'csv_batch'}`). Failing that, add
`POST /v1/platform/payout_rails` under `payouts:write` + `boomin payout rail create --kind csv_batch`,
and make the error message carry the fix line.

---

### B5 — Payout **rules** — the only thing that turns performance into money — have no v1/SDK/CLI surface

With a live deployment, an ingested sale, and a configured rail, the money step still returns nothing:

```
$ boomin payout run --period-start 2026-08-01 --period-end 2026-08-31
Payout run complete for 2026-08-01..2026-08-31.
totalAmountCents: 0
count: 0
awaitingAccountCount: 0
bridged: 0
unresolvedRecipients: 0
(none)

$ boomin payout export --period-start 2026-08-01 --period-end 2026-08-31 --out payouts.csv
No settle-able payout rows for this rail (and period).
```

Zero, zero, zero — **exit 0**, no warning, no hint that a rate has never been defined. `payout_rules`
does not appear anywhere in `routes/platform-v1/`, in the SDK, in the CLI, or in the docs. It exists
only on the app API (`POST /v1/app/brands/:brandId/payout-rules`, `requireBrandAdmin`).

Creating one there closes the loop:

```
$ curl -X POST .../v1/app/brands/$BRAND/payout-rules -H "Authorization: Bearer <user JWT>" \
    -d '{"name":"CPA referral","type":"cpa","applies_to":"program","program_id":"<prog uuid>",
         "scope_id":"<prog uuid>","metric_key":"referral_count","per_unit_cents":500}'

$ boomin payout run --period-start 2026-08-01 --period-end 2026-08-31
totalAmountCents: 500
count: 1
awaitingAccountCount: 1
unresolvedRecipients: 1
po_330f41d1-...  awaiting_account  500  2026-08-01..2026-08-31
```

There is a second landmine inside this step. `program_id` is **not** the same field as `scope_id`,
and the compute path does `if (!rule.programId) continue;` — a rule created with only
`applies_to:"program"` + `scope_id` is **silently inert forever**. My first attempt did exactly that
and produced `count: 0` with no explanation. The API accepts it and returns 201.

**Rating: BLOCKER.**

**Minimal fix:**
1. Have `payout run` return a `warnings` array — `no_active_payout_rules` when the brand has none, and
   `payout_rule_missing_program` for any active rule with `program_id IS NULL`. Print them in the CLI.
2. Reject `applies_to:"program"` without `program_id` at the schema layer (409 `rule_inert`).
3. Expose payout rules on v1 (`programs/:id/payout_rules`) so the flow is completable with a
   platform token, and document `metric_key` alongside the accepted performance event types (T3).

---

### B6 — The SDK README's own launch snippet cannot run

**What the docs said** (`sdk/packages/sdk/README.md`, the file that becomes the npm landing page):

```js
const { operation } = await boomin.distributions.launch(distribution.id);
const settled = await boomin.operations.wait(operation.id, { timeout: 120000 });
```

**What actually happened** — the API returns `operation` as a **string**:

```
[OK] distributions.launch: {"distribution":"dist_ac9f7da7-...","status":"launching",
                            "operation":"op_55d98fd3-dccc-41fb-906c-b2d618b1f7e7"}
```

So `operation.id` is `undefined`, and `operations.wait(undefined)` is what the copy-paste actually
calls. This is the *headline* snippet of the SDK — the first ten lines a stranger reads.

**Rating: BLOCKER** (the primary documented path is non-functional).

**Minimal fix:** README → `const { operation } = ...; await boomin.operations.wait(operation, ...)`,
or make `operations.wait()` accept both a string and `{id}`. Prefer the latter; it is one line and
forgives both readings.

---

## TRAPS (proceed, but wrong)

### T1 — The SDK does no camelCase→snake_case conversion, and unknown keys are silently dropped

The README's own examples use camelCase (`enabledEvents`, `periodStart`). The wire is snake_case, and
the API's zod schemas strip unknown keys. So **camelCase params silently vanish**. Verified three
different ways in one run:

**(a) Webhook subscriptions — the dangerous one.**

```js
await boomin.webhooks.endpoints.create({
  url: "https://coldstart-labs.dev/webhooks/boomin",
  enabledEvents: ["distribution.live", "payout.settled"],   // straight from the README
});
```
```
→ {"webhook_endpoint":{ ..., "enabled_events": [], ...}}
```

Empty `enabled_events` means **subscribe to every public event type** (per `boomin help webhook`).
The stranger asked for 2 events and silently got all of them, pointed at their production endpoint.
Confirmed side by side — the CLI (which sends the right key) is correct, the SDK is not:

```
$ boomin webhook list
ID                                       STATUS   EVENTS                            URL
we_65c90d36-...  enabled  distribution.live,payout.settled  https://coldstart-labs.dev/hooks   <- CLI
we_e39e1d88-...  enabled  (all)                             https://coldstart-labs.dev/webhooks/boomin  <- SDK
we_933384a7-...  enabled  (all)                             https://coldstart-labs.dev/webhooks/boomin  <- SDK
```

**(b) Connect origins — silently a no-op.**

```
update(camel): {"allowed_origins":["http://localhost:5173","http://localhost:4173",
                "https://boomin.ai","https://atlantium.ai","https://www.atlantium.ai"], ...}
update(snake): {"allowed_origins":["https://coldstart-labs.dev"], ...}
```

Same call, same 200 OK. `allowedOrigins` changed nothing; `allowed_origins` worked. Since the
founder's bar is explicitly *a different domain*, this is the exact call the stranger makes — and it
appears to succeed while leaving their domain un-allowlisted.

**(c) Payout period — at least this one errors.**

```
[FAIL] payouts.run: InvalidRequestError code=invalid_request status=400
       msg=period_start: Invalid input: expected string, received undefined
```

**Rating: TRAP** (two of three cases are silent).

**Minimal fix:** add a camel→snake key transform in the SDK's request serializer (~10 lines, applies
to every resource). Belt and braces: `.strict()` on the v1 zod schemas so an unknown key 400s instead
of vanishing. Do both — the serializer fixes today's users, `.strict()` prevents the next instance.

---

### T2 — `webhook_endpoints.create` returns a nested envelope; the one-time secret is unreachable

Every other v1 resource returns the object flat (`{"id":"dist_...","object":"distribution",...}`).
`webhook_endpoints` alone returns `{"webhook_endpoint": {...}}`:

```
[OK] webhooks.endpoints.create: {"webhook_endpoint":{"id":"we_933384a7-...","object":"webhook_endpoint",
  "url":"https://coldstart-labs.dev/webhooks/boomin","enabled_events":[],"status":"enabled",
  "secret":"whsec_hUQgQy-uN16zZIZfn9jjs_mdvG3yzpza", ...}}
[FAIL] webhooks.constructEvent (round-trip): no secret returned from endpoints.create
```

The README says "The signing secret is revealed once on create". The natural
`const { secret } = await boomin.webhooks.endpoints.create(...)` yields `undefined`, and since the
secret is shown once, it is now **unrecoverable** — the stranger must `rotate-secret` to get another,
without knowing why the first one was blank.

(The signature primitives themselves are correct. Once the secret is extracted by hand,
`constructEvent` verifies a valid signature and rejects a tampered payload:
`VERIFY OK type= distribution.live` / `TAMPER rejected: WebhookSignatureVerificationError`.)

**Rating: TRAP.**

**Minimal fix:** return the bare `webhook_endpoint` object like every other v1 resource. If the wire
must stay for compatibility, unwrap it in the SDK's `WebhookEndpointsClient`.

---

### T3 — `performance/events` accepts any `type` and silently no-ops the money path

The launch-bar step is "ingest a conversion". The obvious word is exactly the wrong one:

```
$ curl -X POST .../v1/platform/performance/events -d '{"deployment":"dep_62a5ed6f-...",
    "type":"conversion","value_minor":4900,"currency":"usd","external_event_id":"order_1"}'
{ "id":"perf_e56dd21b-...", "type":"conversion", "value_minor":4900, "projected": false }
```

**200 OK.** It shows up in `performance/summary` (`events: 1, value_minor: 4900`). It looks like it
worked. But `"projected": false` means it never reached the metric tables that payouts read, so it
can never pay anyone. Only `click | sale | purchase | install | referral` (plus the raw metric keys)
project. Switching a single word changes everything:

```
$ ... -d '{"deployment":"dep_...","type":"sale","value_minor":4900,...}'
projected True
```

Nothing in the docs, the CLI help, the SDK README, or the response explains what `projected` means or
which types are accepted.

**Rating: TRAP** (arguably a BLOCKER — it is a silent money-loop failure).

**Minimal fix:** reject unmapped types with a typed `unsupported_event_type` error listing the
accepted set. If free-form types must stay, rename the response field to something self-evident
(`compensable: false`) and document the mapping table.

---

### T4 — `performance.events.create` is singular and flat, not the batch its name implies

The SDK exposes `performance.events.create` — plural noun, `create` verb. The natural first attempt:

```js
boomin.performance.events.create({ events: [{ type: "conversion", deployment: "dep_...",
                                              value: 4900, external_id: "order_1" }] })
```
```
[FAIL] InvalidRequestError code=invalid_request status=400
       msg=deployment: Invalid input: expected string, received undefined
```

The wire wants **one flat event**: `{deployment, type, occurred_at, value_minor, currency,
external_event_id}`. Three of the four obvious field names are wrong (`value`→`value_minor`,
`external_id`→`external_event_id`, and the array wrapper does not exist). The error message points at
`deployment` — a field the caller *did* supply, one level down — which sends the stranger looking for
a bad deployment id rather than a wrong envelope.

**Rating: TRAP.**

**Minimal fix:** either accept `{events:[...]}` as a batch (matching the method name), or rename the
SDK method to `performance.recordEvent(...)`. Document the field names either way; and have the
error report the full path (`events[0].deployment` vs `deployment`) so a nested payload is diagnosable.

---

### T5 — Every new program's Connect allowlist ships with another customer's domains

A brand-new org's first program comes back with:

```json
"allowed_origins": ["http://localhost:5173","http://localhost:4173",
                    "https://boomin.ai","https://atlantium.ai","https://www.atlantium.ai"]
```

Diagnosis found `defaultConnectOrigins` in `api/src/services/program-connect.ts` hardcoding a specific
customer's production domains into **every** brand's Connect config. The stranger's very first look at
their own configuration shows a third party's brand, pre-authorized against their program.

**Rating: TRAP** (tenancy/security-adjacent, and an embarrassing first impression at launch).

**Minimal fix:** delete the two `atlantium.ai` entries from `defaultConnectOrigins`. If Atlantium
depends on them, seed them on that brand's row instead of in the shared default.

---

### T6 — The stranger's own domain is never allowlisted, and nothing says so

Following from T5: the defaults are localhost + `boomin.ai` + someone else's domain. The founder's bar
is explicitly *a different domain*, so the embed fails on origin until the stranger finds
`connect_config` — which is undocumented (B1), and which needs `connect_config:read`/`connect_config:write`
scopes that no doc associates with this flow (T7), and which silently ignores the camelCase param the
README teaches (T1). Four separate gaps stack on one step.

**Rating: TRAP.**

**Minimal fix:** in the v1 quickstart, make "allowlist your domain" an explicit numbered step with the
snake_case payload; have `doctor` fail when the configured app origin is absent from `allowed_origins`.

---

### T7 — Token scopes are immutable, and the docs' own scope list is the wrong one

Minting a token with the scopes `doctor` itself suggests:

```
fix: npx @boomin/cli token create --name "Launcher" --scopes org:read,distributions:read,distributions:write,distributions:launch --save
```

…then hitting the connect-embed step:

```
[FAIL] programs.connectConfig.update:   PermissionError code=missing_scope status=403 msg=missing_scope:connect_config:write
[FAIL] programs.connectConfig.retrieve: PermissionError code=missing_scope status=403 msg=missing_scope:connect_config:read
```

`token rotate` explicitly "creates a replacement **with the same scope set**", so recovery means
minting a whole new token and re-deploying it. The error names the missing scope (good) but offers no
fix line (bad), and there is no `token update --add-scopes`.

**Rating: TRAP.**

**Minimal fix:** append the fix line to `missing_scope` errors —
`npx @boomin/cli token create --scopes <existing>,<missing>`. Publish one canonical
"scopes for the distribution flow" block in the quickstart.

---

### T8 — `--api-base` does not imply `--web-base`; the CLI will point you at prod while talking to local

```
$ boomin login --no-open --api-base http://127.0.0.1:8793/v1/app
Approve Boomin CLI login: https://boomin.ai/cli/login?code=TFIHA000
.............
```

The session is created on one environment and the approval URL points at another. There is no single
`--env` switch and no documented `BOOMIN_API_BASE` env var; four separate base flags
(`--api-base`, `--platform-api-base`, `--web-base`, `--connect-api-base`) must be kept in sync by hand.
Related: `doctor --api-base http://127.0.0.1:8793/v1` reports `FAIL API health: Route not found.` — the
flag wants `/v1/app`, and nothing says so — while `PASS Platform v1 API: v1 REST tree is reachable`
in the same output came from **prod**, because that base was not overridden.

**Rating: TRAP** (mixed-environment output presented as a single verdict).

**Minimal fix:** one `--env <prod|local|url>` flag (or `BOOMIN_ENV`) that derives all four bases;
have `doctor` print the base it probed next to every check.

---

### T9 — `payout export --out file.csv` can exit 0 and write nothing

The API's `download_url` comes from `presignR2Get(...)` wrapped in a bare `catch { }` that yields
`null`. The CLI's file write is gated on `if (flags.out && result.download_url)`. If presign
credentials are absent, the command prints a success block with an empty `Download:` line, writes no
file, prints no `Wrote ...`, and **exits 0**. A CI job would treat that as a successful payout export.

Locally the same step surfaced as a hard failure instead, because the object is written to wrangler's
local R2 simulator while the presigned URL points at real R2:

```
$ boomin payout export --period-start 2026-08-01 --period-end 2026-08-31 --out payouts.csv
CSV download failed with 404.
```

…even though the batch itself exported fine:

```
$ curl .../v1/platform/payouts/batches
{"id":"pob_ffafe08e-...","rail":"csv_batch","status":"exported","item_count":1,
 "total_amount_cents":500,"export_file_key":"payout-batches/<brand>/<batch>.csv",
 "export_format":"paypal_payouts_csv","exported_at":"2026-08-02T20:03:40.176Z"}
```

Note the batch is **consumed** by that attempt — re-running returns `payout_batch_empty`, so the
stranger's rows are now locked in a batch whose CSV they never received.

**Rating: TRAP.**

**Minimal fix:** when `--out` is requested and `download_url` is null, exit non-zero with
`payout_export_unconfigured`. Add a `GET /v1/platform/payouts/batches/:id/download` fallback that
streams the object through the worker so export never depends on presign credentials.

---

## PAPERCUTS

### P1 — CLI login is browser-only, which contradicts the docs' agent claim
The quickstart says "The whole referral-first install works with an AI agent driving it end to end."
It does not: every command that touches the app API funnels through `ensureLogin`, and
`login --no-open` still requires a human to open a URL.

```
$ boomin login --no-open
Approve Boomin CLI login: http://127.0.0.1:5173/cli/login?code=XJQCWQ00
.............                                   # polls until timeout
```

*Fix:* a device-code or PAT path (`boomin login --token <sk_...>`) for headless/agent use, or drop
the end-to-end-agent claim.

### P2 — The published scope reference is missing 20+ live scopes
`boomin scopes --json` ships **71**; `tokens-scopes/scopes.md` lists ~50 and omits every scope this
flow needs: `distributions:read|write|launch`, `deployments:read`, `enrollments:*`, `partnerships:*`,
`payouts:*`, `performance:*`, `connections:*`, `operations:read`, `partners:read`, `handoff:*`,
`program_requirements:*`, `program_tiers:*`.
*Fix:* generate `scopes.md` from the same registry the CLI reads.

### P3 — `handoff:read` appears twice in the scope registry
Visible in `boomin scopes --json` output. *Fix:* dedupe the table.

### P4 — `programs.create` has no documented parameters
The SDK resource table lists the method and nothing else.
```
[FAIL] programs.create: InvalidRequestError code=invalid_request status=400
       msg=type: Invalid option: expected one of "performance"|"upfront"
```
`"affiliate"` is the obvious guess for a partner program and is wrong. *Fix:* document
`{name, type, description, visibility, metadata}` with the enums.

### P5 — The deployment object never gives you the link URL
The launch-bar step is "confirm deployments **+ links** exist". What you actually get:
```json
"external_ids": { "code": "ep_1a475a032266", "promo_link_id": "5bfd3dd5-..." }
```
There is no `url` field anywhere on the deployment, and no doc gives the public URL shape. The
stranger can prove a link *exists* but cannot hand one to a partner.
*Fix:* add a resolved `url` to the deployment serializer.

### P6 — Doctor mixes environments in one verdict
Covered under T8; recorded separately because `doctor` is the command the docs tell you to trust
("verifies the whole install"). In this run it simultaneously reported a local FAIL and a prod PASS.

### P7 — `budget.reserve_failed` is emitted but nothing routes you to it
```
$ boomin events list --limit 20
1531  evt_4f360912-...  budget.reserve_failed  distribution:ac9f7da7-...  2026-08-02T19:57:26.607Z
```
The diagnostic exists and is good. No error message, help text, or doc mentions that
`boomin events list` is where launches explain themselves. *Fix:* reference the events feed in the
launch/operation error strings.

### P8 — Operational `seq` is a global counter
A brand-new org's first event is `seq 1529`, and the feed jumps 1531 → 1546 → 1561 → 1720. The gaps
are other tenants. It leaks platform-wide event volume and makes `--starting-after` paging look broken.
*Fix:* per-brand sequence, or expose an opaque cursor instead of a numeric seq.

### P9 — A stale `~/.boomin/config.json` silently ships a token to whatever base wins
Found a prod session token in `~/.boomin/config.json` from a previous run; commands that fall back to
the default base send it to prod without saying so. Not a stranger-facing issue, but it is how a
local rehearsal accidentally touches production. *Fix:* namespace saved credentials by API base and
refuse to send a token minted for one base to another.

---

## What could not be tested locally

| Step | Why | What the stranger faces on prod |
|---|---|---|
| USD wallet top-up | Real Stripe money at the platform boundary | No CLI/SDK/doc path at all (B3). Must find the web app's billing page unaided. |
| `payout export` file download | Wrangler's R2 simulator vs. real presigned URLs | Either a working download or a silent empty write (T9) — cannot tell which without prod. |
| Stripe Connect payout rail | Needs platform approval for transfers-only Express | `payout connect` shows `Stripe configured: yes` with 0 payout-enabled accounts; the partner-onboarding path is app-only. |
| Real OTP email delivery | Local prints to the worker log (`sent: false`) | Deliverability is the first impression of the product; untested here. |

---

## Transcript index

Everything quoted above was captured live in this run against `api@dabead4` on
`http://127.0.0.1:8793`. Objects created during the rehearsal (dev Neon):

- org `5bf3cebc-8506-46c0-9763-0d6133ab1105` / brand `d13c5214-f540-481a-930e-e8de75ad1847`
  (`ada.stranger@coldstart-labs.dev`)
- program `prog_8c11f8d4-ac1b-498c-a0aa-1149f5e50460`
- enrollment `enr_556aab66-...`, partnership `pship_52b0290b-...`, partner `ptnr_43215ec6-...`
- distributions: `dist_ac9f7da7-...` (funded, stuck `launching`), `dist_eb045894-...` (funded,
  canceled), `dist_84c173b6-...` (metered, **active, 1/1 live**)
- deployment `dep_62a5ed6f-...` → promo code `ep_1a475a032266`
- payout `po_330f41d1-...` (500¢, `awaiting_account`), batch `pob_ffafe08e-...` (`exported`)

The one genuinely good news from the run: once the budget is `metered`, the core loop is clean and
fast, and the recovery verbs work.

```
$ boomin distribution launch dist_84c173b6-3052-4e95-94c3-59d715f008b2 --timeout 60
Waiting on op_658453b3-4276-4c2c-b530-7d05f6c51032 ...
Status: succeeded
Status: active
Deployments: 1/1 live
```

The machinery is there. What is missing is the map.
