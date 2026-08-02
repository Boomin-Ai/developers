---
title: Account-first Flow
description: Collect email first, then connect Instagram.
---

Account-first Partner Connect is the recommended flow for brand programs.

It solves the biggest direct-social problem: if a creator connects Instagram first, the brand may not have a reliable email address for approval, rejection, or campaign notifications.

## Flow

1. Creator enters email and optional name.
2. Boomin sends an OTP.
3. Creator verifies OTP.
4. Boomin creates or updates the creator user, contact, and program member.
5. Creator connects Instagram.
6. Boomin updates the same program member with Instagram identity.
7. The creator lands in `pending_approval`.
8. Admin approves or rejects in Boomin.

## Required SDK behavior

Use `requireCreator: true` when starting Instagram:

```js
await Boomin.connectInstagram({ requireCreator: true });
```

If there is no verified creator token in browser storage, Boomin rejects the session create request with `401 creator_auth_required`.

## Redirect URI

Use a clean page URL, not the current URL with old query params:

```js
redirectUri: window.location.origin + window.location.pathname
```

For Atlantium, that is:

```txt
https://atlantium.ai/creator-program
```

## Durable OAuth state

Boomin creates a durable session before sending the creator to Instagram. The Instagram OAuth `state` is the session id. The callback uses that session id to link the Instagram integration back to the verified creator/member.

This avoids relying on cookies, stale `/me` state, or query params after a redirect.
