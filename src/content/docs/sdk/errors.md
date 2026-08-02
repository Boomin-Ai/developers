---
title: Errors
description: The BoominErrorCode registry — what each code means, its HTTP status, and how to recover.
---

Every non-2xx response from the Platform API uses one frozen envelope:

```json
{
  "error": {
    "code": "distribution_not_ready",
    "message": "Distribution must be validated before launch.",
    "param": null,
    "request_id": "req_9f2c..."
  }
}
```

`code` is the contract — branch on it, not on `message` and not on the status
alone. `request_id` is also returned as the `Request-Id` response header; quote
it in support requests.

## Error classes

The SDK picks a class first from the typed `code`, then from the HTTP status:

```js
import {
  BoominError,
  AuthenticationError,
  PermissionError,
  InvalidRequestError,
  RateLimitError,
  ConflictError,
  APIError,
  OperationConflictError,
  BandLimitReachedError,
  FundingRequiredError,
  WebhookSignatureVerificationError,
} from "@boomin/sdk";
```

Every one extends `BoominError`, which carries:

| Property | Meaning |
| --- | --- |
| `code` | Typed `BoominErrorCode`, or `null` for pre-flight/connection errors |
| `status` | HTTP status, or `null` when the request never reached the API |
| `requestId` | Echoed request id |
| `param` | The offending parameter, when the API names one |
| `raw` | The raw `error` object from the body |

```js
try {
  await boomin.distributions.launch(id);
} catch (err) {
  if (err instanceof FundingRequiredError) {
    // top up the wallet; the launch operation is waiting, not dead
  } else if (err instanceof OperationConflictError) {
    // a live operation already holds this subject — poll it instead
  } else if (err instanceof RateLimitError) {
    // back off; the SDK already retried maxRetries times
  } else if (err instanceof BoominError) {
    console.error(err.code, err.status, err.requestId);
  }
}
```

Status → class mapping: `400/402/404/422` → `InvalidRequestError`, `401` →
`AuthenticationError`, `403` → `PermissionError`, `409` → `ConflictError`,
`429` → `RateLimitError`, anything else → `APIError`. Four codes are promoted to
their own class: `operation_conflict` and `cancellation_in_progress` →
`OperationConflictError`, `band_limit_reached` → `BandLimitReachedError`,
`funding_required` → `FundingRequiredError`.

## Automatic retries

The SDK retries `429` and `5xx` up to `maxRetries` (default 2) with jittered
exponential backoff, honouring `Retry-After` when present. Mutations are safe to
retry because they always carry an `Idempotency-Key`. Connection errors and
timeouts are retried too; 4xx (other than 429) never is.

## Code registry

### Authentication and tokens

| Code | HTTP | What it means | Recover by |
| --- | --- | --- | --- |
| `platform_token_required` | 401 | No `Authorization: Bearer` header. v1 is Bearer-only — there is no body-token affordance. | Send the header. |
| `platform_token_unknown` | 401 | The key does not exist. | Check for a truncated paste; mint a new key. |
| `platform_token_inactive` | 401 | The key was revoked. | Mint a replacement under **Developers**. |
| `platform_token_expired` | 401 | The key passed its expiry. | Rotate the key. |
| `platform_token_org_missing` | 401 | The key's organization no longer resolves. | Contact support. |
| `missing_scope` | 403 | The key lacks the scope the route requires. The message is `missing_scope:<scope>`. | Mint a key with that scope; see [Scopes](/tokens-scopes/scopes/). |
| `test_mode_not_yet_available` | 400 | You sent an `sk_test_`/`pk_test_` key. Test mode is reserved but not built. | Use a live key against a disposable brand, and `validate()` / dry runs for launch-era testing. |
| `developer_access_paused` | 503 | The platform surface is paused by an operator kill switch. | Retry later; check status. |

### Request shape

