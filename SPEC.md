# Open Bounty Schema — v0.3 (Draft)

**A bounty is value paid to the shopper at the purchase.** Discounts lower the price. Reviews describe the product. A bounty pays the buyer — in points, tokens, credit, or cash — and until now there has been no standard way for a store to say so in a form software can read.

This schema defines that form. It is deliberately small, program-agnostic, and free: any rewards program, on any platform, can describe its bounty with it, and any agent can parse an answer to one question — **"does buying here pay the shopper?"**

License: CC0-1.0. No owner, no gatekeeper. Reference implementation and index: the NCTR Alliance Registry (api.nctr.live).

The machine-readable schema is served at **`https://api.nctr.live/schema/bounty/v1.json`**
(stable alias, tracks the latest 0.x) and **`https://api.nctr.live/schema/bounty/v0.2.json`**
(pinned). Implementations should pin an exact version; agents may follow the alias.
The Token Profile schema added in v0.3 is served at
**`https://api.nctr.live/schema/token/v0.3.json`**.

**v0.3** — adds **§6 Token Profiles** and one optional field, `tokens`, to the bounty object.
v0.1 and v0.2 objects remain valid and need no reissuing; agents must accept all three.

**v0.2** — discovery order and link-element fallback added to §4; v0.1 objects remain valid;
agents must accept both. The object itself is unchanged, so nothing published under v0.1 needs
reissuing and the JSON Schema is unmodified. What changed is where an agent must look.

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

Some platforms do not let a store serve arbitrary root paths. Shopify is the significant case: app proxies are limited to the prefixes `a`, `apps`, `community` and `tools`, so `/.well-known/` cannot be served by an app at all.

Where the root path is unavailable, publish the object at **any URL you control** and declare it in the site's `<head>`:

```html
<link rel="bounty" type="application/json" href="/apps/bounty/bounty.json">
```

`rel="bounty"` is the discovery mechanism, not the path. The path may be anything — an app proxy route, an ordinary page, a URL on another host. Agents find the object by following the link, exactly as they follow `rel="canonical"` or an RSS `rel="alternate"`. Every platform that blocks root paths still allows head markup, which is why this works where a fixed alternate path would not.

**`/.well-known/bounty.json` remains canonical.** Publish there when you can. The link element is for when the platform forbids it — not a matter of preference, and not a second-class location: an object found either way is the same object and carries the same weight.

On Shopify specifically, `/apps/bounty/bounty.json` is the conventional path, and the same theme app embed that renders the JSON-LD in carrier (c) emits the link element.

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

An agent conforms if it resolves the object in this order, stopping at the first hit:

1. `GET /.well-known/bounty.json` on the store's domain.
2. If that 404s, look for `<link rel="bounty">` in the `<head>` of the store's home page and fetch its `href`.
3. If neither resolves, treat the store as **unknown** — never as "no". A store that has not published is not a store that does not pay.

Having resolved the object, an agent conforms if it shows `earn.display` without embellishment, and follows `api` for live detail when present.

An agent that checks only step 1 is not conforming. On platforms that forbid root paths this would report "unknown" for every store that has correctly published, which is precisely the failure mode this section exists to prevent.

## 5. Governance

v0.x iterates in the open at the public repository. Field additions require a real program that needs them. The schema stays small on purpose: the category wins by being trivial to adopt and trivial to parse.

---

## 6. Token Profiles (v0.3)

A bounty paid in a token raises a question the bounty object alone cannot answer: **what does holding it get me?**

For a cash bounty the answer is nothing — cash is spent and gone. For a token it is the whole point, and it changes over time as the program behind the token grows. So v0.3 adds a second object type: the **Token Profile**, describing one token and everything holding it unlocks.

This is additive. A program with no tokens ignores §6 entirely, and every v0.1 and v0.2 object stays valid.

### 6.1 The store object gains one optional field

```json
{
  "bounty_schema_version": "0.3",
  "active": true,
  "program": { "name": "NCTR Alliance", "url": "https://themall.nctr.live" },
  "earn": { "display": "Members earn NCTR on every purchase — earning grows with status.",
            "denomination": "NCTR", "type": "token" },
  "tokens": [
    "https://api.nctr.live/v1/tokens/nctr",
    "https://api.nctr.live/v1/tokens/stardust"
  ],
  "api": "https://api.nctr.live/v1/bounties",
  "updated_at": "2026-09-07"
}
```

`tokens` is an array of **canonical Token Profile URLs**. That is the entire change to the bounty object.

