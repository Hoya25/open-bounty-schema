# Open Bounty Schema — v0.6 (Draft)

**A bounty is value paid to the shopper at the purchase.** Discounts lower the price. Reviews describe the product. A bounty pays the buyer — in points, tokens, credit, or cash — and until now there has been no standard way for a store to say so in a form software can read.

This schema defines that form. It is deliberately small, program-agnostic, and free: any rewards program, on any platform, can describe its bounty with it, and any agent can parse an answer to one question — **"does buying here pay the shopper?"**

License: CC0-1.0. No owner, no gatekeeper. Reference implementation and index: the NCTR Alliance Registry (api.nctr.live).

The machine-readable schema is served at **`https://api.nctr.live/schema/bounty/v1.json`**
(stable alias, tracks the latest 0.x) and **`https://api.nctr.live/schema/bounty/v0.2.json`**
(pinned). Implementations should pin an exact version; agents may follow the alias.
The Token Profile schema added in v0.3 is served at
**`https://api.nctr.live/schema/token/v0.3.json`**.

**v0.6** — completeness, trust and goal matching. All new fields are optional; every v0.1–v0.5
object stays valid.
- **Completeness:** `eligibility`, `conditions`, `valid_from`/`valid_until` (an object outside its
  window is inactive), `currency`, `stacking`, and `earn.display` MAY be an object keyed by locale
  with a required `default` (§1.2).
- **Trust:** a visible-carrier rule for the on-page statement (§2e), `verification` on objects an
  index or program publishes (§3.2), and signed objects (§9).
- **Goal matching:** perks and Token Profile unlocks MAY carry `fulfills` goal tags (§8).

**v0.5** — adds one optional block to the bounty object: `rewards` (§7), which says what the
reward is worth (`value`), how members climb (`ladder`), and what membership unlocks (`perks`, with
the same three states as a Token Profile unlock). It lets an agent compare a points program with a
token program on equal footing. v0.1–v0.4 objects remain valid and need no reissuing; an object
without `rewards` states nothing about them, which is not the same as "none".

**v0.4** — adds two optional fields to the bounty object: `scope` (§1.1), which says whether
every purchase qualifies or only selected products, and `listed_by` (§3), which says who
published the object. v0.1–v0.3 objects remain valid and need no reissuing; an object without
`scope` means `store`, and one without `listed_by` makes no claim about its publisher.

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
| `scope` | no | v0.4. `store` (default) \| `selected` — whether every purchase qualifies or only some products (§1.1) |
| `listed_by` | no | v0.4. `program` \| `index` \| `store` — who published this object (§3) |
| `rewards` | no | v0.5. What the reward is worth, the tier ladder, and the perks, each perk with a state (§7) |
| `currency` | no | v0.6. ISO 4217 code the earn and any amounts are stated in |
| `eligibility` | no | v0.6. `{ who, join_url?, note? }`. Who the bounty is for (§1.2) |
| `conditions` | no | v0.6. `[ { type, value?, note } ]`. Conditions, each with a sentence (§1.2) |
| `valid_from` / `valid_until` | no | v0.6. ISO date or date-time. Outside the window the object is inactive |
| `stacking` | no | v0.6. `{ combinable, note? }`. Whether it combines with other offers |
| `verification` | no | v0.6. `{ method, checked_at, by }` on objects an index or program publishes (§3.2) |
| `updated_at` | yes | ISO date of last change |

### 1.1 Scope and the product-level rule (v0.4)

Many bounties do not cover the whole store: a gift ships with selected items, a campaign pays
on pre-orders only, a brand funds a bounty on one line. `scope` says which case applies:

- **`store`** (the default) — every purchase at the store qualifies. An object without `scope`
  means this, so every v0.1–v0.3 object keeps its meaning.
- **`selected`** — only some products qualify. The store-level object says that a bounty
  exists and what it is; it does **not** say which products carry it.

The products themselves carry that. A product that qualifies declares it **on its own page**,
through the product-level carriers:

1. **JSON-LD** — the `bounty` `PropertyValue` inside that product's `Offer` (§2c). One per
   qualifying product, never on a product that does not qualify.
2. **Per-product metafields** — the `bounty` namespace (§2b) set on the **product**, not the
   shop. Product-level values override shop-level ones for that product.

