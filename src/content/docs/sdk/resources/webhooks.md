---
title: webhooks
description: Manage delivery endpoints, subscriptions, and signing-secret rotation.
---

This page is about **managing** endpoints. For verifying and handling
deliveries, see [Receiving webhooks](/sdk/webhooks/).

```js
const { webhook_endpoint } = await boomin.webhooks.endpoints.create({
  url: "https://your-app.com/webhooks/boomin",
  description: "Production",
  enabled_events: ["distribution.live", "payout.settled"],
});
console.log(webhook_endpoint.id, webhook_endpoint.secret);
// we_...  whsec_...
```

| Method | Route | Scope |
| --- | --- | --- |
| `endpoints.create(params, options)` | `POST /webhook_endpoints` | `webhooks:write` |
| `endpoints.list(params, options)` | `GET /webhook_endpoints` | `webhooks:read` |
| `endpoints.retrieve(id, options)` | `GET /webhook_endpoints/{id}` | `webhooks:read` |
| `endpoints.update(id, params, options)` | `POST /webhook_endpoints/{id}` | `webhooks:write` |
| `endpoints.rotateSecret(id, params, options)` | `POST /webhook_endpoints/{id}/rotate_secret` | `webhooks:write` |
| `endpoints.del(id, options)` | `DELETE /webhook_endpoints/{id}` | `webhooks:write` |

Endpoints are **organization**-scoped, not brand-scoped: one endpoint receives
every brand's events in the org, and each event carries its own subject.

## The wrapper

Webhook endpoints are the one resource in the API that is **not** returned bare.
`create`, `retrieve`, `update`, and `rotateSecret` all answer:

```json
{ "webhook_endpoint": { "id": "we_...", "object": "webhook_endpoint", ... } }
```

`list` is a normal `{ object: "list", data, has_more }` envelope of unwrapped
endpoint objects, and `del` answers a bare
`{ id, object, deleted: true }`.

```js
const { webhook_endpoint } = await boomin.webhooks.endpoints.retrieve("we_...");
const { data } = await boomin.webhooks.endpoints.list();
```

## The endpoint object

```json
{
  "id": "we_...",
  "object": "webhook_endpoint",
  "url": "https://your-app.com/webhooks/boomin",
  "description": "Production",
  "enabled_events": ["distribution.live", "payout.settled"],
  "status": "enabled",
  "secret": "whsec_...",
  "rotated_at": null,
  "livemode": true,
  "created_at": "2026-08-01T00:00:00.000Z",
  "updated_at": "2026-08-01T00:00:00.000Z"
}
```

:::danger[`secret` appears exactly twice in an endpoint's life]
In the `create` response, and in each `rotate_secret` response. `retrieve`,
`update`, and `list` never carry it. Store it the moment you receive it — there
is no "show me the secret again".
:::

## create

```js
await boomin.webhooks.endpoints.create({
  url: "https://your-app.com/webhooks/boomin",  // required
  description: "Production",                     // optional, ≤ 500 chars
  enabled_events: ["distribution.live"],         // optional, ≤ 100 entries
});
```

Answers **201**.

**URL rules.** `https` is required. Plain `http` is accepted only for loopback
(`localhost`, `127.0.0.1`, `[::1]`) so local development works. Anything else is
`invalid_request` (400).

**Subscriptions.** Every entry in `enabled_events` must come from the
[public event vocabulary](/sdk/resources/events/); an unknown type is
`invalid_event_type` (400) naming the offenders. An empty or omitted
`enabled_events` subscribes the endpoint to **all** public types.

**No backfill.** A new endpoint receives events appended **at or after** its
creation. To cover the gap, page [`events.list`](/sdk/resources/events/) by
`seq`.

## update

```js
await boomin.webhooks.endpoints.update("we_...", {
  enabled_events: ["distribution.live", "distribution.failed", "payout.settled"],
  status: "disabled",
});
```

Every field is optional; omitted fields are left alone. `status` accepts
`enabled` or `disabled` — disabling stops delivery without destroying the
endpoint or its secret, which is what you want during an incident.

A disabled endpoint exhausts any in-flight deliveries immediately rather than
retrying them.

## rotateSecret

```js
const { webhook_endpoint } = await boomin.webhooks.endpoints.rotateSecret("we_...");
console.log(webhook_endpoint.secret); // the NEW secret, shown once
```

Installs a fresh `whsec_...` and keeps the **previous** secret honored for a
**24-hour overlap window**. During the window every delivery carries two `v1`
signature entries — current first, previous second — so a receiver holding
either verifies.

:::caution[Do not chain two rotations inside 24 hours]
Only the most recent old secret is honored. Rotating again inside the window
replaces the previous secret and can strand receivers still holding it.
:::

Full zero-downtime procedure: [Receiving webhooks](/sdk/webhooks/#secret-rotation).

## del

```js
await boomin.webhooks.endpoints.del("we_...");
// { id: "we_...", object: "webhook_endpoint", deleted: true }
```

Hard deletion — the endpoint is gone, along with its secrets. `DELETE` honors
`Idempotency-Key` like every other mutation, and the idempotency cache is
consulted *before* the row lookup, so a replayed delete returns the cached
response instead of 404ing on the endpoint it already removed.

Prefer `update({ status: "disabled" })` when you might want the endpoint back.
