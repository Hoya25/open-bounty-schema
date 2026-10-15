// The Bounty MCP server template, offline: transport, one read-only tool, get_bounty results.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle, GET_BOUNTY } from '../src/index.js';

const SCHEMA = JSON.parse(readFileSync(new URL('../../../../schema/bounty.schema.json', import.meta.url), 'utf8'));
const OBJ = { bounty_schema_version: '0.6', active: true, program: { name: 'Example Outfitters', url: 'https://shop.example/' }, earn: { display: 'Members earn 1 point per dollar, redeemable at checkout.' }, updated_at: '2026-10-15' };
const fetchMock = async (url) => {
  const res = (status, body) => { const r = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }); Object.defineProperty(r, 'url', { value: url }); return r; };
  if (url === 'https://schema.test/v1.json') return res(200, SCHEMA);
  if (url === 'https://shop.example/.well-known/bounty.json') return res(200, OBJ);
  return res(404, 'not found');
};
const opts = { fetch: fetchMock, schemaUrl: 'https://schema.test/v1.json' };
const rpc = (body, accept = 'application/json, text/event-stream') => new Request('https://bounty.test/mcp', { method: 'POST', headers: { Accept: accept, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...body }) });
const read = async (res) => JSON.parse((await res.text()).split('data: ')[1]);

test('initialize and tools/list: one tool, read-only', async () => {
  assert.equal((await read(await handle(rpc({ method: 'initialize', params: {} }), opts))).result.serverInfo.name, 'bounty');
  const tools = (await read(await handle(rpc({ method: 'tools/list' }), opts))).result.tools;
  assert.deepEqual(tools.map((t) => t.name), ['get_bounty']);
  assert.equal(tools[0].annotations.readOnlyHint, true);
});

test('get_bounty returns the resolved object and earn.display', async () => {
  const s = (await read(await handle(rpc({ method: 'tools/call', params: { name: 'get_bounty', arguments: { domain: 'shop.example' } } }), opts))).result.structuredContent;
  assert.equal(s.status, 'valid');
  assert.equal(s.earn_display, OBJ.earn.display);
  assert.deepEqual(s.object, OBJ);
});

test('nothing published or a bad domain: unknown with a reason, never "no"', async () => {
  for (const domain of ['empty.example', '10.0.0.1', 'localhost']) {
    const s = (await read(await handle(rpc({ method: 'tools/call', params: { name: 'get_bounty', arguments: { domain } } }), opts))).result.structuredContent;
    assert.equal(s.status, 'unknown', domain);
    assert.ok(s.reason, domain);
  }
});

test('transport: POST only, both Accept types', async () => {
  assert.equal((await handle(new Request('https://bounty.test/mcp'), opts)).status, 405);
  assert.equal((await handle(rpc({ method: 'tools/list' }, 'application/json'), opts)).status, 406);
});

test('the template and the hosted endpoint describe the same tool', () => {
  assert.equal(GET_BOUNTY.name, 'get_bounty');
  assert.deepEqual(GET_BOUNTY.inputSchema.required, ['domain']);
});

test('connector.json is generated from this tool (no drift)', () => {
  const c = JSON.parse(readFileSync(new URL('../../connector.json', import.meta.url), 'utf8'));
  assert.deepEqual(c.tools, [{ ...GET_BOUNTY, classification: 'read' }]);
});
