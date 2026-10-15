/**
 * open-bounty-check — checks any store's Open Bounty Schema declaration.
 *
 * Runs the spec's §4 discovery walk for a domain, validates what it finds
 * against the live schema, verifies a signature when one is present (§9), and
 * reports each carrier it can see. Nothing here is specific to any program,
 * index or platform: a store is a domain, and every answer comes from what
 * that domain serves.
 *
 * Runtime-neutral on purpose (fetch, WebCrypto, TextEncoder only), so the same
 * code answers on the command line and in a Cloudflare Worker. The validator is
 * @cfworker/json-schema, which interprets the schema rather than generating
 * code, so it runs where `eval` is not allowed.
 *
 *   status "valid"    a valid object was found (exit 0)
 *   status "invalid"  objects were found, none valid, or the signature failed (exit 1)
 *   status "unknown"  nothing was published: never "no" (exit 2)
 */

import { Validator } from '@cfworker/json-schema';

export const SCHEMA_URL = 'https://api.nctr.live/schema/bounty/v1.json';
export const VERSION = '0.6.0';
const MAX_JSON = 512 * 1024;
const MAX_HTML = 3 * 1024 * 1024;
const HOST = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const enc = new TextEncoder();

/** `https://Shop.Example/path` → `shop.example`; null if it isn't a hostname. */
export function normalizeDomain(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  let host = '';
  try { host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname; } catch { return null; }
  // A store is a public hostname: no IP literals, no local or internal names.
  if (/^\d+(\.\d+){3}$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|lan|home\.arpa)$/.test(host)) return null;
  return HOST.test(host) ? host : null;
}

/**
 * GET with a size cap; https only, including after redirects. Never throws.
 * `stopAtHeadEnd` stops reading once `</head>` has arrived. The link carrier
 * lives in the head, so a large storefront page needn't be read to the end.
 */
async function get(fetchFn, url, limit, accept, userAgent, stopAtHeadEnd = false) {
  if (!/^https:\/\//i.test(url)) return { status: 0, bytes: null, url, headers: new Headers(), note: 'not https' };
  try {
    const res = await fetchFn(url, { redirect: 'follow', headers: { Accept: accept, 'User-Agent': userAgent } });
    if (!/^https:\/\//i.test(res.url || url)) return { status: 0, bytes: null, url: res.url, headers: res.headers, note: 'redirected off https' };
    const reader = res.body?.getReader?.();
    let bytes;
    if (reader) {
      const chunks = []; let size = 0; let tail = '';
      const dec = stopAtHeadEnd ? new TextDecoder() : null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        chunks.push(value);
        // The head end is checked before the cap: once </head> has arrived the
        // link carrier is in hand, however large the rest of the page is.
        if (dec) {
          // Each chunk decoded once; a short tail catches a tag split across chunks.
          const seen = tail + dec.decode(value, { stream: true });
          if (/<\/head\s*>/i.test(seen)) { await reader.cancel().catch(() => {}); break; }
          tail = seen.slice(-16);
        }
        if (size > limit) { await reader.cancel(); return { status: res.status, bytes: null, url: res.url || url, headers: res.headers, note: 'too large' }; }
      }
      bytes = new Uint8Array(size); let o = 0;
      for (const c of chunks) { bytes.set(c, o); o += c.byteLength; }
    } else {
      bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > limit) return { status: res.status, bytes: null, url: res.url || url, headers: res.headers, note: 'too large' };
    }
    return { status: res.status, bytes, url: res.url || url, headers: res.headers };
  } catch (err) {
    return { status: 0, bytes: null, url, headers: new Headers(), note: 'no response' };
  }
}

const text = (bytes) => (bytes ? new TextDecoder().decode(bytes) : '');
function jsonObject(bytes) {
  try { const d = JSON.parse(text(bytes)); return d && typeof d === 'object' && !Array.isArray(d) ? d : null; } catch { return null; }
}

