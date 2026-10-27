# Open Bounty Settlement — v0.1 (Draft)

**How a program credits a shopper for an order.**

The [bounty object](SPEC.md) *declares* that buying at a store pays the shopper. This document
defines the other half: how an order reaches the program that pays, and what the shopper's credit
goes through before it's theirs to keep. A program that publishes a bounty object should be able to
settle it this way. A store, checkout, or platform adapter that sends orders to a program should
send them in this shape.

It's deliberately small, and independent of any one program, platform, or currency. License:
CC0-1.0, like the rest of this repository.

The keywords MUST, SHOULD, and MAY are used as in RFC 2119.

---

## 1. Roles

| Role | What it does |
|---|---|
| **Store** | Where the shopper buys. Usually it isn't the sender itself: its checkout, platform, or an adapter sends events on its behalf. |
| **Sender** | Whatever delivers order events to the program: a platform webhook relay, a checkout integration, an adapter. |
| **Program** | The rewards program that credits the shopper. It receives events, decides the credit, and runs the hold. |
| **Shopper** | The person credited, identified the way the program identifies its members. |

A program MUST say which stores it settles for. A store's own bounty object says the bounty exists;
the program's acceptance of the store's events is what makes it pay.

## 2. The order event

The sender POSTs one JSON object per event to the program's settlement endpoint, over HTTPS.

```json
{
  "settlement_version": "0.1",
  "type": "order.paid",
  "idempotency_key": "shop.example:order:5531001:paid",
  "order_id": "5531001",
  "store_domain": "shop.example",
  "total": { "amount": "84.50", "currency": "USD" },
  "line_items": [
    { "id": "sku-1042", "quantity": 1, "amount": "62.00" },
    { "id": "sku-2210", "quantity": 1, "amount": "22.50" }
  ],
  "shopper": { "id": "mbr_8f2c91", "id_type": "member_id" },
  "occurred_at": "2026-10-14T18:22:05Z"
}
```

