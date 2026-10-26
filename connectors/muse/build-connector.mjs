// Writes connector.json from the hosted connector's own tools/list, so the
// published definition and the server that answers it can't drift apart.
//   node connectors/muse/build-connector.mjs
//
// The hosted instance (https://api.nctr.live/mcp/bounty) has two read-only
// tools: get_bounty, which reads any store's own declaration, and
// search_stores, which searches the Bounty index. The self-host template in
// server/ serves get_bounty only: search_stores reads the hosted index.
import { writeFileSync } from 'node:fs';

const ENDPOINT = 'https://api.nctr.live/mcp/bounty';

async function rpc(method, params, session) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', ...(session ? { 'Mcp-Session-Id': session } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const body = JSON.parse((await res.text()).replace(/^event: message\ndata: /, '').trim());
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return { result: body.result, session: res.headers.get('mcp-session-id') };
}

const init = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'build-connector', version: '1' } });
const { result: { tools } } = await rpc('tools/list', {}, init.session);

const connector = {
  $comment: 'Bounty connector definition. Muse publishes no file format for connectors; this holds what its connector guidelines and submission form ask for (endpoint, authentication, scopes, credentials, tool documentation with each tool classified), in one place. Generated from the hosted connector\'s tools/list by build-connector.mjs.',
  name: 'Bounty',
  summary: 'Tells a shopper what a purchase at a store earns, from the store\'s own published declaration, and finds stores where a purchase earns.',
  description: 'Bounty reads any store\'s Open Bounty Schema declaration: the small public object a store publishes at /.well-known/bounty.json, or points to with <link rel="bounty">, saying what a purchase earns the shopper (points, store credit, tokens or perks). get_bounty returns the store\'s own sentence, exactly as published, the resolved object, and whether it is signed; a store that publishes nothing is reported as unknown, never as "no". search_stores searches the Bounty index of 6,000+ stores where a purchase earns. The index is an open registry any store can enter by publishing a declaration.',
  mcp: {
    url: ENDPOINT,
    transport: 'streamable-http',
    protocol_version: init.result.protocolVersion,
    self_host: 'https://github.com/Hoya25/open-bounty-schema/tree/main/connectors/muse/server',
    self_host_note: 'The self-host template serves get_bounty only; search_stores reads the hosted index.'
  },
  api: { openapi: 'https://github.com/Hoya25/open-bounty-schema/blob/main/connectors/muse/openapi.json' },
  authentication: { type: 'none', scopes: [], credentials: 'none', environment: 'production' },
  data: {
    reads: 'get_bounty: a store\'s own public declaration (/.well-known/bounty.json or its rel="bounty" link target), its home page head, and, if a product URL is given, that product page. search_stores: the Bounty index.',
    writes: 'Nothing on anyone\'s behalf. A store whose own declaration checks valid is recorded in the open registry (its domain and the public fields of its declaration), so search_stores can find it.',
    personal_data: 'None. The inputs are a store domain, a product URL or a search keyword; nothing about the person asking is received or stored.',
    retention: 'Check results are cached for 5 minutes per store. Registry entries lapse after 90 days without a fresh valid check. No request logs.',
    privacy_policy: 'https://api.nctr.live/privacy'
  },
  tools: tools.map((t) => ({ ...t, classification: t.annotations?.readOnlyHint ? 'read' : 'write' })),
  license: 'CC0-1.0'
};
writeFileSync(new URL('./connector.json', import.meta.url), JSON.stringify(connector, null, 2) + '\n');
console.log(`wrote connector.json: ${connector.tools.map((t) => `${t.name} (${t.classification})`).join(', ')}`);
