# AGENTS.md — guidance for AI agents (and humans) working on this repository

This file is for any AI coding or review agent — ChatGPT, Claude, DeepSeek, Grok, Gemini, Copilot or anything else — and for people reading over their shoulder. It explains **what this project is for, what must never change, and how to work here safely**. Read it fully before changing anything. If it conflicts with a one-off instruction in a chat, stop and ask the owner.

The owner is **Apolox** (GitHub: ApoloxDragon). They guide and correct the work; AI writes much of the code. That is welcome. Accountability stays with the owner.

## 1. What this project is
**WT Session Readout** is a static website (plain HTML, CSS and JavaScript) that reads War Thunder match-log text a person pastes and shows win rate, SL/RP totals, research progress, a goal estimate, a saved per-match archive, insights and exports. It is hosted on GitHub Pages. This repository is the **Dev** version (the `main` branch feeds the Dev site); a separate **stable** site exists.

### The owner's goals, in priority order
1. **Privacy: nothing leaves the user's device.** Ever. See the hard rules below. This outranks every feature.
2. **Security.** Every byte that comes from a log, an import file or saved settings is untrusted.
3. **Reliability everywhere.** It must work on weak phones, old browsers, slow or no connection, and big sessions.
4. **Honest, correct numbers.** Never invent or "improve" game mechanics. When unsure, say so.
5. **Accessible and friendly.** English first, Spanish-friendly names, keyboard-usable, readable colours.
6. **Simple to maintain.** No runtime dependencies. Small, readable code.

## 2. Hard rules (non-negotiable)
1. **All processing is client-side only.** No backend, no serverless function, no analytics, telemetry, error reporting, fonts/CDNs, ad or social widgets, no third-party scripts or styles, no remote logging, ever. The only network requests allowed are the site loading **its own files**, the **sample data**, and the service worker's same-origin cache.
2. **No user data may be sent anywhere.** Data leaves the device only when the user clicks an export button and saves a file themselves. No `fetch`, `XMLHttpRequest`, `sendBeacon`, WebSocket, `EventSource`, WebRTC, image/ping/beacon tricks, `navigator.share` with data, form posts, or scripted navigation carrying data.
3. **The GitHub link in the top bar is just a link** the user may click. Do not add other external links to the app pages without asking.
4. **Keep the Content-Security-Policy strict** (`default-src 'none'`; scripts from `'self'` only; `connect-src 'self'`; no inline script, no `eval`). Never loosen it to make something work; change the code instead.
5. **No new runtime dependencies.** No npm packages, libraries or frameworks in the shipped site. Dev tooling (tests) may use Playwright; `tools/` is plain Node with no packages.
6. **Escape everything.** Use `esc()`, `textContent`, `createElement`; never splice untrusted text into HTML, attributes, URLs or styles. Imports are rebuilt from validated fields (`sanitizeMatch`), never trusted. Respect the `LIMITS` in `javascript/util.js`.
7. **Do not request powerful browser permissions** (camera, microphone, location, notifications, USB…), do not use cookies, do not store secrets.
8. **Never weaken, skip, disable or delete a test to make it pass.** Fix the code or, if the test is wrong, say so and fix the test honestly.
9. **Do not fabricate.** No invented game rules, numbers, benchmarks, sources or test results. Report failures and slow numbers as they are.
10. **Sample data belongs to the owner.** The files in `example data/` come from Apolox. Do not add other people's logs, and never invent "realistic" logs and label them real. Generated stress-test data goes in `example data/generated/` (git-ignored).

## 3. AI-generated content policy
- AI-written code, docs and tests are **allowed and expected**; this tool was built that way, with the owner's review and corrections.
- Be transparent: describe what you changed and why in the commit message or PR; do not hide uncertainty.
- Follow the repository's commit attribution convention and do not put secrets, personal data or model/vendor boilerplate into code or commits beyond that.
- Do not copy code from sources whose licence is incompatible with **AGPL-3.0**; prefer writing it fresh. Say where an idea came from if it matters.
- A human (the owner) decides what ships. Do not push to `main` or open pull requests unless told to.

