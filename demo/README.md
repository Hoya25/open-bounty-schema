# Demo store: bounty-demo.pages.dev

[`bounty-demo/`](bounty-demo/) is **Example Athletics**, an obviously fictional store at
https://bounty-demo.pages.dev that publishes an Open Bounty Schema declaration on every carrier the
spec defines, so reviewers and implementers can see a store-declared object work end to end:

- `/.well-known/bounty.json`: [`examples/points-program-tiers.json`](../examples/points-program-tiers.json),
  with its `athletics.example.com` links pointed at the demo page's own sections;
- `<link rel="bounty">` in the home page head;
- JSON-LD: a `bounty` `PropertyValue` in a sample product's `Offer`;
- the visible "Rewards on this purchase" statement (`data-bounty-display`).

Nothing is for sale, and the page says so. Deploy: `wrangler pages deploy demo/bounty-demo --project-name bounty-demo --branch main`.
Check: `https://api.nctr.live/check?domain=bounty-demo.pages.dev`.
