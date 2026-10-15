# Contributing

Thanks for helping. This is a small hobby project run by **Apolox**, written largely with AI under their guidance. People and AI assistants are both welcome to contribute, under the same rules.

**AI assistants: read [AGENTS.md](AGENTS.md) first.** It is the detailed guide.

## The rules in one minute
1. **Everything stays client-side.** No server, no analytics or tracking, no third-party scripts, fonts or CDNs, no data sent anywhere. The only requests allowed are the site's own files and the sample data. Users' data leaves their device only when they save an export themselves.
2. **Untrusted text stays text.** Escape or build plain text for anything from a log, an import or saved settings; keep size limits and bounded parsing.
3. **Keep the Content-Security-Policy strict.** Don't loosen it to make something work.
4. **No new runtime dependencies.**
5. **Never skip, disable or weaken a test.** Fix the code (or the test, honestly).
6. **No invented facts** — game rules, numbers, sources or results.
7. **Ask first** if something is unclear; propose in a draft instead of building it.

## AI-generated contributions
Welcome. Say so in the pull request, describe what was done and what was *not* tested, and make sure the code is compatible with the AGPL-3.0 licence. The owner reviews and decides what ships.

## Sample data
The files in `example data/` are the owner's. Only add data that is your own (or that you have clear permission to share), with nothing private in it. Never present invented logs as real.

## Making a change
```
node tools/build.js          # after editing javascript/ or css/ or the pages: rebuild dist/ and sw.js
node tools/build-docs.js     # after editing docs/*.md: rebuild docs/index.html
node tests/run.js            # run the suites (see tests/README.md)
```
Commit the generated files together with your change. Update the user docs in `docs/` when visible behaviour changes (no code in user docs).

## Security issues
Please report privately: see [SECURITY.md](SECURITY.md).

## Licence
By contributing you agree your work is licensed under the project's AGPL-3.0 licence.