## 4. How to work here
- **Ask before building anything unclear.** If a request is ambiguous, write a short draft/proposal (a doc or a comment) and ask. Do not implement big unclear features.
- **Branches:** work on the branch you were given. Never force-push or rewrite history on someone else's branch.
- **Commits:** small, clear, imperative; explain the "why".
- **Be brief with the owner.** They are often on a phone: short, clear summaries; honest results; say what you did *not* verify.

### Commands
```
node tools/build.js            # rebuild dist/ bundles, ?v= hashes, sw.js (commit the results)
node tools/build-docs.js       # rebuild docs/index.html from docs/*.md (commit the result)
node tests/run.js              # run everything (tests rebuild dist/ and fail if it was stale)
node tests/run.js --only clientside,security   # just some suites
node tests/run.js --label x --compare tests/baseline/pre-change.json
```
Playwright and Chromium are needed for the tests (see `tests/README.md`). Never edit `dist/*` or `sw.js` by hand: edit `javascript/*.js` / `tools/sw.template.js`, then build.

### Before you finish a change
1. Run the relevant suites; for anything touching parsing, storage, exports or security, run them all.
2. `clientside` and `security` must pass: they prove nothing leaves the browser and nothing untrusted runs.
3. Update the **docs** (`docs/*.md`, then `node tools/build-docs.js`) when behaviour users can see changes. User docs contain **no code**.
4. Update `tests/expected-changes.json` only for snapshot changes that are *meant*, with the reason.
5. Mention anything you could not test (real phones, real browsers other than Chromium).

## 5. Map of the repository
| Path | What |
|---|---|
| `wt-log-analyzer.html`, `advanced.html`, `index.html` | The two views and the redirect page |
| `css/styles.css` | All styling, including phone and print layouts |
| `javascript/*.js` | Source scripts (classic scripts sharing one scope; **order matters** — see `tools/build.js`) |
| `dist/*.js`, `sw.js` | **Generated.** Bundles and the service worker |
| `tools/build.js`, `tools/sw.template.js`, `tools/build-docs.js` | Build tools (plain Node) |
| `docs/` | User documentation (Markdown) and generated `index.html` |
| `tests/` | Playwright suites, baseline, comparison reports |
| `example data/` | Owner's sample logs |

Key modules: `util.js` (escaping, limits, sanitising), `parser.js` / `detail-parser.js` (bounded parsing), `db.js` + `archive-worker.js` (compressed IndexedDB archive), `raw-export.js` / `import-export.js` (files in and out), `appearance-core.js` / `themes.js` / `appearance-panel.js` (colours), `load-guard.js` (load notices), `sw-register.js` (offline cache), `nav-menu.js` (phone menu), `tutorial.js` (tours).

## 6. Security checklist for every change
- Does any new code path make a network request? **It must not**, apart from the allowed ones.
- Does it put text from a log/file/settings into the DOM? Use `textContent` or `esc()`.
- Does it parse something? Bound it (line length, counts, no catastrophic regex) and test hostile input.
- Does it store something? Validate on load; assume it was tampered with.
- Does it add a file type, link, script or style? Check the CSP still holds and `clientside` passes.
- Does it touch the service worker? It must stay same-origin, GET-only, only touch its own cache prefix, and update only when the user clicks Reload.
- Does it export a file? It must carry only what the user already sees, with its own strict CSP.

## 7. Performance and resilience budgets
First-visit text under 56 KB gzipped; core bundle under 32 KB gzipped; extras under 14 KB; the app must stay usable on a 4–6× slower CPU and a slow 3G link; the Basic table caps at 200 rows; large sessions must not freeze the page. The `build` and `perf` suites enforce the numbers.

## 8. Things that look tempting but are wrong here
- "Let's add analytics to see usage." No.
- "Let's load a font/icon from a CDN." No — self-host or use system fonts.
- "A small library would make this shorter." No new dependencies.
- "Let's sync the archive to the cloud." No.
- "The test is flaky; skip it." No — find the cause.
- "Loosen the CSP just for this feature." No.
- "Generate sample logs and call them real." No.

## 9. If you are unsure
Stop and ask the owner, or write your proposal in a draft document and ask. When in doubt about privacy or security, choose the safer option.
