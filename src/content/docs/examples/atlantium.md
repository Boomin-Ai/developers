---
title: Atlantium Reference
description: The first production-style Creator Connect customer integration.
---

Atlantium is the first customer-style reference integration.

## Public page

```txt
https://atlantium.ai/creator-program
```

The page owns the visual UI. Boomin owns:

- Signed handoff from Atlantium's logged-in profile.
- Instagram OAuth.
- Durable creator session state.
- Program member creation.
- Pending approval status.
- Admin approve/reject.

## Clean redirect URI

```txt
https://atlantium.ai/creator-program
```

The integration intentionally avoids using a stale URL with prior `boomin_status`, `boomin_error`, or hash fragments.

## Expected success state

After OAuth, the creator returns to Atlantium with:

```txt
boomin_session_id=...
boomin_status=pending_approval
boomin_username=...
```

Atlantium then calls `Boomin.getConnectStatus(sessionId)` to read durable state from Boomin.

## Signed handoff

Atlantium authenticates users with Better Auth and signs the active profile into Boomin:

```txt
externalUserId = atlantium_profile_<profile_id>
issuer = atlantium.ai
audience = boomin.ai
```

If the user is not logged into Atlantium, the creator page sends them through Atlantium login first. The older Boomin OTP-first flow remains available as a fallback for public pages without app accounts.

## Admin surface

Admins review creators in Boomin:

```txt
Connect > Partners > Members
```

Approving a connected creator makes them active and billable for the program.
