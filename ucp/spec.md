# live.nctr.bounty — Open Bounty Schema Extension for UCP

Version: 2026-09-10 · UCP: 2026-08-25 · Schema: https://api.nctr.live/schema/ucp/bounty/2026-09-10.json

## What it declares

Whether buying from this business pays the shopper, and one human sentence
saying what the shopper gets. Store-level and **pre-identity**: true before any
membership is claimed, verified, or even offered.

## Relationship to dev.ucp.common.loyalty

`dev.ucp.common.loyalty` describes an **identified member** — memberships,
tiers, benefits, and an `earning_forecast` for the current transaction, with
`provisional` recording how well the eligibility claim was verified.

`live.nctr.bounty` answers the question that comes before it, and has no member
in it. An agent comparing stores for an anonymous shopper has no membership claim
to attach loyalty to, so the loyalty extension has nothing to hang on — yet
whether a store pays the shopper at all is exactly what decides which store the
agent proposes. The two are complementary, and a business may publish both.

Where a program's earn rate rises with standing, no honest anonymous
`earning_forecast.amount` exists: the number depends on who is asking, and
nobody is asking yet. One truthful sentence does exist. That is why
`earn.display` is required here and no rate field exists at all.

## Extends

- `dev.ucp.shopping.catalog.search`
- `dev.ucp.shopping.catalog.lookup`

Catalog only. Cart and checkout are where a member is known, and there
`dev.ucp.common.loyalty` is the right tool.

## Shape

A `bounty` property is added to the extended responses. Its value is an Open
Bounty Schema v0.6 object — the mapping is the identity mapping, field for field,
and a conformance test asserts deep equality against the published schema.

Required: `bounty_schema_version`, `active`, `program`, `earn`, `updated_at`.

```json
{
  "bounty": {
    "bounty_schema_version": "0.6",
    "active": true,
    "program": { "name": "NCTR Alliance", "url": "https://themall.nctr.live" },
    "earn": {
      "display": "Members earn NCTR on every purchase — earning grows with status.",
      "denomination": "NCTR",
      "type": "token"
    },
    "api": "https://api.nctr.live/v1/bounties",
    "updated_at": "2026-09-10"
  }
}
```

`active: false` is a meaningful, honest answer. An **absent** `bounty` is not:
a platform MUST report it as unknown, never as "no". A business that has not
published is not a business that does not pay.

`api`, when present, is authoritative over the embedded copy.

## Declaring it

```json
{
  "live.nctr.bounty": [
    {
      "version": "2026-09-10",
      "extends": "dev.ucp.shopping.catalog.search",
      "spec": "https://api.nctr.live/schema/ucp/bounty/spec",
      "schema": "https://api.nctr.live/schema/ucp/bounty/2026-09-10.json"
    },
    {
      "version": "2026-09-10",
      "extends": "dev.ucp.shopping.catalog.lookup",
      "spec": "https://api.nctr.live/schema/ucp/bounty/spec",
      "schema": "https://api.nctr.live/schema/ucp/bounty/2026-09-10.json"
    }
  ]
}
```

## Governance

The underlying Open Bounty Schema is CC0-1.0 with no owner and no gatekeeper:
https://github.com/Hoya25/open-bounty-schema. Any program on any platform may
publish it. This document maps it onto UCP; it claims no authority over it.

## Open question

UCP requires a platform to check that a capability's spec URI origin matches its
namespace authority. `live.nctr` reverse-maps to `nctr.live`; these documents
are served from `api.nctr.live`. Whether a strict validator should accept a
subdomain as the namespace authority is unsettled, and is raised with the UCP
body rather than assumed.
