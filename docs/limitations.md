# What the site does not do

Knowing the limits saves time. Here is what is deliberately out of scope, or not possible.

## Not connected to the game
It never talks to War Thunder. It only reads text **you** paste or import. There is no live tracking and no way to fetch your history automatically.

## Not an account service
There is no login, no cloud sync and no sharing between devices except through files you export and import yourself.

## Estimates, not promises
The goal calculator estimates from your own past matches. See [its limits](goal-calculator-guide.md#honest-limits).

## Depends on log wording
The parser reads the text format the game currently uses. If a game update changes the wording, some lines may go unrecognised (the Advanced view says how many). Matches still count when their headline and totals are readable.

## One copy per match
A match is identified by its Session ID. A match without a readable Session ID can't be recognised as a repeat, and the archive keeps one copy per Session ID.

## Storage belongs to the browser
- The archive is limited by what your browser allows.
- Clearing site data deletes it.
- A browser without a usable database falls back to about 5 MB, or can't save at all in some private modes.
- The stable site, the Dev site and `localhost` each keep separate data.

## Summaries have no detail
Matches imported from a minimal export or HTML report carry only a summary (○). They count in totals and maps but have no breakdown.

## Not every setting travels
Colour presets can be exported and imported. Battle-type rules and the goal-calculator fields can't be exported; re-create them.

## Size limits
Very large or hostile files are refused; see the table in [Privacy and safety](privacy-and-safety.md#limits).

## Languages
The interface and documentation are in English. Colour preset names accept Spanish letters. A Spanish interface is not available.

## Browsers
Needs a reasonably current browser. Very old ones show a "couldn't start" note.

## This is the Dev version
It exists to try things. Bugs are more likely than on the stable site. Back up with **Export Raw**.
