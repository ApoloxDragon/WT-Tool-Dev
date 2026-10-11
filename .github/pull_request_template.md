## What changed and why
<!-- A few plain sentences. -->

## Checklist
- [ ] Everything still runs **client-side only**: no new network request, tracker, CDN, font, script or dependency (the `clientside` suite passes)
- [ ] Anything from a log, file or saved setting is escaped / validated; limits respected (the `security` suite passes)
- [ ] Content-Security-Policy not loosened
- [ ] `node tools/build.js` and (if docs changed) `node tools/build-docs.js` run and the results committed
- [ ] Tests run; no test skipped, disabled or weakened; any intended snapshot change is explained in `tests/expected-changes.json`
- [ ] User docs updated if visible behaviour changed (no code in user docs)
- [ ] AI assistance (if any) described; code is compatible with AGPL-3.0
- [ ] Sample data, if added, is my own or I have permission

## What I could not test
<!-- Real devices, other browsers, etc. -->
