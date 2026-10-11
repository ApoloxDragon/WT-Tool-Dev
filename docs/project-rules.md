# Project rules

These are the rules the project holds itself to. They matter to everyone who uses the site, and to anyone — person or AI — who changes it. The version for contributors and AI agents is the file **AGENTS.md** in the repository's top folder.

## Rule 1: everything stays client-side
- **All processing happens in your browser.** Reading your logs, counting, compressing, saving, colours, exports — all of it.
- **Nothing leaves your device**, unless **you** click an export button and save a file yourself.
- There is **no server that receives your data**, no account, no analytics, no tracking, no third-party scripts, fonts or widgets, no remote error reports.
- The only network traffic is the site loading **its own files**, the **sample data**, and the offline copy being refreshed.
- The **GitHub logo** in the top bar is just a link. It does nothing until you click it, and it exists so you can go and look at the source.

This is a rule, not a current coincidence: any change that would break it is rejected. It is also **tested automatically**: a test uses both views for real (pasting, exporting, importing, colours, tours) and fails if the browser makes a single request to anywhere else, and other tests fail if the code could reach another site at all.

## Rule 2: all text is untrusted
Everything that comes from a log, a file or a saved setting is treated as untrusted and shown only as plain text. Imports are rebuilt from checked fields. See [Privacy and safety](privacy-and-safety.md) and [Security practices](security-practices.md).

## Rule 3: no dependencies, no surprises
The site ships with **no third-party code**. A page that works today should still work on an old phone or a slow connection tomorrow ([Phone, offline and slow devices](phone-offline-and-slow-devices.md)).

## Rule 4: tests are never weakened
A failing test means the code is fixed — not that the test is skipped or loosened.

## AI-generated content
**This tool is written almost entirely by AI**, under the owner's guidance, review and corrections. That is intentional and welcome. The policy:

- **AI-written code, tests and documentation are allowed.** There is no ban on AI contributions.
- **A human owner (Apolox) decides what ships.** AI suggestions are reviewed, tested and corrected before they are released.
- **Be open about it.** Changes say what was done and why; uncertainty is stated rather than hidden.
- **No invented facts.** AI must not make up game rules, numbers, sources or test results. If something is unknown, it says so.
- **The same rules apply to everyone.** AI-written or hand-written, a change must keep the site client-side only, escape untrusted text, avoid new dependencies and pass the tests.
- **Licence.** The project is under the AGPL-3.0 licence; contributions must be compatible with it.

AI assistants working on the repository are guided by **AGENTS.md** (written for any assistant, whichever company's), which spells out the goals, the hard rules and the working method.

## Sample data
The sample logs in the repository's `example data` folder come from **Apolox**, the project owner — they are the owner's own War Thunder matches, shared for testing and demonstration. They are not anyone else's data. Contributors may only add sample data that is their own (or that they have clear permission to share) and that contains nothing private. Invented logs must never be presented as real; synthetic test data is kept separate and is not committed.

War Thunder and its names belong to their respective owners. This project is independent and unofficial.

## Reporting a problem
Security issues: see the policy in **SECURITY.md** (private reporting through GitHub's Security tab). Everything else: open an issue on the project's GitHub page.