| Code | HTTP | What it means | Recover by |
| --- | --- | --- | --- |
| `invalid_request` | 400 | Body or parameter failed validation. `param` names the field. | Fix the named field. |
| `invalid_cursor` | 400 | `starting_after` does not reference a known object of that type. | Restart pagination from the first page. |
| `invalid_status` | 400 | A `status` filter value is not in that resource's set. | Use a documented status value. |
| `invalid_event_type` | 400 | An event type is not in the public vocabulary. | Use a type from the [events vocabulary](/sdk/resources/events/). |
| `invalid_period` | 400 | `period_start` is not before `period_end`. | Order the dates. |
| `idempotency_key_conflict` | 409 | The same `Idempotency-Key` was reused with a *different* body. | Use a fresh key for a genuinely different request. |
| `create_rate_limit_exceeded` | 429 | Creation rate limit hit. | Back off and retry. |

### Not found

`brand_not_found`, `distribution_not_found`, `deployment_not_found`,
`enrollment_not_found`, `partnership_not_found`, `connection_not_found`,
`operation_not_found`, `program_not_found`, `partner_not_found`,
`payout_batch_not_found`, `webhook_endpoint_not_found` — all **404**.

These are returned identically for "does not exist", "belongs to another
organization", and "is a malformed id". That is deliberate: existence is never
leaked across tenants.

### Lifecycle conflicts (409)

The state machine refused the verb. Read the object's current `status` and
either wait or take the legal transition.

| Code | Refused because |
| --- | --- |
| `distribution_not_editable` | `update()` outside `draft` \| `ready`. |
| `distribution_programs_draft_only` | Program associations may only change in `draft`. |
| `distribution_not_validatable` | `validate()` outside `draft` \| `ready`. |
| `distribution_not_ready` | `launch()` before validation put it in `ready`. |
| `distribution_not_pausable` | `pause()` outside `active` \| `partially_active`. |
| `distribution_not_resumable` | `resume()` outside `paused`. |
| `distribution_not_cancelable` | Already terminal. |
| `deployment_not_pausable` / `_resumable` / `_cancelable` | Same, per deployment. |
| `enrollment_not_pausable` / `_resumable` | Participation status already there, or archived. |
| `partnership_not_pausable` / `_resumable` / `_endable` | Partnership status already there, or ended. |
| `connection_not_revocable` | The connection — or every grant on it — is already revoked. |

### Execution kernel

| Code | HTTP | What it means | Recover by |
| --- | --- | --- | --- |
| `operation_conflict` | 409 | A live operation already holds this subject's concurrency slot. | Retrieve the live operation and poll it instead of enqueueing a second. |
| `cancellation_in_progress` | 409 | A cancel is holding the subject's control gate; mutations are refused. | Wait for the cancel operation to settle. |
| `cancellation_requires_intervention` | 409 | A previous cancel failed with unresolved teardown. The gate stays closed by design. | The error carries the failed operation id — an operator must retry or resolve it. |
| `channel_type_not_yet_supported` | 422 | No registered adapter supports that `mode`/`medium`/`channel`/`format`. | Use a supported slot combination. `validate()` surfaces this before launch. |

Repeating `cancel()` on a subject that already has a live cancel is idempotent —
it returns the existing control operation rather than erroring.

### Measurement

| Code | HTTP | What it means | Recover by |
| --- | --- | --- | --- |
| `performance_event_identity_required` | 422 | Neither `idempotency_key` nor `external_event_id` was supplied. | Always send one; it is what makes ingestion exactly-once. |
| `deployment_distribution_mismatch` | 409 | The deployment/distribution pair does not agree. | Send only `deployment` and let the API resolve the distribution. |

### Billing

| Code | HTTP | What it means | Recover by |
| --- | --- | --- | --- |
| `band_limit_reached` | 402 | The organization's active-partner band is full. | Upgrade the band; see [Pricing](/pricing/). |

### Funding

`funding_required` is not an error code in the registry — it is an operation
**`waiting_reason`**. A funded launch with an underfunded wallet parks the
operation at `status: "waiting"`, `waiting_reason: "funding_required"`, and
resumes once the wallet is topped up. The SDK's `FundingRequiredError` exists
for surfaces that raise the same condition synchronously.

### SDK-local codes

Raised by the client, never by the API:

| Code | Raised when |
| --- | --- |
| `operation_wait_timeout` | `operations.wait()` exceeded its `timeout`. The operation is still running — poll again. |
| `webhook_signature_invalid` | `constructEvent` could not verify the signature. |
| `request_timeout` | The HTTP request exceeded `timeout`. |
| `connection_error` | The request never reached the API. |
| `internal_error` | The API returned an unparseable body. |
