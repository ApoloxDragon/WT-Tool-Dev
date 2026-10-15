# Privacy and safety

## Your data stays with you
This is a project rule, not just a current fact: see [Project rules](project-rules.md). It is checked by automated tests and enforced by the pages' security policy.

- **Nothing is uploaded.** Pasted logs, your archive, your settings and your exports are processed and stored entirely inside your browser. The site has no account system and no server that receives your data.
- **No tracking.** The pages make no network requests except to load their own files (and the optional example data).
- **You decide what leaves.** Data only leaves your device when you deliberately save an export file and share it yourself.

## What is stored, and where
All of it is in your browser, on your device:

| What | Where | Notes |
|---|---|---|
| Your match archive (original text, compressed, plus small summaries) | The browser's database (IndexedDB) | A small fallback of roughly 5 MB is used if that isn't available |
| Your pasted text, battle-type rules, goal-calculator choices, tutorial "seen" flags | Browser local storage | Remembered between visits |
| Your colours, font, text size, saved presets | Browser local storage | |
| The offline copy of the site | The browser's cache | Only this site's own files |

Clearing your browser's site data removes all of it. A private/incognito window starts empty and forgets everything when closed.

### The stable and Dev sites
The Dev and stable sites live under the same web address in your browser. They keep their **archives separately**, so one can't damage the other. The four original colour themes are shared as a setting, because the stable site reads the same setting.

## Safe against what you paste
The site treats everything it reads — logs, files, settings — as untrusted:

- **Escaping.** Names and text from logs are always shown as plain text, never run as code.
- **A strict content policy.** The pages only run their own scripts, so even a mistake could not run injected code. Exported reports carry their own policy.
- **Imports are rebuilt, not trusted.** Each imported match is re-created from checked fields; bad entries are skipped and counted.
- **Settings are validated.** Corrupted or hand-edited saved settings fall back to defaults.
- **Unusual names are harmless.** A map or vehicle called something odd such as "constructor" is just a name.

## Limits
These exist so a damaged or hostile file can't freeze or fill your browser. Real logs are far below all of them.

| Limit | Value |
|---|---|
| Characters kept per log line | 2,000 |
| Size of one archived match | 256 KB of text |
| File you may import | 150 MB |
| A .gz import may unpack to at most | 128 MB (a "zip bomb" is stopped while unpacking) |
| Matches taken from one import | 100,000 |
| Characters kept per name, mission or category | 200 |
| Research targets kept per match | 50 |
| Saved colour presets | 20 by default, up to 100 |

## Sample data
The sample logs in the repository come from the project owner, Apolox, from their own matches — not from other players. See [Project rules](project-rules.md#sample-data).

## More on how security is built
See [Security practices](security-practices.md) for the protections, their known limits and the owner's checklist.

## Good habits
- Keep a raw backup ([Backups, import and export](backups-import-export.md)).
- Only import files you made yourself or trust, even though imports are checked.
- If you share an exported report, remember it contains your match results.