**The rule for agents:** when `scope` is `selected`, an agent MUST check the product page for
a product-level declaration **before** telling a shopper that buying that product earns. A
store-level object with `scope: "selected"` is never, by itself, a claim about any one
product. A product with no product-level declaration is **not covered**, which is different
from the store being unknown: the store has said what it offers, and this product is not part
of it.

A store with `scope: "store"` may still publish product-level declarations (for example, to
show a product-specific sentence); they refine the display and never narrow the store-wide
claim.

Design principles: **display over math** (a truthful sentence beats a rate field that invites false precision), **liveness over copies** (the `api` field is authoritative; embedded copies are hints), and **claims must survive scrutiny** (publish only what the program actually delivers today).

### 1.2 Completeness fields (v0.6)

`earn.display` stays the one sentence an agent shows. The v0.6 fields say, in structure, what
that sentence would otherwise have to carry in prose: who it's for, what conditions apply, and
when it holds.

- **`eligibility`**: `who` is an open vocabulary. The starter terms are `anyone`, `members`,
  `new_customers`, `new_subscribers` and `group`. `join_url` is where a shopper becomes
  eligible, and `note` is one sentence, shown as written.
  - An agent that doesn't recognise a `who` term says the bounty is limited and shows `note`.
  - Absent means not stated, which is **not** the same as `anyone`.
- **`conditions`**: each has a `type` (open vocabulary), an optional machine-readable `value`
  (a minimum in `currency`, a number of days; never a rate), and a required `note`, which is
  what an agent says.
  - Starter types: `min_order`, `excluded_categories`, `subscription_only`, `first_order`,
    `once_per_customer`, `limited_time`, `pending_period`, `points_expire`.
- **`valid_from` / `valid_until`**: ISO dates or date-times. Before `valid_from` or after
  `valid_until`, an agent treats the object as **inactive**, whatever `active` says.
- **`currency`**: the ISO 4217 code that every amount in the object, including the sentence's,
  is stated in. A program that earns in more than one currency publishes one object per
  currency.
- **`stacking`**: `combinable` says whether the bounty combines with other discounts or offers,
  and `note` says it in words.
- **Localized `earn.display`**: instead of a string, an object keyed by lower-case BCP 47
  locale, with a required `default`:
  `{ "default": "Members earn 5 points per €1…", "fr": "Les membres gagnent…" }`.
  - An agent shows the entry for the shopper's locale, falling back to `default`, verbatim.
  - Every entry must say the same thing.
  - Agents pinned to v0.5 or earlier expect a string. A store serving them should keep the
    string form, or publish the default as the string.

## 2. The carriers

The same object travels several ways, so every kind of agent finds it:

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
| `bounty.scope` | single_line_text_field | scope (v0.4): `store` or `selected` |
| `bounty.api` | url | api |
| `bounty.currency` | single_line_text_field | currency (v0.6) |
| `bounty.eligibility` | json | eligibility (v0.6) |
| `bounty.conditions` | json | conditions (v0.6) |
| `bounty.valid_from` / `bounty.valid_until` | date_time | valid_from / valid_until (v0.6) |
| `bounty.stacking` | json | stacking (v0.6) |
| `bounty.rewards` | json | rewards (v0.5): the whole block, as JSON |
| `bounty.updated_at` | date | updated_at |

Keys drop the `bounty_` prefix that the JSON object carries — the `bounty` namespace already supplies it, so `bounty.schema_version` and `bounty_schema_version` name the same field.

Set at shop level; per-product where bounties differ, and on **every qualifying product**
when `scope` is `selected` (§1.1). `listed_by` has no metafield: an object assembled from a
store's own metafields is store-published by construction. These do not syndicate to agentic storefronts today — they are the standing claim on the namespace for the day the feed opens, and apps/themes can read them now.

**c. JSON-LD** — on product pages, inside the existing `Offer`, one per product that
qualifies (with `scope: "selected"` this is how an agent learns which products do, §1.1):

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

**e. Visible statement (v0.6 rule)**: the on-page statement, for agents that drive a browser
and read the accessibility tree rather than the HTML. Head markup and JSON-LD have no text node,
so these agents can't see them. When a store renders the statement, it MUST:
- render `earn.display` **verbatim**, or the entry for the page's locale, else `default`;
- put it inside an element carrying `data-bounty-display` and an `aria-label`, such as
  `<section data-bounty-display aria-label="Rewards on this purchase">`, so it is a labeled
  region a browser-driving agent can find by name;
