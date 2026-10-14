/**
 * Validates every file in examples/ against schema/bounty.schema.json.
 *
 * Run: npm install && npm test
 *
 * The schema is the normative artifact; SPEC.md is the prose. If the two ever
 * disagree, that is a bug in one of them — this script is what catches it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The default ajv export is draft-07. This schema declares draft 2020-12, so
// it must be compiled by the 2020 build or the $schema ref cannot resolve.
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(here, 'schema/bounty.schema.json'), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const dir = join(here, 'examples');
let failed = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  if (validate(data)) {
    console.log(`  PASS  ${file}`);
  } else {
    failed++;
    console.log(`  FAIL  ${file}`);
    for (const e of validate.errors) {
      console.log(`          ${e.instancePath || '/'} ${e.message}`);
    }
  }
}

// A schema that accepts anything is worse than no schema. Prove it rejects.
const mustReject = [
  ['missing required field', { active: true, program: { name: 'x', url: 'https://x.test' }, earn: { display: 'y' }, updated_at: '2026-01-01' }],
  ['unknown top-level field', { bounty_schema_version: '0.1', active: true, program: { name: 'x', url: 'https://x.test' }, earn: { display: 'y' }, updated_at: '2026-01-01', rate: 0.05 }],
  ['bad earn.type', { bounty_schema_version: '0.1', active: true, program: { name: 'x', url: 'https://x.test' }, earn: { display: 'y', type: 'crypto' }, updated_at: '2026-01-01' }],
  ['non-ISO updated_at', { bounty_schema_version: '0.1', active: true, program: { name: 'x', url: 'https://x.test' }, earn: { display: 'y' }, updated_at: 'Sept 6 2026' }],
  // v0.4 enums are closed: an agent decides whether to check the product page
  // on `scope`, and weighs the source on `listed_by`, so an invented value must
  // not slip through as if it meant something.
  ['unknown scope', { bounty_schema_version: '0.4', active: true, program: { name: 'x', url: 'https://x.test' }, earn: { display: 'y' }, scope: 'some', updated_at: '2026-01-01' }],
  ['unknown listed_by', { bounty_schema_version: '0.4', active: true, program: { name: 'x', url: 'https://x.test' }, earn: { display: 'y' }, listed_by: 'agent', updated_at: '2026-01-01' }]
];

for (const [label, doc] of mustReject) {
  if (validate(doc)) {
    failed++;
    console.log(`  FAIL  schema wrongly ACCEPTED: ${label}`);
  } else {
    console.log(`  PASS  correctly rejects: ${label}`);
  }
}

// Every 0.x version stays valid: v0.2 added a discovery order, v0.3 the
// optional `tokens`, v0.4 the optional `scope` and `listed_by`. Agents must
// accept all of them, so the schema must too. The example set is deliberately
// mixed across 0.1–0.4, so this is proven by the files above as well as
// asserted here.
const base = JSON.parse(readFileSync(join(dir, 'minimal.json'), 'utf8'));
for (const version of ['0.1', '0.2', '0.3', '0.4']) {
  if (validate({ ...base, bounty_schema_version: version })) {
    console.log(`  PASS  accepts bounty_schema_version ${version}`);
  } else {
    failed++;
    console.log(`  FAIL  rejected bounty_schema_version ${version}`);
  }
}

const versions = new Set(
  readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).bounty_schema_version)
);
if (['0.1', '0.2', '0.3', '0.4'].every((v) => versions.has(v))) {
  console.log('  PASS  example set covers all published versions');
} else {
  failed++;
  console.log(`  FAIL  examples cover only ${[...versions].join(', ')}`);
}

// v0.4 added two OPTIONAL fields. A v0.3 object published before them carries
// neither and must still validate unchanged — the additive guarantee, asserted
// against the real v0.3 example rather than a synthetic one.
const v03 = JSON.parse(readFileSync(join(dir, 'nctr-alliance-v03.json'), 'utf8'));
if (v03.bounty_schema_version === '0.3' && !('scope' in v03) && !('listed_by' in v03) && validate(v03)) {
  console.log('  PASS  a v0.3 object without scope or listed_by still validates');
} else {
  failed++;
  console.log('  FAIL  the v0.3 example no longer validates as published');
}

// ── v0.3: Token Profiles ────────────────────────────────────────────────────
console.log('\n  Token Profiles (v0.3)');

const tokenSchema = JSON.parse(readFileSync(join(here, 'schema/token.schema.json'), 'utf8'));
const validateToken = ajv.compile(tokenSchema);
const tokenDir = join(dir, 'tokens');

for (const file of readdirSync(tokenDir).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(join(tokenDir, file), 'utf8'));
  if (validateToken(data)) {
    console.log(`  PASS  tokens/${file}`);
  } else {
    failed++;
    console.log(`  FAIL  tokens/${file}`);
    for (const e of validateToken.errors) {
      console.log(`          ${e.instancePath || '/'} ${e.message}`);
    }
  }
}

// THE LOAD-BEARING TEST OF THE WHOLE DESIGN.
// The issuer's roster grows without limit, and adding a token must never require
// a schema release. So a profile for a symbol that does not exist — and that
// nobody has ever heard of — must validate. If this ever fails, someone has
// added an enum of known symbols and broken the open-ended guarantee.
const invented = {
  token_schema_version: '0.3',
  symbol: 'QUARRY7',
  name: 'Quarry',
  canonical_url: 'https://api.nctr.live/v1/tokens/quarry7',
  listed: false,
  lifecycle: 'design',
  issuer: { name: 'NCTR Alliance', url: 'https://themall.nctr.live' },
  status_ladder: {
    basis: 'held',
    // Deliberately THREE rungs, with thresholds unlike the default ladder.
    // A ladder is per-token and overridable, so a consumer that assumes five
    // rungs or a fixed threshold set is wrong, and this proves the schema
    // does not encode that assumption either.
    note: 'Status in this world. It is not an earning multiplier.',
    rungs: [
      { rung: 'Apprentice', threshold: 250 },
      { rung: 'Journeyman', threshold: 900 },
      { rung: 'Master', threshold: 4200 }
    ]
  },
  updated_at: '2026-09-07'
};
if (validateToken(invented)) {
  console.log('  PASS  accepts an invented symbol and a non-default ladder (no enum)');
} else {
  failed++;
  console.log('  FAIL  rejected an invented symbol or non-default ladder — the roster has been hardcoded');
  for (const e of validateToken.errors) console.log(`          ${e.instancePath || '/'} ${e.message}`);
}

const tokenMustReject = [
  ['missing symbol', { token_schema_version: '0.3', canonical_url: 'https://x.test', issuer: { name: 'x', url: 'https://x.test' }, updated_at: '2026-01-01' }],
  ['lowercase symbol', { token_schema_version: '0.3', symbol: 'sweat', canonical_url: 'https://x.test', issuer: { name: 'x', url: 'https://x.test' }, updated_at: '2026-01-01' }],
  ['$-prefixed symbol', { token_schema_version: '0.3', symbol: '$SWEAT', canonical_url: 'https://x.test', issuer: { name: 'x', url: 'https://x.test' }, updated_at: '2026-01-01' }],
  ['unknown unlock state', { token_schema_version: '0.3', symbol: 'SWEAT', canonical_url: 'https://x.test', issuer: { name: 'x', url: 'https://x.test' }, updated_at: '2026-01-01', unlocks: [{ name: 'x', state: 'maybe' }] }],
  ['unknown top-level field', { token_schema_version: '0.3', symbol: 'SWEAT', canonical_url: 'https://x.test', issuer: { name: 'x', url: 'https://x.test' }, updated_at: '2026-01-01', budget_usd: 5000 }]
];

for (const [label, doc] of tokenMustReject) {
  if (validateToken(doc)) {
    failed++;
    console.log(`  FAIL  token schema wrongly ACCEPTED: ${label}`);
  } else {
    console.log(`  PASS  correctly rejects: ${label}`);
  }
}

// ── Settlement events (SETTLEMENT.md) ───────────────────────────────────────
console.log('\n  Settlement events (v0.1)');

const settlementSchema = JSON.parse(readFileSync(join(here, 'schema/settlement-event.schema.json'), 'utf8'));
const validateSettlement = ajv.compile(settlementSchema);
const settlementDir = join(dir, 'settlement');

for (const file of readdirSync(settlementDir).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(join(settlementDir, file), 'utf8'));
  if (validateSettlement(data)) {
    console.log(`  PASS  settlement/${file}`);
  } else {
    failed++;
    console.log(`  FAIL  settlement/${file}`);
    for (const e of validateSettlement.errors) console.log(`          ${e.instancePath || '/'} ${e.message}`);
  }
}

const paid = JSON.parse(readFileSync(join(settlementDir, 'order-paid.json'), 'utf8'));
const settlementMustReject = [
  ['missing idempotency_key', (({ idempotency_key, ...rest }) => rest)(paid)],
  ['float amount', { ...paid, total: { amount: 84.5, currency: 'USD' } }],
  ['minor-unit or malformed currency', { ...paid, total: { amount: '84.50', currency: 'usd' } }],
  ['store_domain with a scheme', { ...paid, store_domain: 'https://shop.example' }],
  ['refund without refers_to', { ...paid, type: 'order.refunded', idempotency_key: 'k2' }],
  ['unknown event type', { ...paid, type: 'order.shipped' }],
  ['missing shopper id_type', { ...paid, shopper: { id: 'mbr_1' } }]
];
for (const [label, doc] of settlementMustReject) {
  if (validateSettlement(doc)) {
    failed++;
    console.log(`  FAIL  settlement schema wrongly ACCEPTED: ${label}`);
  } else {
    console.log(`  PASS  correctly rejects: ${label}`);
  }
}
// §2: unknown fields MUST be ignored, so a sender's own context is not an error.
if (validateSettlement({ ...paid, sender_context: { relay: 'x' } })) {
  console.log('  PASS  accepts unknown fields (programs ignore them)');
} else {
  failed++;
  console.log('  FAIL  rejected an unknown field; §2 says programs ignore them');
}

console.log(failed ? `\n${failed} failure(s)` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