/** An HTML tag's attributes, names lower-cased. Quoted or bare values. */
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/** The first `<link rel="bounty" href>` inside `<head>`. rel is a space-separated token list. */
export function findBountyLink(html) {
  const head = (html.match(/<head[\s>][\s\S]*?<\/head>/i) || [html.split(/<body[\s>]/i)[0]])[0];
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (String(a.rel ?? '').toLowerCase().split(/\s+/).includes('bounty') && a.href) return decode(a.href).trim();
  }
  return null;
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The `bounty` PropertyValue in a product page's JSON-LD Offer (§2c), or null. */
export function findOfferProperty(html) {
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let doc; try { doc = JSON.parse(m[1]); } catch { continue; }
    const nodes = Array.isArray(doc) ? doc : doc?.['@graph'] ?? [doc];
    for (const node of nodes) {
      const offers = node?.['@type'] === 'Offer' ? [node] : [].concat(node?.offers ?? []);
      for (const offer of offers) {
        for (const p of [].concat(offer?.additionalProperty ?? [])) {
          if (p?.propertyID === 'bounty' && typeof p.value === 'string') return p.value;
        }
      }
    }
  }
  return null;
}

/** The visible statement (§2e): text of the first element with data-bounty-display and an aria-label, outside <template>. */
export function findVisibleStatement(html) {
  const page = html.replace(/<template[\s\S]*?<\/template>/gi, '');
  const m = page.match(/<([a-z0-9]+)\b(?=[^>]*\sdata-bounty-display)(?=[^>]*\saria-label\s*=\s*"([^"]*)")[^>]*>([\s\S]*?)<\/\1>/i);
  if (!m) return null;
  return { label: decode(m[2]), text: decode(m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) };
}

/** A localized earn.display → its default (v0.6); a string → itself. */
export function displayOf(obj) {
  const d = obj?.earn?.display;
  return typeof d === 'string' ? d : d && typeof d === 'object' ? (typeof d.default === 'string' ? d.default : null) : null;
}

// ── v0.6 §9: signatures ─────────────────────────────────────────────────────

const b64urlBytes = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
function b64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** { outcome: signed|unsigned|invalid, detail } for one response. Keys come only from the object's own origin. */
export async function verifySignature(header, bodyBytes, objectUrl, fetchFn, userAgent) {
  if (!header) return { outcome: 'unsigned' };
  const parts = String(header).trim().split('.');
  if (parts.length !== 3 || parts[1] !== '') return { outcome: 'invalid', detail: 'not a detached JWS' };
  let protectedHeader, sig;
  try { protectedHeader = JSON.parse(text(b64urlBytes(parts[0]))); sig = b64urlBytes(parts[2]); } catch { return { outcome: 'invalid', detail: 'malformed' }; }
  if (protectedHeader.alg !== 'EdDSA') return { outcome: 'invalid', detail: `unsupported alg ${JSON.stringify(protectedHeader.alg)}` };
  const origin = new URL(objectUrl).origin;
  const keysRes = await get(fetchFn, `${origin}/.well-known/bounty-keys.json`, MAX_JSON, 'application/json', userAgent);
  const jwks = keysRes.status === 200 ? jsonObject(keysRes.bytes) : null;
  if (!jwks || !Array.isArray(jwks.keys)) return { outcome: 'invalid', detail: "the origin's key set couldn't be read" };
  const jwk = jwks.keys.find((k) => k && k.kid === protectedHeader.kid);
  if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string') return { outcome: 'invalid', detail: `no Ed25519 key with kid ${JSON.stringify(protectedHeader.kid)} at ${origin}` };
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, { name: 'Ed25519' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, enc.encode(`${parts[0]}.${b64url(bodyBytes)}`));
    return ok ? { outcome: 'signed', detail: `kid ${protectedHeader.kid}`, signed_by: origin } : { outcome: 'invalid', detail: "the signature doesn't match the object" };
  } catch {
    return { outcome: 'invalid', detail: 'the signature could not be verified' };
  }
}

