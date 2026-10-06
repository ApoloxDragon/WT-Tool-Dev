# Colours and text

You can make the site look the way you like, and it remembers your choice. The same look is used on both views and in exported reports.

## Quick pick: eight presets
The row of **swatches** in the top bar switches the whole site at once:

**Blue** (the original default), **Amber**, **Slate**, **Forest**, **Crimson**, **Violet**, **Teal** and **Daylight** (a light theme). Hover a swatch for its name. The selected one is marked.

Your choice is applied **before the page first appears**, so reloading or switching between views does not flash the default blue.

## The Customise panel
Click **Customise…** next to the swatches. The panel docks to the side (on a phone it covers more of the screen) and everything you change applies instantly. Close it with its close button or **Esc**.

### Start from a preset
Pick any preset (built-in or your own) from the list as a starting point. **Reset to preset** undoes your edits.

### Change any colour
Nine colours, grouped by what they do:

| Group | Colour | What it changes |
|---|---|---|
| Surfaces | **Background** | The page behind everything. |
| | **Panel** | Boxes: the paste area, stat tiles, the goal calculator and this panel. |
| | **Panel 2** | The second layer: inputs, table headers, hovered rows, detail sections. |
| | **Border** | Lines between rows, box outlines and the dotted page pattern. |
| Text | **Text** | Main text: table cells, numbers, names and field contents. |
| | **Dim text** | Secondary text: labels, hints, column headings and notes. |
| Accent & results | **Accent** | Highlights: headings, big numbers, primary buttons, links and active items. |
| | **Win** | The word Victory and other win highlights. |
| | **Loss** | The word Defeat, warnings, errors and the dev banner. |

Use the colour square to pick, or type a colour as **#rrggbb** (for example #1a2b3c). Text on buttons and banners automatically switches between dark and light so it stays readable on whatever accent or loss colour you choose.

### Readability check
Each line shows how clearly one colour reads on another (a contrast ratio):

- **4.5:1 or more** — good.
- **3 to 4.5:1** — weak, but allowed (a warning is shown).
- **Under 3:1** — refused: the new colours are **not applied** and the panel says which pair is too low. Your typing is kept.

Refused colours **wait for you**: as soon as every pair is readable, the colours apply by themselves. This is what lets you change from a dark look to a light one one colour at a time (for example background first, then text).

### Font style and text size
- **Font style:** monospace (the original), sans-serif or serif.
- **Text size:** small, medium or large. It scales all text on the page. Printing ignores it.

### Saving your own presets
In **My presets**, give your current colours a name and save them.

- Names may use **English or Spanish letters** (including á é í ó ú ü ñ and ¿ ¡), numbers, spaces and basic punctuation, up to 30 characters. A setting allows other characters if you need them.
- You can keep **20** presets. If you want more, the panel explains the risk and lets you go up to **100** (more saved presets means more stored data and a longer list).
- Rename or delete any of your presets.
- **Export** your presets to a file and **Import** them on another device. Imported files are checked strictly; bad entries are skipped.

### Reset everything
**Reset everything to default** returns to Blue, monospace and medium text. Your saved presets are kept.

### Guided tour of the panel
**? How this works** at the bottom of the panel starts an optional tour that explains each colour and each control. It never starts by itself.

## Where your look is stored
In your browser only. The four original presets are also written in a form the older stable site understands, because both sites share the same address space in your browser; your custom colours are only used by this version.

For the reasoning behind these decisions see [Colour customisation — design record](colour-customisation.md).

## Exports and printing
- **Export HTML** reports use your current colours and include their own picker with the eight presets plus "Your colours".
- **Print / Save PDF** keeps your theme — see [The Basic view](basic-view.md#printing-and-save-as-pdf).
