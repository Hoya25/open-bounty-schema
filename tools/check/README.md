# open-bounty-check

Check any store's [Open Bounty Schema](https://github.com/Hoya25/open-bounty-schema) declaration,
the way a conforming agent reads it.

Run it straight from GitHub; nothing is published to the npm registry:

```sh
npx github:Hoya25/open-bounty-schema shop.example
npx github:Hoya25/open-bounty-schema shop.example --product https://shop.example/products/some-product
npx github:Hoya25/open-bounty-schema shop.example --json
```

npm installs the repository and runs its `open-bounty-check` command, which is this package. To
pin a version, add a commit: `npx github:Hoya25/open-bounty-schema#<commit> shop.example`. From
a checkout, `node tools/check/bin/open-bounty-check.js shop.example` does the same.

For each store it:

1. runs the spec's **§4 discovery walk**: `/.well-known/bounty.json`, then `<link rel="bounty">`
   in the home page's `<head>`;
2. **validates** what it finds against the live schema (the stable alias,
   `https://api.nctr.live/schema/bounty/v1.json`, or `--schema <URL>`);
3. **verifies a signature** when the response carries one (§9: a detached JWS in
   `Bounty-Signature`, keys at the object's own origin, `/.well-known/bounty-keys.json`);
4. with `--product`, checks the product-page carriers: the JSON-LD `Offer` property (§2c) and the
   visible labeled statement (§2e). Both must carry `earn.display` verbatim.

It prints PASS or FAIL for each carrier, plus the `earn.display` sentence. A carrier the store
doesn't publish shows as `—`, not FAIL: a Shopify store can't serve `/.well-known/`, so it
publishes through the link alone.

| Exit code | Status | Means |
|---|---|---|
| `0` | `valid` | A valid object was found. Only this exits 0 |
| `1` | `invalid` | Objects were found but none is valid, or a signature failed (a hard stop, §9) |
| `2` | `unknown` | Nothing is published. Unknown, never "no" |

`--json` prints the full result, including each carrier's details and the resolved object.

## As a library

```js
import { check } from 'open-bounty-check';
const result = await check('shop.example', { product: 'https://shop.example/products/x' });
```

The code uses only `fetch`, WebCrypto and an interpreting JSON Schema validator, so it runs in
Node 20 and later and in Cloudflare Workers. The hosted checker at `https://api.nctr.live/check`
runs this same code.

License: CC0-1.0.
