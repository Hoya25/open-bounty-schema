#!/usr/bin/env node
/**
 * open-bounty-check <domain> [--product URL] [--json] [--schema URL]
 *
 * Exit 0 only when a valid object was found; 1 when objects were found but none
 * is valid (or a signature failed); 2 when nothing is published (unknown, not "no").
 */

import { check, exitCode, VERSION } from '../lib/check.js';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
if (args.includes('--version')) { console.log(VERSION); process.exit(0); }
if (args.includes('--help') || args.includes('-h')) {
  console.log(`open-bounty-check ${VERSION}

Usage: open-bounty-check <domain> [--product <product page URL>] [--json] [--schema <schema URL>]

Runs the Open Bounty Schema §4 discovery walk for a store, validates what it
finds against the live schema, verifies a signature when present, and reports
each carrier.

Exit codes: 0 valid · 1 invalid (or a failed signature) · 2 unknown (nothing published)`);
  process.exit(0);
}
const product = opt('--product');
const schemaUrl = opt('--schema');
const asJson = args.includes('--json');
const domain = args.filter((a) => a !== '--json')[0];
if (!domain) { console.error('usage: open-bounty-check <domain> [--product URL] [--json]'); process.exit(64); }

const r = await check(domain, { product, schemaUrl });

if (asJson) {
  console.log(JSON.stringify(r, null, 2));
} else {
  // PASS valid · FAIL published but not valid · '  —  ' not published or not checked
  const mark = (c) => (c === undefined || (!c.pass && c.present === false) ? '  —  ' : c.pass ? ' PASS' : ' FAIL');
  const label = { well_known: '/.well-known/bounty.json', link: '<link rel="bounty">', json_ld: 'JSON-LD Offer', visible: 'visible statement' };
  console.log(`${r.domain}: ${r.status.toUpperCase()}`);
  for (const k of ['well_known', 'link', 'json_ld', 'visible']) {
    const c = r.carriers?.[k];
    const detail = !c ? (k === 'json_ld' || k === 'visible' ? 'not checked (pass --product <URL>)' : '')
      : c.pass ? [c.url ?? c.href, c.signature && c.signature.outcome !== 'unsigned' ? `signature ${c.signature.outcome}` : '', c.label ? `aria-label "${c.label}"` : ''].filter(Boolean).join(' · ')
      : [c.note, ...(c.errors ?? []).slice(0, 3), c.signature?.outcome === 'invalid' ? `signature invalid: ${c.signature.detail}` : ''].filter(Boolean).join(' · ');
    console.log(`  ${mark(c)}  ${label[k].padEnd(26)} ${detail}`);
  }
  if (r.status === 'valid') {
    console.log(`\n  earn.display: "${r.earn_display}"`);
    console.log(`  program: ${r.program?.name} (${r.program?.url}) · found at ${r.found_at} · object ${r.schema.object_version} · ${r.active ? 'active' : 'NOT active now'}`);
    console.log(`  signature: ${r.signature.outcome}${r.signature.signed_by ? ` by ${r.signature.signed_by}` : ''}`);
  } else {
    console.log(`\n  ${r.reason}`);
  }
}
process.exit(exitCode(r));
