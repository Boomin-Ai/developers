---
title: entities
description: The durable identity you have relationships with — canonical since RELATIONSHIP_CORE.
---

An **entity** is a durable identity capable of holding a relationship with your
brand: a creator, an affiliate, an advisor, an agency, another company. Entities
exist independently of any one program and independently of any one brand.

This is the canonical name for what the API called a **entity**. The old
spelling is an alias forever — see the note below.

You never create an entity directly. Inviting someone by email
([`enrollments.create`](/sdk/resources/enrollments/)) upserts the identity,
opens the durable [relationship](/sdk/resources/relationships/), and creates the
enrollment in one call. [Signed Handoff](/partner-connect/signed-handoff/) and
[Partner Connect](/partner-connect/browser-sdk/) converge on the same identity.

```js
const page = await boomin.entities.list({ email: "creator@example.com" });
const entity = await boomin.entities.retrieve("ent_...");
```

| Method | Route | Scope |
| --- | --- | --- |
| `list(params, options)` | `GET /entities` | `entities:read` |
| `retrieve(id, options)` | `GET /entities/{id}` | `entities:read` |

## The entity object

```json
{
  "id": "ent_...",
  "object": "entity",
  "kind": "person",
  "name": "Creator",
  "email": "creator@example.com",
  "metadata": {},
  "livemode": true,
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```

## Entity vs relationship vs enrollment

These three are routinely confused, and the distinction is load-bearing:

| Object | Scope | Lifetime |
| --- | --- | --- |
| **Entity** | Global identity | Outlives every brand relationship |
| **Relationship** | One brand ↔ one entity | Outlives every program |
| **Enrollment** | One relationship in one program | Carries the program `referralCode` |

An entity in two of your programs has **one** relationship and **two**
enrollments — which is exactly why billing counts distinct relationships, not
enrollments. See [Pricing](/pricing/).

What your brand privately knows about an entity attaches to the relationship,
not the identity: [assertions](/sdk/resources/assertions/) are your claims,
[operating types](/sdk/resources/operating-types/) are the capacity an
enrollment operates in. The identity itself stays thin on purpose.

:::note[`entities` is the deprecated spelling — alias forever]
`boomin.entities` still works and always will: it is a deprecated getter that
**delegates** to `boomin.entities`, so calls ride the canonical `/entities`
routes. Old `ent_...` ids are accepted everywhere forever; responses emit
`ent_...` and `object: "entity"`. The legacy `entities:read` scope stays
honored (canonical: `entities:read`). Webhook payloads stored before the flip
keep deserializing.
:::

## Where an entity comes from

| Entry point | What happens |
| --- | --- |
| `enrollments.create({ email })` | Entity upserted by email, relationship opened `pending`, enrollment created `(pending, active)` |
| [Partner Connect](/partner-connect/browser-sdk/) OTP join | Same, driven from the browser by the entity |
| [Signed Handoff](/partner-connect/signed-handoff/) | Same, with your app vouching for the identity instead of an OTP — and binding the `(issuer, externalUserId)` pair that [assertions](/sdk/resources/assertions/) can address |
| [Discover](/partner-programs/discover/) application | Same, initiated from the public feed |

Every path converges on the same identity, so a creator who joined by OTP and
was later invited by email is one entity, not two.