**A store never embeds an unlock catalog.** This is *liveness over copies* applied where it bites hardest. An unlock catalog changes whenever a partner signs or a reward lands; a store's published object changes when the merchant redeploys, which may be never. Embedding a catalog guarantees that the most stale copy of the most volatile data is the first thing an agent reads — and the failure is silent, because the agent cannot tell a year-old list from a current one. A URL cannot go stale, only unreachable, and unreachable is a state an agent can detect and report.

It also survives the carriers. The Shopify metafield carrier (§2b) is flat key/value with no array type; a catalog could not live there, but one URL can, as `bounty.tokens_url`.

### 6.2 The Token Profile

```json
{
  "token_schema_version": "0.3",
  "symbol": "STARDUST",
  "canonical_url": "https://api.nctr.live/v1/tokens/stardust",
  "listed": true,
  "lifecycle": "design",
  "issuer": { "name": "NCTR Alliance", "url": "https://themall.nctr.live" },
  "engine": { "slug": "stardust", "name": "STARDUST", "category": "entertainment" },
  "earn": {
    "display": "Every purchase sponsors fans into seats — and holders stand first in line for the rooms, the nights, the drops.",
    "type": "token"
  },
  "status_ladder": {
    "basis": "held",
    "note": "Status in this engine's world. It is not an earning multiplier.",
    "rungs": [
      { "rung": "Gold", "label": "STARDUST Gold", "threshold": 15000, "unlocks": ["u_sd_03"] }
    ]
  },
  "unlocks": [
    { "id": "u_sd_03", "rung": "Gold", "name": "Presence at shows",
      "description": "Seats in the room at partner venues, opening first to holders at this rung.",
      "state": "planned", "opens_at": null, "sponsor": null }
  ],
  "unlocks_summary": { "planned": 1, "committed": 0, "funded": 0 },
  "unlocks_url": "https://api.nctr.live/v1/tokens/stardust/unlocks",
  "updated_at": "2026-09-07"
}
```

Required: `token_schema_version`, `symbol`, `canonical_url`, `issuer`, `updated_at`. Everything else is optional, because a token that has been defined but not yet described is a real and honest state.

### 6.3 The three unlock states

Every unlock carries a `state`, and it is the load-bearing field of the whole object:

| State | Means | May an agent present it as available? |
|---|---|---|
| `planned` | In design | **No. Never.** |
| `committed` | A written commitment from the partner is on file | **No.** Say "committed", with a date where known |
| `funded` | Money is behind it | **Yes** |

`state` is a **closed enum** — the only closed vocabulary in §6. Symbols, rungs and lifecycles are all open, because programs differ. The three states are not: they are the guarantee an agent relies on when deciding whether it may tell a shopper a thing exists, and a program inventing a fourth would silently break that.

`unlocks_summary` carries counts by state so an agent can tell at a glance whether anything is actually available without walking the array.

**A `planned` unlock must never name a sponsor.** Naming a partner on something merely intended asserts a relationship that does not exist — the sharpest available violation of *claims must survive scrutiny*.

### 6.4 The roster must be open-ended

A program's set of tokens grows. **Adding a token must never require a schema release, a code change or a deploy.** Concretely:

- `symbol` is validated by **pattern** (`^[A-Z][A-Z0-9]{1,31}$`), **never by an enum of known symbols**. A token the issuer has not created yet is already valid.
- `status_ladder.rungs` is an array of **any length**, with no enum of rung names. Ladders differ per token, and a consumer must not assume a rung count, a set of names, or a set of thresholds.
- `lifecycle` is an open vocabulary. `design`, `launching`, `live` and `paused` are examples, not the permitted set.

In the reference implementation `live` is set only when a token actually launches — it is the one value a member-facing surface may treat as real — and a `paused` token is unlisted, still reachable by URL, with every unlock beneath it reading as `planned`. The pause is applied when the catalog is read, never by rewriting rows: a funded unlock under a paused token is still funded, and resuming must not have silently lost that.

The reference implementation's test suite asserts this directly: a profile for an invented symbol with a non-default three-rung ladder must validate. If that test ever fails, someone has hardcoded a roster.

### 6.5 Endpoints (reference implementation)

```
GET /v1/tokens                     the roster of listed tokens
GET /v1/tokens/{symbol}            one profile — including unlisted tokens
GET /v1/tokens/{symbol}/unlocks    the unlocks feed; ?state= and ?rung= filter it
```

`listed: false` means a token is reachable by direct URL but absent from the roster. It is how an issuer keeps a defined-but-undescribed token honest rather than hidden: the row exists, and nothing claims more about it than is true.

An unknown symbol is a **404**, never a generic profile. Inventing a plausible answer for a token nobody issued is worse than saying no.
