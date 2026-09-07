/**
 * Validates the LIVE reference implementation against the PUBLISHED schema.
 * The repo's own test proves the examples are valid; this proves production is.
 */
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const bounty = ajv.compile(JSON.parse(readFileSync('schema/bounty.schema.json', 'utf8')));
const token = ajv.compile(JSON.parse(readFileSync('schema/token.schema.json', 'utf8')));

let failed = 0;
const get = async (u) => (await fetch(u)).json();

const wk = await get('https://api.nctr.live/.well-known/bounty.json');
if (bounty(wk)) console.log('  PASS  live /.well-known/bounty.json validates');
else { failed++; console.log('  FAIL  well-known', JSON.stringify(bounty.errors)); }

const roster = await get('https://api.nctr.live/v1/tokens');
for (const t of roster.tokens) {
  const profile = await get(t.canonical_url);
  if (token(profile)) console.log(`  PASS  live ${t.symbol} profile validates`);
  else { failed++; console.log(`  FAIL  ${t.symbol}`, JSON.stringify(token.errors)); }
}

// Unlisted tokens are addressable and must validate too.
for (const s of ['sisu', 'shift']) {
  const profile = await get(`https://api.nctr.live/v1/tokens/${s}`);
  if (token(profile)) console.log(`  PASS  live unlisted ${s.toUpperCase()} validates`);
  else { failed++; console.log(`  FAIL  ${s}`, JSON.stringify(token.errors)); }
}

// Drift guard: the vendored schema the Worker serves must equal the repo's.
const served = await get('https://api.nctr.live/schema/token/v0.3.json');
const local = JSON.parse(readFileSync('schema/token.schema.json', 'utf8'));
if (JSON.stringify(served) === JSON.stringify(local)) {
  console.log('  PASS  served token schema matches the repo (no drift)');
} else {
  failed++;
  console.log('  FAIL  served token schema has DRIFTED from the repo');
}

console.log(failed ? `\n${failed} failure(s)` : '\nLive implementation conforms.');
process.exit(failed ? 1 : 0);
