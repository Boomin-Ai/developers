---
title: Discover Listing
description: Opt a partner program into Boomin Connect's public Discover feed so creators can find it and apply.
---

Programs are **private by default**. Listing is opt-in: a listed program appears in Boomin Connect's public Discover feed, where creators browse open programs at `boomin.ai/connect` and apply with one click.

## List at creation

```bash
npx @boomin/cli init --list
```

Without `--list`, interactive `init` asks:

```txt
List this campaign on Boomin Connect discover? (y/N)
```

The default answer is No. Running `init --list` against an existing program flips it to listed; running `init` without the flag never changes an existing program's visibility.

## List from the dashboard

Brand admins can toggle **List on Connect discover** at any time from the program dashboard at `boomin.ai` under **Entities**. Unlisting removes the program from the feed immediately; existing members are unaffected.

Check the current state from the CLI:

```bash
npx @boomin/cli status
# Listed on Connect discover: yes | no (private)
```

## The public feed

Listed programs are served from a public, unauthenticated endpoint:

```bash
curl "https://api.boomin.ai/v1/connect/discover?limit=20&offset=0"
```

```json
{
  "programs": [
    {
      "id": "…",
      "name": "Launch Creator Program",
      "description": "Partner Connect program",
      "brandName": "Acme",
      "requirements": [
        {
          "scope": "…",
          "metricKey": "…",
          "operator": "…",
          "threshold": 0,
          "windowDays": 30,
          "source": "…",
          "required": true
        }
      ],
      "createdAt": "…",
      "listedAt": "…"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "hasMore": false }
}
```

- Only programs a brand explicitly listed — and that are still active on a live brand — appear.
- The payload is display-safe: program card fields plus a requirements summary. Never keys, secrets, or member data.
- Offset-paginated, newest listing first. `limit` is capped at 50.

## What creators see

Creators browse the Discover feed at `boomin.ai/connect`, apply to a program, and track their applications and memberships in one place. Applications land in the brand's applications inbox on the Entities dashboard for approve/reject. See [In-app Dashboards](/partner-programs/dashboard/).
