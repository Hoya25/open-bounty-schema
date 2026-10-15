# Changelog

Every 0.x version is additive: an object valid under an earlier 0.x stays valid. Agents accept
every 0.x. The stable schema alias `https://api.nctr.live/schema/bounty/v1.json` tracks the latest;
`/schema/bounty/v0.2.json` and `/schema/token/v0.3.json` are pinned and never change.

## 0.6 (2026-10-15)

Completeness, trust and goal matching. All optional.

- **Completeness** (§1.2):
  - `eligibility { who, join_url?, note? }` and `conditions [ { type, value?, note } ]`, with
    open vocabularies and starter terms;
  - `valid_from` / `valid_until` (outside the window, inactive);
  - `currency` (ISO 4217) and `stacking { combinable, note? }`;
  - `earn.display` may be an object keyed by locale with a required `default`.
- **Visible statement** (§2e): the on-page block renders `earn.display` verbatim in an element
  with `data-bounty-display` and an `aria-label`, within the product's purchase region.
- **Metafield carrier** (§2b): `currency`, `eligibility`, `conditions`, `valid_from`,
  `valid_until`, `stacking`.
- **Verification** (§3.2): `verification { method, checked_at, by }`, where `method` is a closed
  enum: `program_data`, `order_sample`, `attestation`, `none`.
- **Goal matching** (§8): `fulfills` goal tags on `rewards.perks[]` and on Token Profile unlocks.
  Agents match locally and present only funded items as available.
- **Signed objects** (§9): a JWKS at `/.well-known/bounty-keys.json`, and a detached JWS (EdDSA)
  in a `Bounty-Signature` response header. The outcomes are signed, unsigned or invalid; invalid
  is a hard stop.
- **Token Profile schema:** gains `unlocks[].fulfills` and a stable alias,
  `/schema/token/v1.json`.

## 0.5 (2026-10-15)

- `rewards { value, ladder, perks, redeem_url, terms_url }` (§7). `value` is a sentence; there
  is no rate field.
- Perks carry the Token Profile's three states (`planned`, `committed`, `funded`).
- Token programs may omit the block; agents derive it from the Token Profile (§7.4).
- `bounty.rewards` json metafield.

## 0.4 (2026-10-14)

- `scope`: `store` or `selected`, with the product-level rule (§1.1).
- `listed_by`: `program`, `index` or `store` (§3.1).

## 0.3 (2026-09-07)

- Token Profiles (§6): a second object type for what holding a token unlocks.
- `tokens`, an array of Token Profile URLs, on the store object.

## 0.2 (2026-09-06)

- Discovery order (§4): `/.well-known/bounty.json`, then `<link rel="bounty">`, then unknown,
  never "no". The object is unchanged.

## 0.1 (2026-09-06)

- The bounty object and its carriers.

Settlement has its own versioning: [SETTLEMENT.md](SETTLEMENT.md) v0.1 (2026-10-14).