- place it **within the product's purchase region**, near the price and the add-to-cart
  control, on product pages.

It renders nothing when no object is published, the object is inactive, or it is outside its
validity window. Integrations SHOULD render it by default and let the merchant turn it off.

## 3. Verification

Anyone may publish the schema (that is the point). Indexes add trust on top:

- **declared** — the store publishes the object. Self-asserted: an agent should
  treat it as a claim, not a fact.
- **verified** — an index confirms the program itself acknowledges the store.
  The record comes from the program's own systems rather than the store's page,
  and the index may withhold stores it has reason to exclude.

**Settling** is defined separately, in [SETTLEMENT.md](SETTLEMENT.md): the order event a program
accepts, its response, the credit states (received → pending → confirmed → reversed), and the refund
hold. A verified listing means the program acknowledges the store; settlement is how that program
actually credits the shopper on an order.

### 3.1 `listed_by` (v0.4)

An object can be published by different parties, and an agent weighing it should know which.
`listed_by` says so:

| Value | Who published the object |
|---|---|
| `program` | The program that settles the bounty — the party whose systems actually pay the shopper. |
| `index` | An index, on the store's behalf. The store has no surface of its own carrying the object; the index asserts the bounty from its own records. |
| `store` | The store itself. |

`listed_by` is **optional**, and **absent means no claim** — not `store`. Objects from v0.1–v0.3
carry no `listed_by` and stay valid.

It is defined for **index-served objects**, where the question genuinely arises. A
store-hosted object (at the store's `/.well-known/bounty.json`, behind its `rel="bounty"`
link, or in its metafields) SHOULD omit it or say `store`; any other value there is a
contradiction, and an agent SHOULD treat such an object as declared.

`listed_by` describes provenance, not trust. It does not replace the verified tier above: a
`program` listing is drawn from the paying party's records and an `index` listing from the
index's, and an agent weighs each by what the publisher checks.

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

### 3.2 `verification` (v0.6)

An object an index or program publishes on a store's behalf MAY say how the publisher knows the
store pays:

| `method` | Means |
|---|---|
| `program_data` | The program's own settlement data shows the store paying shoppers |
| `order_sample` | Test orders were placed and the bounty was paid out |
| `attestation` | The store attested in writing |
| `none` | Listed, not verified |

- `method` is a closed enum, because an agent weighs the claim on it.
- Every method except `none` requires `checked_at` (a date-time) and `by` (a name or URL).
- Absent makes no claim.
- `verification` describes the publisher's check. It is not a signature (§9) and doesn't
  make a claim true.

## 4. Conformance for agents

An agent conforms if it resolves the object in this order, stopping at the first hit:

1. `GET /.well-known/bounty.json` on the store's domain.
2. If that 404s, look for `<link rel="bounty">` in the `<head>` of the store's home page and fetch its `href`.
3. If neither resolves, treat the store as **unknown** — never as "no". A store that has not published is not a store that does not pay.

Having resolved the object, an agent conforms if it shows `earn.display` without embellishment, and follows `api` for live detail when present.

If the object carries `rewards` (§7), an agent conforms only if it shows `rewards.value` verbatim
and computes nothing from it, and presents as available only perks whose `state` is `funded`.
Where `rewards` is absent and `tokens` is present, it derives the same fields from the Token
Profile (§7.4) rather than reporting that the program has no tiers or perks.

v0.6 adds four more conformance rules:
- **Validity:** an object before its `valid_from` or after its `valid_until` is **inactive**.
- **Localized `earn.display`:** an agent shows the shopper's locale, else `default`, verbatim.
- **Eligibility and conditions:** an agent shows `eligibility` and `conditions` notes when it
  states the bounty, and never presents a limited bounty as open to anyone.
- **Signatures:** an agent that checks signatures (§9) treats an **invalid** signature as a
  hard stop. It uses nothing from the object and reports the store as unknown.

If the object carries `scope: "selected"`, an agent conforms only if it checks the product page
for a product-level declaration (§1.1) before telling a shopper that a particular product
earns. An absent `scope` is read as `store`.

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

---

## 7. Rewards (v0.5)

