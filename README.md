# Open Bounty Schema

**A bounty is value paid to the shopper at the purchase.**

Discounts lower the price. Reviews describe the product. A bounty pays the buyer — in points, tokens, credit, or cash — and there has been no standard way for a store to say so in a form software can read.

This is that form. One small JSON object, published at a known path, answering one question for any agent:

> **Does buying here pay the shopper?**

**[Read the spec →](SPEC.md)** · **[Adopting it →](ADOPTERS.md)** (questions, which agents read which carrier, programs, how to verify)

License: **CC0-1.0**. No owner, no gatekeeper, no membership. Copy it, fork it, implement it, ignore the people who wrote it.

---

## The object

```json
{
  "bounty_schema_version": "0.1",
  "active": true,
  "program": { "name": "NCTR Alliance", "url": "https://themall.nctr.live" },
  "earn": {
    "display": "Members earn NCTR on every purchase — earning grows with status.",
    "denomination": "NCTR",
    "type": "token"
  },
  "api": "https://api.nctr.live/v1/bounties",
  "updated_at": "2026-09-06"
}
```

Host it at **`/.well-known/bounty.json`** on your store's domain. On most platforms that is the whole adoption cost.

Some platforms will not serve arbitrary root paths — Shopify is the significant case, where app proxies are restricted to four fixed prefixes and `/.well-known/` is not among them. There, publish the object at any URL you control and point to it from the page head:

```html
<link rel="bounty" type="application/json" href="/apps/bounty/bounty.json">
```

Agents resolve the well-known path first and fall back to the link element, so both routes reach the same object. A store that has published neither is **unknown**, never "no".

Three other carriers — Shopify metafields, JSON-LD inside an existing `Offer`, and a plain catalog sentence — are described in [the spec](SPEC.md), so the same object reaches agents that never fetch a file at all.

## What the reward is worth (v0.5)

The optional `rewards` block says what a program's unit is worth, how members climb, and what
membership unlocks, so an agent can put a points program beside a token program:

```json
"rewards": {
  "value": "100 Points = $5 off at checkout.",
  "ladder": { "basis": "spend", "unit": "USD",
              "rungs": [{ "rung": "Starter", "threshold": 0 }, { "rung": "Pro", "threshold": 250 }] },
  "perks": [{ "name": "Free standard shipping", "state": "funded" }]
}
```

`value` is a sentence, not a rate. Each perk carries the same three states as a Token Profile
unlock, and only `funded` is available. A token program can leave the block out and let agents
derive it from its Token Profile. See [§7](SPEC.md#7-rewards-v05).

## Completeness, trust and goals (v0.6)

- **Who and on what terms:** `eligibility`, `conditions` (each with a sentence agents show),
  `valid_from` / `valid_until`, `currency`, and `stacking`. `earn.display` may be given per
  locale.
- **Trust:** a rule for the on-page statement, so browser-driving agents find it as a labeled
  region; `verification` on index and program listings; and **signed objects** (an Ed25519
  detached JWS checked against `/.well-known/bounty-keys.json`). An invalid signature is a
  hard stop.
- **Goals:** perks and token unlocks may carry `fulfills` tags (`concert_tickets`,
  `gym_membership`, `trade_school_tuition` …). Agents match a shopper's goals locally and offer
  only funded items.

See [CHANGELOG.md](CHANGELOG.md) and [SPEC §1.2, §2e, §3.2, §8, §9](SPEC.md).

## Declaring and settling

The bounty object **declares**: buying here pays the shopper, and here's what they get. Paying
it is **settling**, and that's a separate, equally small contract:
**[SETTLEMENT.md](SETTLEMENT.md)**. A store or checkout sends one order event to the program, the
program answers about receipt only, and the shopper's credit moves from `pending` to `confirmed`
once the program's refund hold has passed. Programs keep their rates and funding to themselves;
the contract doesn't need them.

## Design principles

- **Display over math.** One truthful sentence beats a rate field that invites false precision. Programs differ too much for a universal rate; they do not differ on whether they can state plainly what a shopper gets.
- **Liveness over copies.** The `api` field is authoritative. An embedded copy is a hint that may be stale.
- **Claims must survive scrutiny.** Publish what the program delivers today. A schema that makes lying convenient is worse than no schema.

## Repository

| Path | What it is |
|---|---|
| [`SPEC.md`](SPEC.md) | The specification. Canonical. Currently **v0.6**. |
| [`CHANGELOG.md`](CHANGELOG.md) | What each version added. Every 0.x is additive. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How a field gets added: a real program that needs it, a reject case and an accept case, and the rollout order. |
| [`ADOPTERS.md`](ADOPTERS.md) | For programs, stores, app builders and agent builders: declaring vs settling, pinning, product-level scope, which agents read which carrier, the programs and loyalty integrations, and how to verify a store. |
| [`SETTLEMENT.md`](SETTLEMENT.md) | The settlement contract (**v0.1**, draft): how a program credits a shopper for an order. The order event, the response, the states (received → pending → confirmed → reversed), and the refund hold. Schema: [`schema/settlement-event.schema.json`](schema/settlement-event.schema.json). |
| [`schema/bounty.schema.json`](schema/bounty.schema.json) | JSON Schema (draft 2020-12). Normative for validation. Also served at **`https://api.nctr.live/schema/bounty/v1.json`** (stable alias) and **`/v0.2.json`** (pinned) — implementers should fetch those rather than a raw GitHub URL. |
| [`examples/`](examples/) | Valid objects: a token program, three cash programs (one stating only what its reward is worth), a gift with purchase, a pre-launch campaign tier, a tiered points program with a full `rewards` block, an alliance store that leaves `rewards` to its Token Profile, v0.6 objects (a welcome offer with eligibility, conditions, dates and stacking; a localized points program in euros with goal tags; a verified index entry), a Token Profile with goal tags, the minimum required fields, and an inactive store. |
| [`validate.mjs`](validate.mjs) | Validates every example, and asserts the schema **rejects** malformed objects. `npm install && npm test` |

## Reference implementation

The **NCTR Alliance Registry** (`api.nctr.live`) is the reference implementation and index.

What exists today:

- The Alliance publishes its own program-level object at **[`https://api.nctr.live/.well-known/bounty.json`](https://api.nctr.live/.well-known/bounty.json)** — the schema describing the Alliance's own bounty, live and fetchable.
- **[`https://api.nctr.live/v1/bounties/{brand}`](https://api.nctr.live/v1/bounties)** returns a schema-shaped representation for a listed store, so the `api` field resolves to something an agent can parse.

What the index lists today, stated plainly because the third design principle applies to us too: **6,000-plus stores**, almost all of them **declared by the index** rather than by the store. Every object says which, in `listed_by` ([§3.1](SPEC.md#31-listed_by-v04)):

- `program` means the program that settles the bounty publishes the object. Today that's one store, NCTR Merch, settled directly through the alliance's merchant system.
- `index` means the index publishes the object from its own records, on the store's behalf. The store's own site carries nothing yet, and an agent should weigh the object as the index's claim, not the store's.
- `store` means the store publishes the object itself.

The Registry's verified tier and its funding bar are described in [§3 of the spec](SPEC.md#3-verification), including which part of it is a roadmap commitment rather than a description of today.

An index that overstated its coverage would be exactly the failure this schema exists to prevent.

## Contributing

v0.x iterates in the open. Field additions require a **real program that needs them** — not a hypothetical. The schema stays small on purpose: the category wins by being trivial to adopt and trivial to parse.

Open an issue describing the program and the field it cannot express.