// ── validation ──────────────────────────────────────────────────────────────

let schemaMemo = { url: null, at: 0, schema: null };
async function loadSchema(fetchFn, url, userAgent) {
  if (schemaMemo.url === url && Date.now() - schemaMemo.at < 600_000) return schemaMemo.schema;
  const r = await get(fetchFn, url, MAX_JSON, 'application/schema+json, application/json', userAgent);
  const schema = r.status === 200 ? jsonObject(r.bytes) : null;
  if (schema) schemaMemo = { url, at: Date.now(), schema };
  return schema;
}

/** Forget the cached schema (tests, or after a schema change). */
export function resetSchemaMemo() { schemaMemo = { url: null, at: 0, schema: null }; }

/** Schema errors plus the 0.x rule. Empty means valid. */
export function validate(obj, schema) {
  const v = new Validator(schema, '2020-12', false);
  const out = v.validate(obj);
  const errors = out.valid ? [] : out.errors
    .filter((e) => e.keyword !== 'properties' && e.keyword !== 'items' && e.keyword !== 'allOf')
    .map((e) => `${e.instanceLocation.replace(/^#\/?/, '/') || '/'} ${e.error}`);
  const version = obj?.bounty_schema_version;
  if (typeof version === 'string' && !/^0\.\d+$/.test(version)) errors.push(`/bounty_schema_version ${version} is not a 0.x version`);
  return [...new Set(errors)];
}

function inWindow(obj, now) {
  const t = (v) => (typeof v === 'string' ? Date.parse(v.length === 10 ? `${v}T23:59:59Z` : v) : NaN);
  const from = typeof obj.valid_from === 'string' ? Date.parse(obj.valid_from) : NaN;
  const until = t(obj.valid_until);
  if (!Number.isNaN(from) && now < from) return false;
  if (!Number.isNaN(until) && now > until) return false;
  return true;
}

/** One carrier that serves a whole object (well-known, link). */
async function objectCarrier(fetchFn, url, schema, userAgent) {
  const r = await get(fetchFn, url, MAX_JSON, 'application/json', userAgent);
  const out = { url, http: r.status || null };
  if (r.status !== 200) return { ...out, present: false, pass: false, note: r.status === 404 ? 'not published (404)' : r.note || (r.status ? `HTTP ${r.status}` : 'no response') };
  const obj = jsonObject(r.bytes);
  if (!obj) return { ...out, present: true, pass: false, note: 'not a JSON object' };
  const errors = validate(obj, schema);
  const signature = await verifySignature(r.headers.get('bounty-signature'), r.bytes, r.url, fetchFn, userAgent);
  return {
    ...out,
    url: r.url,
    present: true,
    pass: errors.length === 0 && signature.outcome !== 'invalid',
    errors,
    signature,
    object: obj,
  };
}

/**
 * Check one domain. Options:
 *   product    a product page URL on that domain, to check the JSON-LD and visible carriers
 *   schemaUrl  the schema to validate against (default: the spec's stable alias)
 *   fetch      a fetch implementation (default: globalThis.fetch)
 *   now        epoch ms (tests)
 */