| Field | Req | Meaning |
|---|---|---|
| `settlement_version` | yes | Version of this document the event follows. `"0.1"`. |
| `type` | yes | `order.paid` (credit the order), `order.refunded` (money went back to the shopper, in full or in part), `order.cancelled` (the order won't be fulfilled). |
| `idempotency_key` | yes | Unique per event, chosen by the sender. **Retries MUST reuse it.** A program MUST NOT credit or reverse the same key twice. |
| `order_id` | yes | The store's own identifier for the order. The same across all events for that order. |
| `store_domain` | yes | The store's primary domain, without scheme: the domain whose bounty object made the claim. |
| `total` | yes | `amount` as a **decimal string** (no floats, no minor units) and `currency` as ISO 4217. For `order.paid`, the amount the program should credit against. **Which amount that is (before or after tax, shipping, and discounts) is the program's rule, stated by the program** (§7). For `order.refunded`, the amount refunded by this event. |
| `line_items` | no | `id`, `quantity`, `amount` (decimal string). Programs that credit per product, or exclude some (for example gift cards), need them. Programs that credit the order total MAY ignore them. |
| `shopper` | yes | `id` plus `id_type`, **as the program defines them**: a member ID, a hashed email, an account token. The program states which `id_type` values it accepts (§7). The sender MUST NOT invent an identity the program didn't issue or agree to. |
| `occurred_at` | yes | When it happened at the store (paid, refunded, cancelled), as an ISO 8601 timestamp with zone. Not when it was sent. |
| `channel` | no | How the order was placed: `human`, `agentic`, or `unknown`. Senders SHOULD set `agentic` when an agent placed the order on the shopper's behalf. Absent means `unknown`. |
| `refers_to` | for refunds and cancellations | The `idempotency_key` of the `order.paid` event being reduced or reversed. |

Unknown fields MUST be ignored by the program, so a sender can carry its own context without
breaking anyone.

`channel` is the one field a program is expected to act on for attribution: it separates orders an
agent placed on the shopper's behalf from orders a human placed. It matches the `channel: agentic`
convention platforms already use in their order metadata.

The machine-readable schema is [`schema/settlement-event.schema.json`](schema/settlement-event.schema.json).

## 3. The response

The program answers **synchronously, and only about receipt**. Crediting happens afterwards, on
the program's own time.

| Status | When | Body |
|---|---|---|
| `202 Accepted` | A new, well-formed event | `{ "settlement_id", "state": "received", "idempotency_key" }` |
| `200 OK` | An idempotency key it has already seen | The **same body** it returned the first time, with the current `state`. Never a second credit. |
| `400` | The event is malformed | `{ "error": "invalid_event", "details": [...] }` |
| `401` / `403` | The signature or sender isn't recognised (§6) | `{ "error": "unauthorized" }` |
| `409` | The idempotency key was reused for a **different** event | `{ "error": "idempotency_conflict" }` |
| `422` | Well-formed, but the program won't settle it: unknown store, unknown shopper, unsupported currency | `{ "error": "not_settled", "reason": "..." }` |

A `422` is an answer, not an outage: the sender MUST NOT retry it unchanged. Network errors and
`5xx` SHOULD be retried with the same idempotency key and backoff.

## 4. States

```
received ──▶ pending ──▶ confirmed
                │             │
                └──▶ reversed ◀┘
```

| State | Means | May the shopper be told they have it? |
|---|---|---|
| `received` | The program has the event and hasn't evaluated it yet. | No. Say "processing". |
| `pending` | The program has decided the credit, and it's inside the hold (§5). | As **pending**, with when it confirms. Not as spendable. |
| `confirmed` | The hold has passed. The credit is the shopper's. | Yes. |
| `reversed` | A refund, return, or cancellation removed the credit, in full. | No. If it was shown as pending, say it was reversed. |

Rules:

- **States move only forward along the arrows.** `confirmed` is not reached early, and nothing comes
  back from `reversed`. A new purchase is a new order.
- **A partial refund reduces the credit and leaves the state where it is.** Only a full refund or a
  cancellation moves the credit to `reversed`.
- **After `confirmed`, reversal is the program's policy.** A program MUST say whether a refund after
  confirmation claws the credit back (§7). Without that statement, senders and shoppers should
  assume it does not.
- **A credit of zero is still a state.** An order that earns nothing (excluded items, below a
  minimum) goes to `pending` or `confirmed` with a zero credit, not to an error. "This order earned
  nothing" is an answer the shopper can be given.

A program MAY expose `GET {settlement endpoint}/{settlement_id}` returning
`{ settlement_id, state, idempotency_key, order_id, updated_at }`. It SHOULD NOT include the credit
amount unless the caller is the shopper or the store, and it MUST NOT include how the reward is
funded.

## 5. The refund and return hold

Every credit spends a hold in `pending` before it's `confirmed`, so a refund can still remove it
cleanly.

- **The program sets the hold**, and states it (§7). It SHOULD be at least as long as the longest
  return window of the stores it settles. A hold shorter than a store's return window means
  confirmed credits for orders that may still come back.
- **The hold runs from `occurred_at` of the `order.paid` event**, not from when the program received
  it. A late-arriving event doesn't get a shorter hold.
- **During the hold**, `order.refunded` reduces the credit and `order.cancelled` reverses it. A
  refund for the full `total` reverses it.
- **At the end of the hold**, the remaining credit moves to `confirmed`.
- **A program MAY confirm early** when it knows no return is possible (a digital good, a final sale),
  and MUST say so in its stated policy rather than case by case.

## 6. Authentication

- Events travel over **HTTPS** only.
- Each event carries a signature: `Bounty-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>`, where
  the HMAC is computed over `<t>.<raw request body>` with a secret the program and sender agreed
  when the store joined.
- The program MUST reject a bad signature, and SHOULD reject a `t` more than 5 minutes from its
  own clock.
- A sender that already authenticates another way (a platform's own signed webhook, relayed by the
  program's own adapter) MAY use that instead, as long as the program can attribute every event to
  one store.

Secrets, endpoints, and accepted identifier types are exchanged **when a store joins a program**.
They are never published in the bounty object.

## 7. What a program states

So that a store and its shoppers know what settling means, a program publishes (on its terms page,
or at its `api` URL) at least:

1. **The settlement endpoint**, and how a store joins.
2. **The accepted `shopper.id_type` values.**
3. **The credited amount:** which part of `total` earns (before or after tax, shipping, discounts),
   and which line items are excluded.
4. **The hold**, in days, and any early-confirmation cases.
5. **Reversal after confirmation:** yes or no.

None of these is a rate. **How much a credit is worth, and how the program funds it, stay out of
this contract.** The bounty object's `earn.display` is where a program tells shoppers what they get.

## 8. Versioning

`settlement_version` is independent of `bounty_schema_version`. A program MUST accept every
`0.x` event version it has announced, and SHOULD accept unknown minor versions by ignoring unknown
fields. Changes that alter a field's meaning need a new major version.

---

## Reference implementation

The **NCTR Alliance** settles bounties for stores in its merchant program today through **Beacon**,
its merchant app, which receives **Shopify's `orders/paid` webhook** and treats it as the equivalent
of an `order.paid` event. **Stripe** checkouts are the next adapter. Alliance-specific values
(identifier types, hold, credited amount) are stated in the Alliance's own program terms, not here.
