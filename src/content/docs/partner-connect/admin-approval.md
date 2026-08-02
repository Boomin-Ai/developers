---
title: Admin Approval
description: Approve and reject creators after they connect.
---

Boomin treats program membership as the source of truth for creator status.

## Member states

- `pending`: creator verified email and/or connected Instagram, but is not approved yet.
- `approved`: creator is accepted into the program.
- `rejected`: creator is blocked from program activation.

## Connection states

- `disconnected`: creator has not completed Instagram OAuth.
- `connected`: creator has a linked Instagram integration.

## Billable creator rule

A creator is billable only when both conditions are true:

```txt
approval_status = approved
connection_status = connected
```

## Admin queue

The Boomin dashboard under `Connect > Partners` shows:

- Name and email.
- Instagram username, avatar, and follower count.
- Referral code.
- Source, usually `boomin_connect`.
- Approval status.
- Connection status.
- Approve and reject actions.

After approval or rejection, `Boomin.getConnectStatus(sessionId)` reflects the durable state.
