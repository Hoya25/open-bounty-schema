# Adopting the Open Bounty Schema

For rewards programs, stores, platform and app builders, and anyone building a shopping agent.
The [spec](SPEC.md) is the contract; this page answers the questions people ask before they
implement it.

---

## Questions

### What's the difference between declaring and settling?

**Declaring** is saying it: one JSON object, published where agents look, stating that buying here
pays the shopper and what they get. That's the [spec](SPEC.md). It costs a store one file or one
head tag.

**Settling** is paying it: the store's checkout tells the program about the order, and the program
credits the shopper after a refund hold. That's [SETTLEMENT.md](SETTLEMENT.md). It needs a program
that actually pays.

The two are deliberately separate. A store can declare a program's bounty only because the program
settles it. An agent reads the declaration; it never sees settlement. A program can implement
settlement without changing anything about how bounties are declared.

### What's a program object, and do stores need their own?

A **program object** is a program describing its own bounty, independent of any store: for
example, a rewards network publishing what every member earns, at its own
`/.well-known/bounty.json`. It's true on day one, however many stores the program has.

A **store object** is the same shape, published on the store's own domain. It can repeat the
program's object word for word, or describe a store-specific bounty. Stores that use a program's
object unchanged should still publish it on their own domain (or point to it with
`<link rel="bounty">`), because agents look at the store, not at the program.

