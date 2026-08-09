---
title: partners
description: The durable partner identity — and where to read it in this release.
---

A **partner** is a durable identity capable of distributing value: a creator, an
affiliate, an agency, another brand. Partners exist independently of any one
program and independently of any one brand.

You never create a partner directly. Inviting someone by email
([`enrollments.create`](/sdk/resources/enrollments/)) upserts the partner
identity, opens the durable partnership, and creates the enrollment in one call.

```js
const enrollment = await boomin.enrollments.create({
  program: "prog_...",
  email: "creator@example.com",
  name: "Creator",
});
// enrollment.partner === "ptnr_..."
```

:::caution[No `/partners` routes in this release]
The client exposes `partners.retrieve(id)` and `partners.list()`, and the
`partners:read` scope is issuable — but the v1 REST tree does not serve
`/v1/platform/partners` yet, so those two calls 404 today.

Read partner identity from the surfaces that **do** serve it:

- `boomin.partnerships.list()` embeds
  `partner: { id, name, email }` on every row.
- `boomin.partnerships.retrieve(id)` embeds the same object plus the
  partnership's enrollments.
- `boomin.enrollments.*` returns `partner` as a `ptnr_...` id string.
:::

## Reading a partner today

```js
for await (const partnership of boomin.partnerships.list()) {
  const { id, name, email } = partnership.partner;
  console.log(id, name, email, partnership.status);
  // ptnr_...  Creator  creator@example.com  active
}
```

## Partner vs partnership vs enrollment

These three are routinely confused, and the distinction is load-bearing:

| Object | Scope | Lifetime |
| --- | --- | --- |
| **Partner** | Global identity | Outlives every brand relationship |
| **Partnership** | One brand ↔ one partner | Outlives every program |
| **Enrollment** | One partnership in one program | Carries the program `referralCode` |

A partner in two of your programs has **one** partnership and **two**
enrollments — which is exactly why billing counts distinct partnerships, not
enrollments. See [Pricing](/pricing/).

## Where a partner comes from

| Entry point | What happens |
| --- | --- |
| `enrollments.create({ email })` | Partner upserted by email, partnership opened `pending`, enrollment created `(pending, active)` |
| [Partner Connect](/partner-connect/browser-sdk/) OTP join | Same, driven from the browser by the partner |
| [Signed Handoff](/partner-connect/signed-handoff/) | Same, with your app vouching for the identity instead of an OTP |
| [Discover](/partner-programs/discover/) application | Same, initiated from the public feed |

Every path converges on the same identity, so a creator who joined by OTP and
was later invited by email is one partner, not two.
