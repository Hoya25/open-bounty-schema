// open-bounty-check, offline: a mock fetch serves every case.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { check, exitCode, normalizeDomain } from '../lib/check.js';

const SCHEMA = JSON.parse(readFileSync(new URL('../../../schema/bounty.schema.json', import.meta.url), 'utf8'));
const SCHEMA_URL = 'https://schema.test/bounty.json';
const OBJ = {
  bounty_schema_version: '0.6', active: true,
  program: { name: 'Example Outfitters Rewards', url: 'https://shop.test/rewards' },
  earn: { display: 'Members earn 1 point per dollar, redeemable at checkout.', type: 'points' },
  updated_at: '2026-10-15',
};

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const JWKS = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'EdDSA' }] };
const b64 = (b) => Buffer.from(b).toString('base64url');
function signed(body, key = privateKey, kid = 'k1') {
  const h = b64(JSON.stringify({ alg: 'EdDSA', kid, typ: 'bounty+jws' }));
  return `${h}..${b64(edSign(null, Buffer.from(`${h}.${b64(body)}`), key))}`;
}

function server(routes) {
  return async (url) => {
    if (url === SCHEMA_URL) return new Response(JSON.stringify(SCHEMA), { status: 200 });
    const r = routes[url];
    if (!r) return new Response('not found', { status: 404 });
    const [status, body, headers = {}] = r;
    const res = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
    Object.defineProperty(res, 'url', { value: url });
    return res;
  };
}
const run = (routes, opts = {}) => check('shop.test', { fetch: server(routes), schemaUrl: SCHEMA_URL, ...opts });

test('valid at the well-known path: exit 0, sentence returned, unsigned', async () => {
  const r = await run({ 'https://shop.test/.well-known/bounty.json': [200, OBJ] });
  assert.equal(r.status, 'valid'); assert.equal(exitCode(r), 0);
  assert.equal(r.found_at, 'well-known');
  assert.equal(r.earn_display, OBJ.earn.display);
  assert.equal(r.signature.outcome, 'unsigned');
  assert.equal(r.carriers.link.present, false);
});

test('valid through <link rel="bounty"> only (the Shopify case)', async () => {
  const r = await run({
    'https://shop.test/': [200, '<html><head><link rel="bounty" type="application/json" href="/apps/bounty/bounty.json"></head><body></body></html>'],
    'https://shop.test/apps/bounty/bounty.json': [200, OBJ],
  });
  assert.equal(r.status, 'valid'); assert.equal(r.found_at, 'link');
  assert.equal(r.carriers.well_known.pass, false); assert.equal(r.carriers.well_known.present, false);
});

test('signed: verified against the object origin key set', async () => {
  const body = JSON.stringify(OBJ);
  const r = await run({
    'https://shop.test/.well-known/bounty.json': [200, body, { 'Bounty-Signature': signed(body) }],
    'https://shop.test/.well-known/bounty-keys.json': [200, JWKS],
  });
  assert.equal(r.signature.outcome, 'signed'); assert.equal(r.signature.signed_by, 'https://shop.test');
});

test('an invalid signature is a hard stop: status invalid, exit 1, no sentence', async () => {
  const body = JSON.stringify(OBJ);
  const other = generateKeyPairSync('ed25519').privateKey;
  const r = await run({
    'https://shop.test/.well-known/bounty.json': [200, body, { 'Bounty-Signature': signed(body, other) }],
    'https://shop.test/.well-known/bounty-keys.json': [200, JWKS],
  });
  assert.equal(r.status, 'invalid'); assert.equal(exitCode(r), 1);
  assert.equal(r.earn_display, undefined);
  assert.match(r.reason, /hard stop/);
});

test('an invalid object: status invalid, exit 1, with the schema errors', async () => {
  const r = await run({ 'https://shop.test/.well-known/bounty.json': [200, { ...OBJ, rate: 0.05 }] });
  assert.equal(r.status, 'invalid'); assert.equal(exitCode(r), 1);
  assert.ok(r.carriers.well_known.errors.length > 0);
});

test('nothing published: unknown (never "no"), exit 2', async () => {
  const r = await run({ 'https://shop.test/': [200, '<html><head></head><body>shop</body></html>'] });
  assert.equal(r.status, 'unknown'); assert.equal(exitCode(r), 2);
  assert.match(r.reason, /not "no"/);
});

test('product page: JSON-LD and the visible labeled region, verbatim; a <template> copy does not count', async () => {
  const page = `<html><head><script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","additionalProperty":{"@type":"PropertyValue","propertyID":"bounty","value":"${OBJ.earn.display}"}}}</script></head>
    <body><template><section data-bounty-display aria-label="x">${OBJ.earn.display}</section></template>
    <form action="/cart/add"></form><section data-bounty-display aria-label="Rewards on this purchase"><p>${OBJ.earn.display}</p></section></body></html>`;
  const routes = { 'https://shop.test/.well-known/bounty.json': [200, OBJ], 'https://shop.test/products/a': [200, page] };
  const r = await run(routes, { product: 'https://shop.test/products/a' });
  assert.equal(r.carriers.json_ld.pass, true);
  assert.equal(r.carriers.visible.pass, true); assert.equal(r.carriers.visible.label, 'Rewards on this purchase');
  const onlyTemplate = page.replace(/<section data-bounty-display aria-label="Rewards[\s\S]*?<\/section>/, '');
  const r2 = await run({ ...routes, 'https://shop.test/products/a': [200, onlyTemplate] }, { product: 'https://shop.test/products/a' });
  assert.equal(r2.carriers.visible.pass, false);
});

test('localized earn.display reports the default; outside valid_until is valid but not active', async () => {
  const loc = { ...OBJ, earn: { display: { default: 'Members earn 5 points per €1.', fr: 'Les membres gagnent 5 points par 1 €.' } }, valid_until: '2026-01-31' };
  const r = await run({ 'https://shop.test/.well-known/bounty.json': [200, loc] }, { now: Date.parse('2026-10-15T12:00:00Z') });
  assert.equal(r.status, 'valid'); assert.equal(r.earn_display, 'Members earn 5 points per €1.'); assert.equal(r.active, false);
});

test('https only; domains are normalised', async () => {
  assert.equal(normalizeDomain('HTTPS://Shop.Test/path'), 'shop.test');
  assert.equal(normalizeDomain('not a domain'), null);
  const r = await run({
    'https://shop.test/': [200, '<head><link rel="bounty" href="http://shop.test/b.json"></head>'],
    'http://shop.test/b.json': [200, OBJ],
  });
  assert.equal(r.status, 'unknown');
});
