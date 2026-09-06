# Open Bounty Schema

**A bounty is value paid to the shopper at the purchase.**

Discounts lower the price. Reviews describe the product. A bounty pays the buyer — in points, tokens, credit, or cash — and there has been no standard way for a store to say so in a form software can read.

This is that form. One small JSON object, published at a known path, answering one question for any agent:

> **Does buying here pay the shopper?**

**[Read the spec →](SPEC.md)**

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

## Design principles

- **Display over math.** One truthful sentence beats a rate field that invites false precision. Programs differ too much for a universal rate; they do not differ on whether they can state plainly what a shopper gets.
- **Liveness over copies.** The `api` field is authoritative. An embedded copy is a hint that may be stale.
- **Claims must survive scrutiny.** Publish what the program delivers today. A schema that makes lying convenient is worse than no schema.

## Repository

| Path | What it is |
|---|---|
| [`SPEC.md`](SPEC.md) | The specification. Canonical. Currently **v0.2**. |
| [`schema/bounty.schema.json`](schema/bounty.schema.json) | JSON Schema (draft 2020-12). Normative for validation. |
| [`examples/`](examples/) | Valid objects: a token program, a cash program, the minimum required fields, and an inactive store. |
| [`validate.mjs`](validate.mjs) | Validates every example, and asserts the schema **rejects** malformed objects. `npm install && npm test` |

## Reference implementation

The **NCTR Alliance Registry** (`api.nctr.live`) is the reference implementation and index.

What exists today:

- The Alliance publishes its own program-level object at **[`https://api.nctr.live/.well-known/bounty.json`](https://api.nctr.live/.well-known/bounty.json)** — the schema describing the Alliance's own bounty, live and fetchable.
- **[`https://api.nctr.live/v1/bounties/{brand}`](https://api.nctr.live/v1/bounties)** returns a schema-shaped representation for a listed store, so the `api` field resolves to something an agent can parse.

What does not exist yet, stated plainly because the third design principle applies to us too: **the index does not list partner stores today.** Store listings arrive as brands fund bounties. The Registry's verified tier and its funding bar are described in [§3 of the spec](SPEC.md#3-verification) — including which part of it is a roadmap commitment rather than a description of today.

An index that overstated its coverage would be exactly the failure this schema exists to prevent.

## Contributing

v0.x iterates in the open. Field additions require a **real program that needs them** — not a hypothetical. The schema stays small on purpose: the category wins by being trivial to adopt and trivial to parse.

Open an issue describing the program and the field it cannot express.
