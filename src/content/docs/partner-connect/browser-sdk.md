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

## Public API

```ts
Boomin.init(options)
Boomin.requestOtp(options)
Boomin.verifyOtp(options)
Boomin.getCurrentCreator()
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
