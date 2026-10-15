// Writes connector.json from the server template's tool definition, so the
// published definition and the code that answers it can't drift apart.
//   node connectors/muse/build-connector.mjs
import { writeFileSync } from 'node:fs';
import { GET_BOUNTY, PROTOCOL_VERSION } from './server/src/index.js';

const connector = {
  $comment: 'Bounty connector definition. Muse publishes no file format for connectors; this holds what its connector guidelines and submission form ask for (endpoint, authentication, scopes, credentials, tool documentation with each tool classified), in one place. Regenerate with build-connector.mjs.',
  name: 'Bounty',
  summary: "Tells a shopper whether buying at a store pays them a reward, from the store's own published declaration.",
  description: "Bounty reads any store's Open Bounty Schema declaration: the small public object a store publishes at /.well-known/bounty.json, or points to with <link rel=\"bounty\">, saying what a purchase pays the shopper (points, credit, tokens or cash). It returns the store's own sentence to show verbatim, the resolved object, and whether it is signed. A store that publishes nothing is reported as unknown, never as \"no\".",
  mcp: {
    url: 'https://api.nctr.live/mcp/bounty',
    transport: 'streamable-http',
    protocol_version: PROTOCOL_VERSION,
    self_host: 'https://github.com/Hoya25/open-bounty-schema/tree/main/connectors/muse/server'
  },
  api: { openapi: 'https://github.com/Hoya25/open-bounty-schema/blob/main/connectors/muse/openapi.json' },
  authentication: { type: 'none', scopes: [], credentials: 'none', environment: 'production' },
  data: {
    reads: "A store's own public declaration (/.well-known/bounty.json or its rel=\"bounty\" link target), its home page head, and, if a product URL is given, that product page.",
    writes: 'Nothing.',
    personal_data: 'None. The input is a store domain; the output is that store\'s public declaration.',
    retention: 'Results are cached for 5 minutes per store. Nothing about the person asking is stored.'
  },
  tools: [{ ...GET_BOUNTY, classification: 'read' }],
  license: 'CC0-1.0'
};
writeFileSync(new URL('./connector.json', import.meta.url), JSON.stringify(connector, null, 2) + '\n');
console.log('wrote connector.json');