export async function check(domainInput, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const schemaUrl = options.schemaUrl ?? SCHEMA_URL;
  const userAgent = options.userAgent ?? `open-bounty-check/${VERSION} (+https://github.com/Hoya25/open-bounty-schema)`;
  const now = options.now ?? Date.now();
  const domain = normalizeDomain(domainInput);
  const base = { domain: domain ?? String(domainInput), checked_at: new Date(now).toISOString(), checker: `open-bounty-check ${VERSION}` };
  if (!domain) return { ...base, status: 'unknown', ok: false, reason: 'not a domain', carriers: {} };

  const schema = await loadSchema(fetchFn, schemaUrl, userAgent);
  // Not a fact about the store: a caller (the hosted /check) shouldn't cache it.
  if (!schema) return { ...base, status: 'unknown', ok: false, schema_unavailable: true, reason: `the schema at ${schemaUrl} could not be fetched, so nothing could be validated`, carriers: {} };

  const carriers = {};
  // §4 step 1
  carriers.well_known = await objectCarrier(fetchFn, `https://${domain}/.well-known/bounty.json`, schema, userAgent);
  // §4 step 2 (always checked, so every carrier is reported, not only the first hit)
  const home = await get(fetchFn, `https://${domain}/`, MAX_HTML, 'text/html', userAgent, true);
  const href = home.status === 200 ? findBountyLink(text(home.bytes)) : null;
  carriers.link = href
    ? { href, ...(await objectCarrier(fetchFn, new URL(href, home.url).toString(), schema, userAgent)) }
    : { present: false, pass: false, http: home.status || null, note: home.status === 200 ? 'not published (no <link rel="bounty"> in <head>)' : `home page: ${home.note || `HTTP ${home.status}`}` };

  const found = carriers.well_known.pass ? ['well-known', carriers.well_known]
    : carriers.link.pass ? ['link', carriers.link] : null;

  if (options.product) {
    const p = await get(fetchFn, options.product, MAX_HTML, 'text/html', userAgent);
    const sameStore = normalizeDomain(p.url) === domain;
    const html = p.status === 200 && sameStore ? text(p.bytes) : '';
    const expected = found ? displayOf(found[1].object) : null;
    const ld = html ? findOfferProperty(html) : null;
    const vis = html ? findVisibleStatement(html) : null;
    carriers.json_ld = !html ? { present: false, pass: false, note: sameStore ? `product page: HTTP ${p.status}` : 'product page is on another domain' }
      : { present: ld !== null, pass: ld !== null && (!expected || ld === expected), value: ld, ...(ld === null ? { note: 'no bounty PropertyValue in the Offer' } : ld !== expected && expected ? { note: 'differs from earn.display' } : {}) };
    carriers.visible = !html ? { present: false, pass: false, note: carriers.json_ld.note }
      : { present: Boolean(vis), pass: Boolean(vis) && (!expected || vis.text.includes(expected)), ...(vis ? { label: vis.label, text: vis.text } : { note: 'no element with data-bounty-display and aria-label' }), ...(vis && expected && !vis.text.includes(expected) ? { note: 'does not contain earn.display verbatim' } : {}) };
  }

  const signatureFailed = [carriers.well_known, carriers.link].some((c) => c.signature?.outcome === 'invalid');
  if (!found) {
    const anything = [carriers.well_known, carriers.link].some((c) => c.object || c.errors);
    return {
      ...base,
      status: anything || signatureFailed ? 'invalid' : 'unknown',
      ok: false,
      reason: signatureFailed ? 'a signature failed: a hard stop (spec §9)' : anything ? 'objects were found, but none is valid' : 'nothing is published: unknown, not "no"',
      schema: { id: schema.$id ?? schemaUrl },
      carriers: strip(carriers),
    };
  }

  const [via, hit] = found;
  const obj = hit.object;
  return {
    ...base,
    status: 'valid',
    ok: true,
    found_at: via,
    object_url: hit.url,
    earn_display: displayOf(obj),
    program: obj.program,
    active: obj.active === true && inWindow(obj, now),
    signature: hit.signature,
    schema: { id: schema.$id ?? schemaUrl, object_version: obj.bounty_schema_version },
    carriers: strip(carriers),
    object: obj,
  };
}

/** Per-carrier report without the full object (the found object is returned once, at the top). */
function strip(carriers) {
  return Object.fromEntries(Object.entries(carriers).map(([k, v]) => {
    const { object, ...rest } = v;
    return [k, rest];
  }));
}

/** Exit code for a result: 0 valid, 1 invalid, 2 unknown. */
export const exitCode = (r) => (r.status === 'valid' ? 0 : r.status === 'invalid' ? 1 : 2);
