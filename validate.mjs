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
  ['non-ISO updated_at', { bounty_schema_version: '0.1', active: true, program: { name: 'x', url: 'https://x.test' }, earn: { display: 'y' }, updated_at: 'Sept 6 2026' }]
];

for (const [label, doc] of mustReject) {
  if (validate(doc)) {
    failed++;
    console.log(`  FAIL  schema wrongly ACCEPTED: ${label}`);
  } else {
    console.log(`  PASS  correctly rejects: ${label}`);
  }
}

// v0.2 added a discovery order, not a field. Objects published under v0.1 stay
// valid and agents must accept both, so the schema must too. The example set is
// deliberately mixed — nctr-alliance is 0.2, the rest are 0.1 — so this is
// proven by the files above as well as asserted here.
const base = JSON.parse(readFileSync(join(dir, 'minimal.json'), 'utf8'));
for (const version of ['0.1', '0.2']) {
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
if (versions.has('0.1') && versions.has('0.2')) {
  console.log('  PASS  example set covers both published versions');
} else {
  failed++;
  console.log(`  FAIL  examples cover only ${[...versions].join(', ')}`);
}

console.log(failed ? `\n${failed} failure(s)` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
