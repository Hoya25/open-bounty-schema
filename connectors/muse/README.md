# Bounty for Muse: connector template

A connector that lets Meta's Muse agent, or any MCP client, answer **"do I earn anything buying
here?"** for any store, from the store's own published Open Bounty Schema declaration.

It has one action, **`get_bounty(domain)`**, and it is read-only. The action:
- runs the spec's discovery walk on the store's own domain: `/.well-known/bounty.json`, then
  `<link rel="bounty">`;
- validates what it finds against the live schema, and verifies a signature when present;
- returns the **resolved object** and its **`earn.display` sentence**, to show verbatim.

**Any store, any program.** The connector reads what a store publishes itself; it isn't a lookup in
an index. A store that publishes nothing comes back as `unknown`, never "no".

The hosted instance also has a second read-only action, **`search_stores(query)`**: up to 10
stores from the Bounty index of 6,000+ stores where a purchase earns. The index is an open registry
any store can enter by publishing a declaration: a store whose own declaration checks valid is
added, beside the NCTR Alliance listings, and every result's `listed_by` says who published it. The
self-host template below serves `get_bounty` only.

| File | What it is |
|---|---|
| [`connector.json`](connector.json) | The connector definition: endpoint, authentication (none), data use, and both tools (`get_bounty`, `search_stores`) with their descriptions, input and output schemas, annotations, and classification (read). Generated from the hosted connector's `tools/list` by `build-connector.mjs`, so the two can't drift |
| [`openapi.json`](openapi.json) | The same action as an HTTP API (`GET /check?domain=`), for platforms that build a connector from API documentation |
| [`server/`](server/) | The MCP server (Streamable HTTP), as a template you can host yourself. It runs on Cloudflare Workers, or anywhere with `fetch` and WebCrypto |

## The endpoint

A hosted instance is live:

```
MCP (Streamable HTTP):  https://api.nctr.live/mcp/bounty
HTTP API:               https://api.nctr.live/check?domain=<domain>
```

No authentication: the connector reads only public, published data. Results are cached for 5
minutes per store, and each address is rate-limited. To run your own copy instead, see
[Host it yourself](#host-it-yourself).

## Publish it in Muse

**What Meta's guidelines say** (Muse connector guidelines,
[platform.muse.ai/docs](https://platform.muse.ai/docs)), and how this connector meets each point:

- **"Tool descriptions must be factual."** `get_bounty`'s description says what it reads, what it
  returns and that it changes nothing. It also says plainly that "unknown" isn't "no".
- **Tools are classified as Read, Write or Sensitive write, and "a tool that combines reads and
  writes must be classified as a write."** `get_bounty` only reads: classification `read`,
  annotations `readOnlyHint: true` and `destructiveHint: false`. Until the portal lets you classify
  tools, the guidelines say to put the classification in your tool documentation, which is
  `connector.json`.
- **Submitting to the directory** goes through Meta's submission form. It covers:

  | The form asks for | Answer for Bounty |
  |---|---|
  | Connector overview | `connector.json` → `name`, `summary`, `description` |
  | Business verification | Yours: whoever submits the connector |
  | Data processing questionnaire | `connector.json` → `data`: reads public declarations only, writes nothing, no personal data, a 5-minute cache |
  | "The endpoint, authentication setup, requested scopes, and credentials Muse needs" | Endpoint `https://api.nctr.live/mcp/bounty` (or your own); authentication none; scopes none; credentials none; production |
  | Tool documentation | `connector.json` → `tools` (also served live by `tools/list`) |
  | Test account | Not needed: there's no account. Test with `merch.nctr.live` (declared, found through the link, signed) and `allbirds.com` (publishes nothing: unknown) |

  Review has three stages (risk assessment, tool review, end-to-end QA), and approval isn't
  guaranteed. Approved connectors are discoverable by Muse and appear under Settings → Connectors.

**A personal custom connector** (not reviewed, only for your own account). Meta's guidelines page
doesn't describe this path. Third-party guides report that you ask Muse, in a conversation, to
create a connector and give it an MCP server URL or API documentation. For example:

> Create a connector called Bounty using the MCP server at https://api.nctr.live/mcp/bounty

Or point it at `openapi.json` instead. Treat that flow as reported, not documented, and check it in
Muse itself.

## Host it yourself

```sh
git clone https://github.com/Hoya25/open-bounty-schema && cd open-bounty-schema
npm install                      # the checker's one dependency
cd connectors/muse/server
npm test                         # offline: transport, the one tool, get_bounty results
npx wrangler deploy              # your endpoint: https://<your worker>/mcp
```

Then regenerate `connector.json` with your URL in `mcp.url` (`node ../build-connector.mjs`, after
editing the URL in `build-connector.mjs`). Outside Cloudflare, import `handle(request)` from
`server/src/index.js` into any runtime with `fetch` and WebCrypto.

## Try it

```sh
curl -s https://api.nctr.live/mcp/bounty \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_bounty","arguments":{"domain":"merch.nctr.live"}}}'
```

The result's `structuredContent` carries `status` (`valid`, `invalid` or `unknown`), `earn_display`,
`object`, `found_at` and `signature`. The same JSON is also in `content[0].text`, for clients that
read text.

## What an agent should do with the result

- **`valid`:** quote `earn_display` word for word, and name the program. Compute nothing from it.
- **`unknown`:** say the store doesn't publish a rewards declaration. Never say it has no rewards.
- **`invalid`:** say the declaration couldn't be confirmed. If `reason` says a signature failed,
  use nothing from the object.
- **v0.6 fields** (`eligibility`, `conditions`, `valid_until`) are in `object`. Show their notes as
  written when stating the bounty.

License: CC0-1.0.
