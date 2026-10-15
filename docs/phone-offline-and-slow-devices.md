# Phone, offline and slow devices

The site is built to be reliable on small screens, old devices and poor connections. This page explains what you will see and what you can do.

## On a phone
Below about **680 pixels** wide the top bar's controls (view switch, tutorial, GitHub link, colours) would not fit in a row, so they fold behind a **Menu** button.

- Tap **Menu** to open the controls. The same menu lists **Jump to** links for the page's sections (for example *Overall*, *Goal calculator*, *Per-match detail* on the Basic view, or *Library*, *Insights*, *Storage* on the Advanced view). A section is only listed while it is on screen.
- Tap outside the menu, press **Esc**, or pick an item to close it.
- The guided tours open the menu for you when a step points at something inside it.
- Wide screens keep the normal top bar.

Tables scroll sideways when they are wider than the screen. Tip: the **Text size** setting (Colours and text) can make everything easier to read.

## On a slow connection
- The whole site is small: about 60 KB of data for a first visit, and it is loaded in **a handful of files** rather than dozens, so there are fewer slow round trips.
- If loading takes longer than a few seconds you will see a calm note at the bottom: *Still loading — this is taking a while on your connection. The page will work in a moment.* It disappears by itself.
- If part of the page fails to arrive, a note says *Part of this page didn't load — check your connection* with a **Reload** button, instead of leaving a page that looks fine but does nothing.
- The optional parts (colour panel, tutorials, phone menu) load after the main page, so you can start pasting and analyzing sooner.
- Your saved colour theme is applied from the very first moment even on a slow connection.

## Offline use
After your **first successful visit** the site saves itself in your browser (a "service worker" cache), so:

- return visits open **instantly**, even on a terrible connection;
- the whole app works with **no connection at all** — analyzing, the archive, the Advanced view and insights all work offline;
- the example data works offline once it has been loaded at least once.

### Updates
When a new version is published it is downloaded quietly in the background. It **never swaps in by itself** while you are working. A note appears — *A new version is ready.* — with **Reload** and **Later**.

- **Reload** switches to the new version.
- **Later** dismisses the note; it is offered again next visit.

If you close every tab of the site, the new version simply takes over next time you open it.

### Offline limits
- **Load Example Data** needs a connection the first time.
- The very first visit needs a connection (there is nothing saved yet).
- Opening the page directly from a file on disk skips the offline cache.
- This documentation is not part of the offline cache.

### Developers on localhost
The offline cache is **off** when the site is opened from `localhost`, so edits are never hidden behind a cache. See [How it works](how-it-works.md) for how to turn it on for testing.

## Big sessions
With thousands of matches the page stays responsive:

- The Basic view's match table shows the first 200 rows with **Show 500 more / Show all**.
- Saving to the archive runs in the background, so the page does not freeze after **Analyze**.
- The Advanced view lists matches without unpacking them, and fills its insight tables from small stored summaries.

Very large pasted logs (megabytes of text) can still make colour changes and the colour panel feel slower on weak devices, because the browser has to lay out all that text in the paste box. If that happens: **Clear** the box after analyzing (your archive keeps the matches).

## Old browsers
The site needs a reasonably modern browser: it uses the browser's built-in compression and database features. If the page cannot start, a message with a **Reload** button explains that. Updating your browser fixes it.
