---
title: React Creator Flow
description: Account-first Partner Connect in a React app.
---

This example matches the recommended customer flow: email first, OTP second, Instagram third.

```jsx
import { useEffect, useState } from "react";
import Boomin from "@boomin/connect";

Boomin.init({
  publicKey: import.meta.env.VITE_BOOMIN_PUBLIC_KEY,
  programId: import.meta.env.VITE_BOOMIN_PROGRAM_ID,
  apiBase: import.meta.env.VITE_BOOMIN_API_BASE,
  redirectUri: window.location.origin + window.location.pathname,
});

export default function CreatorSignup() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("start");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const result = Boomin.consumeRedirectResult();
    if (!result?.sessionId) return;

    Boomin.getConnectStatus(result.sessionId).then((next) => {
      setStatus(next.status);
      setMessage(next.username ? `@${next.username} is ${next.status}` : next.status);
    });
  }, []);

  async function requestOtp(event) {
    event.preventDefault();
    await Boomin.requestOtp({ email, name });
    setStatus("otp");
  }

  async function verifyOtp(event) {
    event.preventDefault();
    await Boomin.verifyOtp({ email, name, code });
    setStatus("verified");
  }

  async function connectInstagram() {
    await Boomin.connectInstagram({
      requireCreator: true,
      referralCode: new URLSearchParams(window.location.search).get("ref"),
      metadata: { source: "react_creator_flow" },
    });
  }

  return (
    <main>
      {status === "start" && (
        <form onSubmit={requestOtp}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <button>Send code</button>
        </form>
      )}

      {status === "otp" && (
        <form onSubmit={verifyOtp}>
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="OTP code" />
          <button>Verify email</button>
        </form>
      )}

      {status === "verified" && (
        <button onClick={connectInstagram}>Connect Instagram</button>
      )}

      {message && <p>{message}</p>}
    </main>
  );
}
```

For a working package example, see `packages/connect/examples/react-account-first` in the Boomin repo.
