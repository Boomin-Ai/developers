---
title: Browser SDK
description: Use @boomin/connect in a browser app or from the CDN.
---

`@boomin/connect` is the customer-facing browser SDK for Partner Connect. It is intentionally UI-light: you bring the page, button, form, and styling; Boomin supplies the auth and program state.

## NPM import

```bash
npm install @boomin/connect
```

```js
import Boomin from "@boomin/connect";

Boomin.init({
  publicKey: "pk_live_...",
  programId: "program-id",
  apiBase: "https://api.boomin.ai/v1/connect",
  redirectUri: window.location.origin + window.location.pathname,
});
```

## CDN global

```html
<script src="https://cdn.boomin.ai/boomin-connect.js"></script>
<script>
  window.Boomin.init({
    publicKey: "pk_live_...",
    programId: "program-id",
    redirectUri: window.location.origin + window.location.pathname
  });
</script>
```

## Joining a program: requestOtp → verifyOtp → joinProgram

A member is only ever created for an email the person has proven they control. So the join is
three calls, in this order:

```js
// 1. Email a one-time code to the address.
await Boomin.requestOtp({ email: "partner@example.com", name: "Partner" });

// 2. Exchange the code for a partner token. The SDK stores it for later calls.
await Boomin.verifyOtp({ email: "partner@example.com", code: "123456" });

// 3. Join the program, authenticated as the now-verified partner.
await Boomin.joinProgram({ name: "Partner" });
```

Already holding a partner token from a signed server handoff? Pass it straight in and skip
the first two steps:

```js
await Boomin.joinProgram({ authToken: tokenFromHandoff });
```

### Breaking change in @boomin/connect 0.2.0

`joinProgram` used to accept an `email` and create the member from it. It no longer does, and
`POST /v1/connect/join` now requires a partner bearer token, so an unverified email cannot
produce a program member. Calling `joinProgram()` with no token available rejects immediately —
client-side, before any network request — with `error.code === "missing_partner_token"`:

```js
try {
  await Boomin.joinProgram();
} catch (error) {
  if (error.code === "missing_partner_token") {
    // Send them through requestOtp / verifyOtp first.
  }
}
```

Passing `email` to `joinProgram` is now ignored and logs a console warning. Replace
`joinProgram({ email })` with the three-step flow above. `requestOtp`, `verifyOtp`, and the
Instagram OAuth session flow are unchanged.

## Public API

```ts
Boomin.init(options)
Boomin.requestOtp(options)
Boomin.verifyOtp(options)
Boomin.joinProgram(options)      // requires a verified partner token
Boomin.getCurrentCreator()
Boomin.getProgramStatus(options)
Boomin.connectInstagram(options)
Boomin.getConnectStatus(sessionId)
Boomin.attachConnectButton(selector, options)
Boomin.on(eventName, handler)
```

## Events

```js
Boomin.on("auth:otp_sent", console.log);
Boomin.on("auth:verified", console.log);
Boomin.on("creator:pending", console.log);
Boomin.on("connect:pending_approval", console.log);
Boomin.on("connect:approved", console.log);
Boomin.on("connect:error", console.error);
```

## Styling

Boomin does not force an iframe or default button design. You can style your own button:

```html
<button id="connect-instagram" class="brand-connect-button">
  Connect Instagram
</button>
```

```js
Boomin.attachConnectButton("#connect-instagram", {
  label: "Connect Instagram",
  loadingLabel: "Opening Instagram...",
  pendingLabel: "Pending approval",
  requireCreator: true,
});
```

The helper updates text and `data-boomin-connect` state. Your CSS stays in control.
