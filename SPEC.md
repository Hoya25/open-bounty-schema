# Open Bounty Schema — v0.1 (Draft)

**A bounty is value paid to the shopper at the purchase.** Discounts lower the price. Reviews describe the product. A bounty pays the buyer — in points, tokens, credit, or cash — and until now there has been no standard way for a store to say so in a form software can read.

This schema defines that form. It is deliberately small, program-agnostic, and free: any rewards program, on any platform, can describe its bounty with it, and any agent can parse an answer to one question — **"does buying here pay the shopper?"**

License: CC0-1.0. No owner, no gatekeeper. Reference implementation and index: the NCTR Alliance Registry (api.nctr.live).

---

## 1. The object

One JSON object describes a store's (or product's) bounty:

```json
{
  "bounty_schema_version": "0.1",
  "active": true,
  "program": {
    "name": "NCTR Alliance",
    "url": "https://themall.nctr.live"
  },
  "earn": {
    "display": "Members earn NCTR on every purchase — earning grows with status.",
    "denomination": "NCTR",
    "type": "token"
  },
  "status": {
    "url": "https://themall.nctr.live/status",
    "note": "Standing unlocks sponsored rewards; earning rates rise with status."
  },
  "api": "https://api.nctr.live/v1/bounties/example-brand",
  "terms_url": "https://example-brand.com/bounty-terms",
  "updated_at": "2026-09-03"
}
```

Field rules:

| Field | Req | Meaning |
|---|---|---|
| `bounty_schema_version` | yes | Spec version, string |
| `active` | yes | Whether a bounty is currently offered |
| `program.name` / `program.url` | yes | The rewards program behind the bounty |
| `earn.display` | yes | ONE human sentence describing what the buyer earns. Agents show this verbatim; keep it plain and truthful |
| `earn.denomination` | no | What the earn is paid in ("NCTR", "points", "USD") |
| `earn.type` | no | `points` \| `token` \| `cash` \| `other` |
| `status.url` / `status.note` | no | For status-based programs: where standing lives and what it does |
| `api` | no | Live endpoint with authoritative, current bounty detail |
| `terms_url` | no | Program terms |
| `updated_at` | yes | ISO date of last change |

Design principles: **display over math** (a truthful sentence beats a rate field that invites false precision), **liveness over copies** (the `api` field is authoritative; embedded copies are hints), and **claims must survive scrutiny** (publish only what the program actually delivers today).

## 2. The four carriers

The same object travels four ways, so every kind of agent finds it:

**a. `/.well-known/bounty.json`** — the robots.txt of rewards. Host the object at this path on the store's domain. One fetch answers the question for any agent, on any platform.

**b. Shopify metafields** — namespace `bounty`, one metafield per field:

| Metafield (namespace.key) | Type | Value |
|---|---|---|
| `bounty.schema_version` | single_line_text_field | "0.1" |
| `bounty.active` | boolean | true |
| `bounty.program_name` | single_line_text_field | program.name |
| `bounty.program_url` | url | program.url |
| `bounty.earn_display` | single_line_text_field | earn.display |
| `bounty.denomination` | single_line_text_field | earn.denomination |
| `bounty.status_url` | url | status.url |
| `bounty.api` | url | api |
| `bounty.updated_at` | date | updated_at |

Keys drop the `bounty_` prefix that the JSON object carries — the `bounty` namespace already supplies it, so `bounty.schema_version` and `bounty_schema_version` name the same field.

Set at shop level; optionally per-product where bounties differ. These do not syndicate to agentic storefronts today — they are the standing claim on the namespace for the day the feed opens, and apps/themes can read them now.

**c. JSON-LD** — on product pages, inside the existing `Offer`:

```json
{
  "@type": "Offer",
  "additionalProperty": {
    "@type": "PropertyValue",
    "propertyID": "bounty",
    "name": "NCTR Alliance bounty",
    "value": "Members earn NCTR on every purchase — earning grows with status.",
    "url": "https://api.nctr.live/v1/bounties/example-brand"
  }
}
```

**d. Catalog sentence** — for description fields that syndicate to AI channels today: the `earn.display` sentence plus the `api` URL, verbatim, nothing more.

## 3. Verification

Anyone may publish the schema (that is the point). Indexes add trust on top:

- **declared** — the store publishes the object. Self-asserted: an agent should
  treat it as a claim, not a fact.
- **verified** — an index confirms the program itself acknowledges the store.
  The record comes from the program's own systems rather than the store's page,
  and the index may withhold stores it has reason to exclude.

An index MAY adopt a stricter bar before featuring a store. Where it does, it
SHOULD state the bar plainly and say what it checks, because "verified" is worth
exactly what the check behind it is worth.

The NCTR Alliance Registry's verified tier today means: the listing is drawn from
the Alliance's own program data, and stores on its exclusion list are withheld.
Funded-before-featured — listing a store only where a funded bounty exists — is
the bar the verified tier will adopt when the funding check ships. It is a
roadmap commitment, not a description of today.

Agents SHOULD prefer verified sources and treat `api` as authoritative over any
embedded copy.

## 4. Conformance for agents

An agent conforms if it: fetches `/.well-known/bounty.json` when evaluating a merchant; treats a missing file as "unknown", not "no"; shows `earn.display` without embellishment; and follows `api` for live detail when present.

## 5. Governance

v0.x iterates in the open at the public repository. Field additions require a real program that needs them. The schema stays small on purpose: the category wins by being trivial to adopt and trivial to parse.
