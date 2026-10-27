# UCP extension — `live.nctr.bounty`

Pre-identity, catalog-level bounty declaration for UCP catalog responses.

## What it answers

Before any member identity exists: **does buying here pay the shopper, and what do they get?**
`dev.ucp.common.loyalty` describes an identified member's standing. This answers the earlier
question an agent must resolve for an anonymous shopper choosing between stores.

## Extends

- `dev.ucp.shopping.catalog.search`
- `dev.ucp.shopping.catalog.lookup`

UCP version pinned: `2026-08-25`. Namespace: `live.nctr.bounty`.

## Files

- `schema.json` — JSON Schema (draft 2020-12), version `2026-09-10`
- `capability.json` — declaration block an app appends to `ucp.capabilities`
- `spec.md` — normative text
- `PR-DRAFT.md` — PR text for `Universal-Commerce-Protocol/ucp`

## Canonical URLs

| | |
|---|---|
| Schema (alias) | https://api.nctr.live/schema/ucp/bounty/latest.json |
| Schema (pinned) | https://api.nctr.live/schema/ucp/bounty/2026-09-10.json |
| Declaration block | https://api.nctr.live/schema/ucp/bounty/capability.json |
| Spec | https://api.nctr.live/schema/ucp/bounty/spec |

## Pointer convention

A Bounty pointer may appear in a well-known file, a `rel="bounty"` link, JSON-LD, or store
metafields. The namespace is bound to the **app**, not the merchant's domain, so one install
covers every storefront that app serves.

## Rules

1. `earn.display` is required; there is no rate field — a rate invites false precision.
2. `active: false` is a meaningful answer, not an absence.
3. `api` is authoritative over any embedded copy.

## License

CC0-1.0, matching Open Bounty Schema.
