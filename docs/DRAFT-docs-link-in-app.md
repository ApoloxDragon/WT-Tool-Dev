# Draft: linking the docs from the app

**Status: draft — not applied.** Nothing in the app links to these docs yet. This page describes what adding the link would involve, so it can be decided later.

## The idea
A small **Docs** link in the top bar of both views (next to **? Tutorial**), also listed in the phone **Menu**, pointing at the single-page documentation next to the app.

## What would change
- Both pages' top bars gain one link.
- The phone menu includes it automatically (it lists the top bar's controls).
- The offline cache's list of files could include the docs page so the docs work offline too (this makes the first visit download a little more).
- The tests that check the top bar, the tutorials' wording and the offline cache contents would need small updates, and the generated scripts and offline worker would be rebuilt.
- A tutorial step could mention it.

## Open questions
1. Should the link open in the same tab or a new one?
2. Should the docs be cached for offline use (adds size to the first visit)?
3. Should the docs follow the user's saved colour theme? (They currently use a fixed light/dark style that follows the device setting, because the docs page has no scripts.)
4. Spanish version of the docs first or later?

Nothing here is built until these are decided.
