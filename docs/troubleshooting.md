# Troubleshooting and FAQ

## "No matches recognized in that text"
The text needs to include a match headline (*Victory in the […] mission!* or *Defeat…*) and, ideally, the *Total* line. Copy a complete match report from War Thunder. See [Reading your logs](reading-your-logs.md).

## My totals look too low
- Repeated matches are left out of totals — check for the duplicate warning.
- If you only pasted part of a report, the missing parts can't be counted.
- Check the battle-type split: matches may be in a different category than you expected.

## My totals look different from the game
The site counts the match's **CRP** as RP (not the larger figure at the end of the Total line, which also includes research-progress RP). See [Reading your logs](reading-your-logs.md#why-crp-and-not-the-last-rp-figure).

## The Advanced view says the archive is empty
Matches are saved when you click **Analyze** in the Basic view. If you used a private window, cleared site data, or opened the page from a different address (for example the stable site), the archive there is a different one. Import a raw export to restore.

## Some matches have no detail (○)
They came from a **minimal export** or an **HTML report**, which hold only summaries. Only matches pasted as text, or imported from a **raw** export, have full detail (●).

## "Load Example Data" does nothing / fails
The example is fetched from the website, so it can't load when the page is opened straight from a file on disk, or with no connection the first time. Open the hosted page, or run a small local web server.

## Import said "could not read that file"
Make sure the file is an export from this tool (raw, minimal, HTML report) or a plain .txt log. Very large files (over about 150 MB) are refused. Summary-only files can't be imported in the Advanced view — use the Basic view.

## My colours won't apply
One of the readability pairs is under 3:1, so the set is refused. The panel names the pair. Change a colour until every pair is readable, then the new colours apply by themselves.

## My preset name was rejected
Names accept English/Spanish letters, numbers, spaces and basic punctuation, up to 30 characters. A setting lets you allow other characters.

## The page looks unstyled or says "Part of this page didn't load"
A file didn't arrive (usually a poor connection). Press **Reload**. If it keeps happening, check your connection or try again later. After your first good visit the site is cached and loads from your device.

## I see "A new version is ready"
A newer version was downloaded in the background. **Reload** switches to it; **Later** keeps the current one for now.

## The site seems stuck on an old version
Use the **Reload** button in the update note. If there is no note, close all tabs of the site and open it again. As a last resort, clear the site's data in your browser — **but export a raw backup first**, because that also deletes your archive.

## Everything vanished
The archive and settings live in your browser. Clearing site data, using a private window or switching browsers/devices means starting empty. Restore from a raw export ([Backups, import and export](backups-import-export.md)).

## Print / Save PDF looks wrong
- Run **Analyze** first.
- The printout keeps your theme; if backgrounds are missing in your browser, check that its print dialog isn't set to remove colours or "economy" mode.
- Choose **Daylight** for a light, ink-friendly page.

## The page is slow with a huge session
See [Big sessions](phone-offline-and-slow-devices.md#big-sessions): clear the paste box after analyzing, and use the "Show 500 more" buttons rather than "Show all".

## The top bar is a Menu button
That's the phone layout (narrower than about 680 pixels). Widen the window or rotate your phone for the full bar.

## Does it work in my browser?
Any current version of Chrome, Edge, Firefox or Safari, on desktop or phone. Very old browsers show a "couldn't start" message with a Reload button.

## Is the Dev site safe for my data?
It is the in-progress version: bugs are more likely than on the stable site. Keep raw backups. The Dev archive is stored separately from the stable site's, so one cannot damage the other.

## Where do I report a problem?
Open an issue on the project's GitHub page (the logo in the top bar). Describe what you did and what you expected; do not include anything private.
