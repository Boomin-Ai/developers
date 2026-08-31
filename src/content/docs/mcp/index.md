---
title: Boomin MCP
description: Install Boomin as an agent-native MCP server for referral-first setup and program operation.
---

Boomin MCP lets agents install and operate Boomin with structured tools instead of guessing from terminal output.

Recommended install:

```bash
npx @boomin/cli@latest skill install
npx @boomin/cli@latest mcp install
npx @boomin/cli@latest doctor
```

Restart Claude Code or Codex after install. The skill teaches the agent when to use Boomin; MCP gives it live tools.

Manual hosted MCP:

```bash
claude mcp add --transport http boomin https://mcp.boomin.ai/mcp
```

Local skill-only install:

```bash
npx @boomin/cli@latest skill install --target claude
npx @boomin/cli@latest skill install --target codex
```

## How auth works

There are two supported paths:

1. `npx @boomin/cli@latest mcp install` logs you into Boomin, creates a scoped platform token, and writes a static `Authorization: Bearer ...` header into Claude Code's user MCP config.
2. OAuth-aware MCP clients can add `https://mcp.boomin.ai/mcp`; the first call returns an OAuth challenge and opens Boomin consent at `https://mcp.boomin.ai/authorize`.

Both paths end with the same scoped platform token model. Tokens are revocable, audited, and limited by the selected skill pack. MCP never bypasses the Platform API's scopes, create limits, audit logs, or idempotency.

## Skill packs

`Referral Program Installer` is the default pack. It can diagnose setup, scaffold referral-first routes, verify install, read entity standing, and record a test event.

`Program Operator` is admin-only and opt-in. It can update required channels, referral settings, program requirements, tiers, and run evaluation.

## Tools

Referral installer:

- `boomin.doctor`
- `boomin.detect_project`
- `boomin.get_connect_config`
- `boomin.scaffold_referral_first`
- `boomin.verify_referral_install`
- `boomin.get_entity_standing`
- `boomin.record_test_event`

Program operator:

- `boomin.get_program`
- `boomin.update_program`
- `boomin.update_required_channels`
- `boomin.update_referral_settings`
- `boomin.list_program_requirements`
- `boomin.create_program_requirement`
- `boomin.update_program_requirement`
- `boomin.delete_program_requirement`
- `boomin.list_program_tiers`
- `boomin.create_program_tier`
- `boomin.update_program_tier`
- `boomin.evaluate_program`
- `boomin.preview_qualification`

Write tools use the same scoped platform token model, audit logs, create limits, and idempotency rules as the Platform API.

## What agents should ask for

Good prompts after install:

```text
Use Boomin to add a entity referral program to this app.
```

```text
Use the Boomin referral installer skill. Check doctor first, then install referral-first routes.
```

```text
Use Boomin MCP to inspect the program config and verify referral setup.
```