Who published an object is stated by `listed_by` ([§3.1](SPEC.md#31-listed_by-v04)): the program
that settles it, an index acting on the store's behalf, or the store itself.

### How stable is the spec? What should I pin?

- **0.x iterates in the open, additively.** Every 0.x object stays valid: a v0.1 object needs
  nothing to validate under v0.5. New fields are optional and need a real program that needs them.
- **Two schema addresses:**
  - `https://api.nctr.live/schema/bounty/v1.json` is the **stable alias**. It tracks the latest
    0.x.
  - `https://api.nctr.live/schema/bounty/v0.2.json` is **pinned** and never changes.
- **Implementations should pin; agents may follow the alias.** A store's validator that pins
  can't be broken by a new optional field. An agent that follows the alias accepts every 0.x
  object it meets.
- **The alias is cached.** It can take a few hours for a schema change to reach every reader. Plan
  for a minor version to be visible the same day, not the same minute.
- **1.x, when it comes, may change meaning, not just add fields.** Accept every `0.x`, and treat
  anything else as unknown until you've read what changed.

### What if the bounty only covers some products?

Set `scope: "selected"` on the store object ([§1.1](SPEC.md#11-scope-and-the-product-level-rule-v04)),
and declare the bounty **on each qualifying product**: the `bounty` `PropertyValue` inside that
product's JSON-LD `Offer`, or the `bounty` metafields on the product. An agent must find the
product-level declaration before telling a shopper that a product earns. A product without one is
**not covered**, which is different from the store being unknown.

`scope: "store"`, the default, means every purchase qualifies. Product-level declarations can still
refine the sentence for a product, but never narrow a store-wide claim.

### How do I say what my reward is worth? (v0.5)

Add the optional `rewards` block ([§7](SPEC.md#7-rewards-v05)):
- **`value`**: one sentence saying what your unit is worth: "100 points = $5 off at checkout."
  There's no rate field. Agents quote the sentence and compute nothing from it.
- **`ladder`**: your tiers in order, with `basis` (`earned`, `held` or `spend`), the `unit`
  thresholds are counted in, and the thresholds themselves. Any number of tiers, any names.
- **`perks`**: what membership unlocks, each with `state`: `planned`, `committed` or `funded`.
  Agents present only `funded` perks as available, and a `planned` perk never names a sponsor.

Leave out anything you can't state truthfully; absent means not stated, never "none". A token
program can omit the block and let agents derive it from the Token Profile (§7.4). An object
your store hosts should do that, because a copy on the store is the one that goes stale.

### Which agents read which carrier?

This is the honest picture as of October 2026. Each cell says how we know: **observed** (tested
against a live store or the reference implementation), **documented** (the platform says so), or
**by construction / untested** (follows from how the agent works, not verified against a
production agent).

| Carrier | Agents that fetch URLs (spec §4) | Agents that parse HTML | Agents that drive a browser | Platform catalog channels (e.g. Shopify Catalog → AI assistants) | Search engines |
|---|---|---|---|---|---|
| **`/.well-known/bounty.json`** | **Yes**: step 1 of discovery. Observed. | Only if they also fetch it. | No: not a page. | **No**: catalogs don't fetch store URLs. Documented. | No known consumer. |
| **`<link rel="bounty">`** | **Yes**: step 2. Observed (the §4 walk resolves through it). | **Yes**: it's in the `<head>`. Observed. | **No**: a `<link>` has no text in the accessibility tree. Observed. | No. | No known consumer. |
| **JSON-LD `PropertyValue` in the `Offer`** | Only if they parse product pages. | **Yes**: it's in the HTML. Observed. | **No**: script contents aren't in the accessibility tree. By construction. | **No**: the catalog sends a fixed attribute set. Documented. | Valid schema.org, but no engine uses a `bounty` property. Treat as ignored. |
| **Visible sentence on the product page** | No. | Yes, as text, not structured. | **Yes**: it's page text. By construction; not verified against a production browser agent. | No. | As ordinary page text. |
| **Shopify `bounty.*` metafields** | No. | No. | No. | **No, unless the merchant maps them** in Catalog Mapping, and there's no catalog field for a bounty. Documented. | No. |
| **Store-facts surface** (e.g. Shopify Knowledge Base), pasting the sentence verbatim | No. | No. | No. | **Documented as a source agents read** for pre-purchase questions. Untested for this sentence; agents may paraphrase it. | No. |

What this means in practice:

- **Publish the well-known object or the link element**, so agents that follow the spec find it.
- **Put the sentence visibly on product pages** for agents that drive a browser. Head markup alone
  is invisible to them.
- **Keep the JSON-LD** for agents and tools that parse product HTML.
- **Don't count on platform catalogs** carrying the bounty today. Where the platform has a
  store-facts surface, paste the sentence there verbatim, and keep the machine-readable carriers
  authoritative.

### What does an agent do if it finds nothing?

It reports the store as **unknown, never as "no"**. A store that hasn't published is not a store
that doesn't pay. See [§4](SPEC.md#4-conformance-for-agents).

---

## Programs

Programs that publish a program object and settle bounties.

| Program | Program object | Index of stores | Settles via |
|---|---|---|---|
| **NCTR Alliance** (the first program) | [`https://api.nctr.live/.well-known/bounty.json`](https://api.nctr.live/.well-known/bounty.json) | [`https://api.nctr.live/v1/bounties`](https://api.nctr.live/v1/bounties), paginated, with `listed_by` on every object | Shopify `orders/paid` today; Stripe next ([reference note](SETTLEMENT.md#reference-implementation)) |

To add a program, open a pull request with your program object's URL and how stores join.

### Integrations: publishing from an existing loyalty program

Stores that already run a loyalty program can publish a bounty without typing a sentence. These
integrations read the program's **live earning rule** and compose
*"Members earn N <points name> per dollar, redeemable at checkout."* from it, with the store as the
program. If the rule can't be read (the program is off, has no store-wide purchase rule, isn't in
dollars, has nothing to redeem), they say why and publish nothing.

| Loyalty program | Reads | Available in |
|---|---|---|
| **Smile.io** | the storefront's Smile embed and Smile's storefront SDK endpoints | Bounty app for Shopify (not yet listed in the App Store); [Open Bounty for WooCommerce](https://github.com/Hoya25/bounty-woocommerce)\* |
| **Yotpo Loyalty & Referrals** | the loyalty loader on the storefront: the store-wide purchase campaign, tiers, redemptions | Bounty app for Shopify (not yet listed in the App Store); [Open Bounty for WooCommerce](https://github.com/Hoya25/bounty-woocommerce)\* |
| **LoyaltyLion** | the LoyaltyLion SDK's start script (whether the program is on) and site configuration | Bounty app for Shopify (not yet listed in the App Store); [Open Bounty for WooCommerce](https://github.com/Hoya25/bounty-woocommerce)\* |
| **Okendo Loyalty** | the loyalty settings block Okendo renders into the storefront, and the program's public storefront endpoints | Bounty app for Shopify (not yet listed in the App Store). Okendo runs only on Shopify. |

All four also compose the v0.5 **`rewards`** block from the same live data:
- **value:** from a redemption rule with a stated worth (money off, percent off, store credit).
- **ladder:** from the tiers, entry tier first.
- **perks:** the entry tier's perks, marked `funded` only where the program shows them as live
  for that tier.

If any part can't be read truthfully, the object publishes without `rewards` and says why. The
earn sentence is unaffected. Free products and free shipping state no worth, so a program that
redeems only for those publishes no `value`, and therefore no block.

\* Smile.io doesn't support WooCommerce. Yotpo doesn't support new WooCommerce accounts.
LoyaltyLion doesn't list WooCommerce as an install target. On WooCommerce these options read
existing or custom installs only, and say so.

The WooCommerce plugin also offers **"Describe your own reward"**: any program, in the merchant's
own words, checked against the schema. The Shopify app doesn't have this option yet.

---

## Verify

Everything below works against any store. Replace `STORE` with a domain.

**1. The well-known object, and its schema pointer**

```sh
curl -sD - https://STORE/.well-known/bounty.json -o /tmp/bounty.json | grep -iE '^(HTTP/|content-type:|access-control-allow-origin:|link:)'
cat /tmp/bounty.json
```

Expect `200`, `application/json`, `access-control-allow-origin: *`, and
`Link: <https://api.nctr.live/schema/bounty/v1.json>; rel="describedby"`. A `404` sends you to
step 2.

**2. The link element**

```sh
curl -sL https://STORE/ | grep -o '<link[^>]*rel="bounty"[^>]*>'
```

**3. JSON-LD on a product page**

```sh
curl -sL https://STORE/products/SOME-PRODUCT | grep -o '"propertyID":"bounty"[^}]*'
```

**4. Validate an object against the schema**

```sh
npm install --no-save ajv ajv-formats
curl -s https://api.nctr.live/schema/bounty/v1.json -o /tmp/schema.json
node -e '
const Ajv = require("ajv/dist/2020").default, addFormats = require("ajv-formats");
const ajv = new Ajv({ allErrors: true }); addFormats(ajv);
const ok = ajv.validate(require("/tmp/schema.json"), require("/tmp/bounty.json"));
console.log(ok ? "valid" : ajv.errors);'
```

**5. The §4 discovery walk, as a conforming agent runs it**

```sh
walk() {
  d="$1"
  code=$(curl -s -o /tmp/bounty.json -w '%{http_code}' "https://$d/.well-known/bounty.json")
  if [ "$code" = 200 ]; then echo "step 1: found at /.well-known/bounty.json"; cat /tmp/bounty.json; return; fi
  echo "step 1: $code, continuing"
  href=$(curl -sL "https://$d/" | grep -o '<link[^>]*rel="bounty"[^>]*>' | head -1 | sed -E 's/.*href="([^"]+)".*/\1/')
  case "$href" in /*) href="https://$d$href";; esac
  if [ -n "$href" ] && curl -sf "$href" -o /tmp/bounty.json; then echo "step 2: found via link → $href"; cat /tmp/bounty.json; return; fi
  echo "step 3: unknown (not \"no\")"
}
walk merch.nctr.live
```

Against `merch.nctr.live` this resolves at step 2. Against `api.nctr.live` it resolves at step 1.
Against a store that has published nothing, it ends at "unknown".
