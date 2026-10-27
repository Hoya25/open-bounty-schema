# UCP outreach — drafts

**Status: approved as written, pending Anderson's go to post. Nothing posted.**
Drafted 2026-09-10. Both texts are final; do not rewrite before posting.

Backing implementation, live since 2026-09-10:

| | |
|---|---|
| Schema (alias) | https://api.nctr.live/schema/ucp/bounty/latest.json |
| Schema (pinned) | https://api.nctr.live/schema/ucp/bounty/2026-09-10.json |
| Declaration block | https://api.nctr.live/schema/ucp/bounty/capability.json |
| Spec | https://api.nctr.live/schema/ucp/bounty/spec |
| Namespace | `live.nctr.bounty` |
| Extends | `dev.ucp.shopping.catalog.search`, `dev.ucp.shopping.catalog.lookup` |
| UCP version pinned | 2026-08-25 |
| Drift test | `test/ucp-extension.test.mjs` in `nctr-loyalty-layer` — asserts 1:1 with published OBS v0.3 by deep equality |

---

## Draft 1 — PR for `Universal-Commerce-Protocol/ucp`

**Target:** `docs/specification/common/extensions/loyalty.md`
**Title:** Loyalty: add a pre-identity, catalog-level earn declaration

---

### The gap

`dev.ucp.common.loyalty` describes an *identified member*: memberships, tiers, benefits, and an
`earning_forecast` for the current transaction, with `provisional` recording how well the
eligibility claim was verified. That is the right model for cart and checkout.

It cannot answer the question that comes before it, because that question has no member in it:
**does buying here pay the shopper at all?**

An agent comparing three stores for an anonymous shopper has no membership claim to attach loyalty
to, so there is nothing to hang the extension on. Yet whether a store pays the shopper is exactly
what decides which store the agent proposes. It is a fact about the business, available before any
identity exists, and today UCP has no place to put it.

### Why the existing shape doesn't stretch to cover it

`earning_forecast.amount` is a required non-negative integer. For a program whose earn rate rises
with standing, no honest anonymous integer exists — the number depends on who is asking, and nobody
is asking yet. A business in that position must either omit the extension entirely or invent a
number for a shopper it cannot identify.

One truthful sentence does exist, and always does. That is the difference we're proposing to encode.

### Proposed shape

A `bounty` property on the two catalog capabilities (`catalog.search`, `catalog.lookup`),
response-only:

```json
{
  "bounty": {
    "active": true,
    "program": { "name": "Example Rewards", "url": "https://example.com/rewards" },
    "earn": { "display": "Members earn 5 points per $1 — earning grows with status.",
              "denomination": "points", "type": "points" },
    "api": "https://example.com/rewards/api",
    "updated_at": "2026-09-10"
  }
}
```

Required: `active`, `program`, `earn.display`, `updated_at`. Catalog only — cart and checkout are
where a member is known, and there `dev.ucp.common.loyalty` is already the right tool. The two
compose cleanly on one response.

Three rules carry most of the weight:

- **`earn.display` is the required field and there is no rate field at all.** A rate invites false
  precision the business cannot deliver anonymously; a sentence a platform shows verbatim is
  checkable and honest.
- **`active: false` is a meaningful answer.** An *absent* `bounty` is not — a platform MUST report
  it as unknown, never as "no". A business that has not published is not a business that does not pay.
- **`api`, when present, is authoritative** over the embedded copy.

### Working implementation

UCP's governance asks that field additions come from a real program that needs them. This one is
live, not hypothetical:

- Schema: `https://api.nctr.live/schema/ucp/bounty/latest.json` (`live.nctr.bounty`, under our own
  namespace — we are not asking `dev.ucp.*` to adopt anything to make it work today)
- Spec: `https://api.nctr.live/schema/ucp/bounty/spec`
- It maps one-to-one onto the Open Bounty Schema v0.3, and a conformance test asserts that by deep
  equality against the published document rather than by inspection.

The underlying schema is **CC0-1.0, no owner and no gatekeeper**
(https://github.com/Hoya25/open-bounty-schema). If UCP wants this shape, take it outright — we are
not proposing a dependency on us, and we would rather retire our namespace into `dev.ucp.common`
than keep a vendor prefix on a fact that belongs to every program.

### One question we could not settle ourselves

UCP requires a platform to check that a capability's spec URI origin matches its namespace
authority. `live.nctr` reverse-maps to `nctr.live`; our documents are served from `api.nctr.live`.
Should a strict validator accept a subdomain as the namespace authority? We have assumed nothing and
would rather have a ruling than a convention.

---

## Draft 2 — reply on the Shopify developer thread

**Thread:** Can a third-party app extend the UCP profile at `/.well-known/ucp`?
https://community.shopify.dev/t/can-a-third-party-app-extend-the-ucp-profile-at-well-known-ucp/36329
**Context:** opened by Veno_Zapiet 2026-07-27 (fulfillment data). Shopify staff reply from
Wes-Dev-Shopify 2026-08-21: "At this time, developers can't add to or adjust a merchant's
`/.well-known/ucp` endpoint." Known gap, no timeline, no preview programme.

---

Adding a second data point, from a different app category, in case it helps weigh the gap.

We're a rewards app rather than a fulfillment one, but we hit the identical wall: we have a
declaration that is a fact about the merchant's store — whether buying there pays the shopper, and
one sentence saying what they get — and no way to get it into the merchant's UCP profile. Confirming
@Wes-Dev-Shopify's answer from our side: there is no extension point today, and the domain-level
redirect workaround was not something we were willing to ask merchants to do. Per-merchant DNS is
not an install flow.

What we shipped instead, in case it is useful to anyone else blocked on this:

1. A JSON object served from an app proxy at `/apps/bounty/bounty.json`, discovered via
   `<link rel="bounty">` in the head. This is the fallback our schema defines *precisely because*
   Shopify reserves `/.well-known/` — app proxies are limited to `a`, `apps`, `community` and `tools`.
2. JSON-LD inside the product `Offer`.
3. **A theme app block that renders the sentence as visible text on the product page.** This one
   surprised us and is the reason I'm replying. Agentic browsers that shop by driving a real browser
   read the accessibility tree, not the head. A `<link>` and a `<script type="application/ld+json">`
   have no text node, so they have no accessible name, so to that entire class of agent a
   correctly-published store looks like a store that publishes nothing. Head-only carriers are not
   sufficient today, whatever happens with the profile.

All three work now and none of them require the profile. But none of them are *discoverable the way
UCP is discoverable*, which is the actual loss: an agent that starts at `/.well-known/ucp` never
learns to look for the others.

On shape, if it helps to have a concrete ask rather than a general one: the useful primitive is a
**namespaced block an app may append to `ucp.capabilities`**, where the namespace is bound to the
*app*, not to the merchant's domain. Ours would be `live.nctr.bounty`, pointing at a schema we host
and version. That sidesteps the origin-matching question entirely — Shopify would not be vouching
for our data, only relaying that an installed app declares it, which is the same trust posture as an
app writing a metafield.

Happy to be a test case if a preview ever opens.
