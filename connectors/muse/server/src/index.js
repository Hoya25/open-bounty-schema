/**
 * Bounty — a one-tool MCP server (Streamable HTTP) for agent connectors such
 * as Meta's Muse. Self-hostable template: deploy it as a Cloudflare Worker, or
 * import `handle` into any runtime with fetch and WebCrypto.
 *
 * One read-only action, get_bounty(domain): runs the Open Bounty Schema
 * discovery walk against the store's own domain (its /.well-known/bounty.json,
 * or the object its <link rel="bounty"> points to), validates it against the
 * live schema, verifies a signature when present, and returns the resolved
 * object and its earn.display sentence. Any store, any program: nothing here
 * looks a store up in an index.
 *
 * The checking code is open-bounty-check (open-bounty-schema/tools/check).
 */

import { check, normalizeDomain } from '../../../../tools/check/lib/check.js';

export const PROTOCOL_VERSION = '2025-06-18';

export const GET_BOUNTY = {
  name: 'get_bounty',
  title: "Get a store's bounty",
  description:
    "Read whether buying at a store pays the shopper a reward, from the store's own published Open Bounty Schema " +
    'declaration (its /.well-known/bounty.json, or the object its <link rel="bounty"> points to). Returns status ' +
    '(valid, invalid or unknown), the earn.display sentence to show verbatim, the resolved object, where it was found, ' +
    'and whether it is signed. "unknown" means the store publishes nothing; it does not mean purchases earn nothing. ' +
    'Read-only: it changes nothing anywhere.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: "The store's domain, e.g. shop.example" },
      product: { type: 'string', description: 'Optional: an https product page URL on that domain, to check the product-page carriers too' }
    },
    required: ['domain'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['valid', 'invalid', 'unknown'] },
      earn_display: { type: 'string' },
      object: { type: 'object' },
      found_at: { type: 'string' },
      signature: { type: 'object' },
      reason: { type: 'string' }
    },
    required: ['status']
  },
  annotations: { title: "Get a store's bounty", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

const SSE = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' };
const sse = (payload) => new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, { status: 200, headers: SSE });
const plain = (status, message) => new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }), { status, headers: { 'Content-Type': 'application/json' } });

export async function getBounty(args, options = {}) {
  const domain = normalizeDomain(args?.domain);
  if (!domain) return { status: 'unknown', reason: "not a store's public hostname (e.g. shop.example)" };
  let product;
  if (args?.product) {
    try {
      const u = new URL(String(args.product));
      if (u.protocol !== 'https:' || normalizeDomain(u.hostname) !== domain) throw new Error();
      product = u.toString();
    } catch {
      return { status: 'unknown', reason: 'product must be an https URL on the same domain' };
    }
  }
  return check(domain, { product, ...options });
}

/** The MCP endpoint. POST only; the client must accept both JSON and SSE. */
export async function handle(request, options = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version' } });
  }
  if (request.method !== 'POST') return plain(405, 'Method Not Allowed: use POST');
  const accept = (request.headers.get('Accept') || '').toLowerCase();
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
    return plain(406, 'Not Acceptable: Client must accept both application/json and text/event-stream');
  }
  let msg;
  try { msg = await request.json(); } catch { return sse({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  const { id, method, params } = msg || {};
  switch (method) {
    case 'initialize':
      return sse({ jsonrpc: '2.0', id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'bounty', title: 'Bounty', version: '0.6.0' } } });
    case 'notifications/initialized':
      return new Response(null, { status: 202, headers: { 'Access-Control-Allow-Origin': '*' } });
    case 'ping':
      return sse({ jsonrpc: '2.0', id, result: {} });
    case 'tools/list':
      return sse({ jsonrpc: '2.0', id, result: { tools: [GET_BOUNTY] } });
    case 'tools/call': {
      if (params?.name !== 'get_bounty') return sse({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${params?.name}` } });
      try {
        const result = await getBounty(params.arguments || {}, options);
        return sse({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result } });
      } catch {
        return sse({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '{"error":"tool_failed"}' }], isError: true } });
      }
    }
    default:
      return sse({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

/** Cloudflare Worker entry: the MCP endpoint at /mcp. */
export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/mcp') return handle(request);
    return new Response('Bounty MCP server: POST /mcp', { status: 404 });
  }
};