`earn.display` answers **"does buying here pay me?"** It doesn't answer the questions a shopper
asks next: what is it worth, what do I get for staying, and what's actually available today.
Without a shared shape for those answers, an agent can't put a points program beside a token
program and compare them. It can only quote two sentences.

v0.5 adds one optional block, `rewards`. It's additive: an object without it is unchanged and
still valid, and **absent means not stated, never "none"**.

```json
"rewards": {
  "value": "100 Points = $5 off at checkout.",
  "ladder": {
    "basis": "spend",
    "unit": "USD",
    "rungs": [
      { "rung": "Starter", "threshold": 0, "note": "Where every member starts." },
      { "rung": "Pro", "threshold": 250, "note": "Earns more per dollar than Starter." }
    ]
  },
  "perks": [
    { "name": "Free standard shipping", "description": "On orders of $75 or more.", "state": "funded" },
    { "name": "Partner benefits", "state": "planned", "sponsor": null }
  ],
  "redeem_url": "https://athletics.example.com/pages/loyalty#redeem"
}
```

| Field | Meaning |
|---|---|
| `value` | ONE plain sentence, at most 200 characters, stating what the reward unit is worth |
| `ladder.basis` | `earned` \| `held` \| `spend`: what a member climbs by |
| `ladder.unit` | What `threshold` counts, in the program's own unit: an ISO 4217 code for `spend`, otherwise the unit's name |
| `ladder.note` | What the ladder measures and over what period, in words |
| `ladder.rungs[]` | `{ rung, label?, threshold, note? }`, in order. The first rung is the entry tier when its threshold is 0; when it's above 0, members below it hold no rung yet |
| `perks[]` | `{ name, description?, state, sponsor? }`, where `state` is `planned` \| `committed` \| `funded` |
| `redeem_url` | Where a member spends the reward |
| `terms_url` | The reward's own terms, when they differ from the object's `terms_url` |

Every member of the block is optional.

### 7.1 `value`: display over math

`value` is a sentence, not a number: "100 Points = $5 off at checkout."
- There is **no rate field, on purpose**. A rate invites arithmetic, and arithmetic across programs
  is where comparisons go wrong: a points ratio that only applies above a minimum, a coupon that
  excludes gift cards, a token whose worth isn't a currency amount at all.
- The sentence carries what the program can truthfully say, and an agent quotes it. An agent
  **must not** compute a rate, a percentage or a dollar value from it, or from `value` together
  with `earn.display`.
- A program that can't state its unit's worth truthfully, in a sentence it would stand behind,
  omits `value`.

### 7.2 `ladder`

`ladder` has the same shape as the Token Profile's `status_ladder` (§6.2), with one addition:
`unit`, because a store ladder is often measured in money, and "250" isn't a threshold until it
says which currency.
- `rungs` may be **any length**, with **no enum of names**. A consumer must not assume a rung
  count, a set of names, or a set of thresholds (§6.4).
- `basis` is a closed enum of three, because an agent must say what a member climbs by.
- `threshold` is a number in `unit`. Without a `unit`, an agent must not state a threshold as an
  amount of money.
- A rung `note` says what a rung does in words. It doesn't carry a per-rung rate, for the same
  reason as §7.1.

### 7.3 `perks` and their states

A perk carries the same closed `state` as a Token Profile unlock (§6.3), and the same rule
governs it:

| State | May an agent present it as available? |
|---|---|
| `planned` | **No. Never.** |
| `committed` | **No.** Say "committed" |
| `funded` | **Yes** |

- **A `planned` perk never names a sponsor.** The schema enforces it: a planned perk's
  `sponsor` must be null or absent.
- A program states a perk as `funded` only where it is live for members now.
- An integration that reads a program from outside, rather than the program publishing itself,
  **omits a perk whose state it can't establish**. It never guesses one.
- Since v0.6 a perk MAY carry `fulfills`: goal tags (§8).

### 7.4 Token programs: derive, don't copy

§6.1 says a store never embeds an unlock catalog, and that stays true. For a token program,
`rewards` **MAY be omitted** whenever `tokens` is present. An agent **SHOULD** derive the same
fields from the Token Profile:

| `rewards` | From the Token Profile |
|---|---|
| `ladder.basis` | `status_ladder.basis` |
| `ladder.unit` | the token's `symbol` |
| `ladder.note` | `status_ladder.note` |
| `ladder.rungs[]` | `status_ladder.rungs[]`: `rung`, `label`, `threshold` (a rung's `unlocks` ids are not copied) |
| `perks[]` | `unlocks[]`: `name`, `description`, `state`, `fulfills` (v0.6), and `sponsor` under the same rule |
| `value` | No field maps to it. Use it only if the issuer publishes a sentence that meets §7.1 |
| `earn.display` | stays in `earn`: the store object's own sentence |

A **program-hosted** object (`listed_by: "program"` or `"index"`, served live from the program's
API) may include `rewards` derived this way at request time, because it can't go stale. A
**store-hosted** object for a token program should leave it out and let agents follow `tokens`.

### 7.5 Store-hosted points programs

When the store is the program, as with a points program run on the store's own loyalty app,
`rewards` is the program describing itself. It goes stale the same way `earn.display` does, when
the program changes and the object isn't re-published. Integrations that compose it from the
program's live data should re-read it whenever they re-publish `earn.display`.

---

## 8. Goal matching (v0.6)

A shopper often has something specific in mind: concert tickets, a gym membership, help with
trade school. A program's perks and a token's unlocks MAY carry **`fulfills`**: goal tags that
say what each one serves.

```json
{ "name": "Gear library", "state": "funded", "fulfills": ["outdoor_gear"] }
```

- **Where:** on Token Profile unlocks (`unlocks[].fulfills`, Token Profile schema v1 alias), and
  on `rewards.perks[]` for programs without tokens.
- **Shape:** lower-case snake_case tags, any number per item, no duplicates.
- **Vocabulary:** open. A program may use a tag no list has. The starter list, which programs
  should reuse where it fits:

| | | |
|---|---|---|
| `concert_tickets` | `live_events` | `gym_membership` |
| `trade_school_tuition` | `college_tuition` | `classes` |
| `travel` | `recovery_support` | `outdoor_gear` |
| `youth_sports` | `childcare` | `groceries` |
| `healthcare` | `transit` | `free_shipping` |

**The rule for agents:**
1. Match the shopper's goals to tags **locally**. A shopper's goals are never sent to a program
   or index in order to match them.
2. Present as available **only** items whose `state` is `funded`. A `committed` or `planned`
   item that matches may be mentioned only as not yet available.
3. A `planned` item never names a sponsor, as everywhere else in this spec.

Tags are the program's claim about what an item serves. An agent shows the item's own name and
description, not a sentence built from the tag.

## 9. Signed objects (v0.6)

A publisher MAY sign its objects so an agent can tell that an object is exactly what the origin
published, unaltered by a cache, proxy or copy. Signing says who published the object. It does
not make the claim true; that's what `verification` (§3.2) and the program behind it are for.

**Keys.** The origin that serves the object publishes a JSON Web Key Set at
`https://<that origin>/.well-known/bounty-keys.json`:

```json
{ "keys": [ { "kty": "OKP", "crv": "Ed25519", "x": "…", "kid": "2026-10", "use": "sig", "alg": "EdDSA" } ] }
```

Keys come only from the origin that served the object, never from a URL named inside a signature.

**Signature.** The response carries a detached JWS (RFC 7515, Appendix F) in a header:

```
Bounty-Signature: <base64url(protected header)>..<base64url(signature)>
```

- **Protected header:** `{ "alg": "EdDSA", "kid": "…", "typ": "bounty+jws" }`.
- **Signing input:** `base64url(protected header) + "." + base64url(body)`, where `body` is the
  exact bytes of the response body, after content decoding.
- **Algorithm:** v0.6 defines EdDSA with Ed25519 only.

**Three outcomes:**

| Outcome | When | What an agent does |
|---|---|---|
| `signed` | The signature verifies against a key with that `kid` at the object's origin | Uses the object, and may say it is signed by that origin |
| `unsigned` | No `Bounty-Signature` header | Uses the object as before. Unsigned is the default, not a fault |
| `invalid` | A header is present and anything fails: malformed, another `alg`, unknown `kid`, the key set unreachable, or a signature that doesn't verify | **Hard stop.** Uses nothing from the object and reports the store as unknown, saying the signature failed |

A signature covers one response. The carriers that aren't HTTP responses (metafields, JSON-LD,
the visible statement) aren't signed. An agent that needs a signed answer follows `api` or the
well-known path.
