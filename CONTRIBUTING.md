# Contributing

The Open Bounty Schema is CC0. Anyone may implement it, fork it or propose changes to it.

## What gets added

**A field needs a real program that needs it.** Open an issue that names:
- the program (a live store, loyalty provider, index or token);
- what an agent can't say truthfully about it today;
- the field you'd add, and what an agent does with it.

A field with no live program behind it waits.

The schema stays small on purpose. Before proposing a field, check whether it can be:
- a sentence in an existing `note`;
- an entry in an open vocabulary: `eligibility.who`, `conditions[].type`, `fulfills`;
- a link (`api`, `tokens`) rather than an embedded copy.

## Rules every change keeps

- **Additive within 0.x.** An object valid under an earlier 0.x stays valid. A new field is
  optional. Changing what a field means waits for 1.x.
- **Display over math.** No rate fields. A program states its value in a sentence that an agent
  quotes.
- **Closed only where an agent decides on the value.** These are closed: `earn.type`, `scope`,
  `listed_by`, the three unlock and perk states, `ladder.basis`, and `verification.method`.
  Everything else that names something programs differ on is an open vocabulary validated by
  pattern: symbols, rungs, `who`, condition types, goal tags.
- **Absent means not stated**, never "no" or "none".
- **Claims must survive scrutiny.** If an example or a rule would make an untruthful object easy
  to publish, it's a bug.

## Making the change

1. Branch `spec/v0.N` from `main`.
2. Change `schema/bounty.schema.json` (or `schema/token.schema.json`), then `SPEC.md`, and add
   the version to `CHANGELOG.md`.
3. Add at least one example in `examples/` using the new field.
4. In `validate.mjs`, add a case the schema must **reject** and one it must **accept**, and keep
   the check that every earlier example still validates unchanged.
5. `npm install && npm test`. Every check passes, or nothing merges.
6. Bump `package.json` to `0.N.0` and open a pull request.

## After a merge (reference implementation)

The stable alias is served from the NCTR Alliance Registry (`api.nctr.live`), which vendors the
schema. The Registry's tests compare its copy with `main`. A new version reaches readers in three
steps:
1. The Registry deploys the new schema, with any objects that use the new fields still switched
   off.
2. The cached alias is purged at the edge, which otherwise holds it for up to six hours.
3. The objects that use the new fields are switched on.

That order means no validator holding the old alias ever meets a field it would reject.
