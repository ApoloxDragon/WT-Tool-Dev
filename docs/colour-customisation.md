# Colour customisation — design record

**Status: implemented.** This began as a draft with open questions; the decisions below are the answers that shaped it.

## Decisions
| Topic | Decision |
|---|---|
| Built-in presets | **8**: the four originals unchanged (Blue, Amber, Slate, Forest) plus Crimson, Violet, Teal and a light **Daylight**. Only 4 existed before; the other 4 are new. |
| Basic picker | Eight swatches in the top bar (named, keyboard-accessible, marked pressed). Applied immediately and saved in local storage. |
| Advanced picker | A docked "Customise…" panel (both views): start from any preset, change **any of nine colours** (background, panel, panel 2, border, text, dim text, accent, win, loss), pick a **font style** (monospace / sans-serif / serif) and **text size** (small / medium / large). |
| Edits | Stay applied and saved after reload, even when not saved as a named preset. |
| My presets | Save, rename, delete. **20** by default; the user can accept a risk warning to raise it to a ceiling of **100**. Export/import as a small JSON file (strictly validated). |
| Names | English + Spanish letters by default (A–Z, á é í ó ú ü ñ, ¿ ¡, digits, space, basic punctuation, max 30). A setting allows other characters; control and direction-changing characters are never allowed. Names are normalised (NFC). |
| Readability | Every text/background pair is measured (WCAG contrast). **≥ 4.5:1** good, **3–4.5:1** weak but allowed with a warning, **< 3:1** refused. |
| Exported reports | Styled with the active colours; the report's own picker offers the eight presets plus "Your colours". |
| Tutorial | Opt-in only ("? How this works" in the panel): a tour that also explains, per colour, what it changes. |

## Behaviour worth knowing
- **Refused colours wait instead of blocking you.** Edits are drafted: if the current set is unreadable (< 3:1) it is *not applied* and the panel says which pair is too low, but the boxes keep what you typed. As soon as every pair passes, the colours apply and save by themselves. This is what lets you turn a dark look into a light one one colour at a time, since every intermediate step is unreadable.
- **Text on buttons and banners flips between dark and light automatically** so it stays readable on whatever accent / loss colour is chosen.
- **Text size** scales all text (CSS sizes are in `rem`); printing ignores it.
- The four original presets keep their exact colours, so a few of their dim-text pairs are in the "weak" band (e.g. Blue's dim text on panel 2 is 3.99:1). The new presets are all ≥ 4.5:1.

## Stored settings (all under `wtSessionReadout.`)
| key | holds |
|---|---|
| `appearance` | `{ v, presetId, colours{9}, font, size }` — the active look |
| `myPresets` | `[{ id, name, colours{9} }]` |
| `presetLimitUnlocked` | `true` once the risk warning was accepted |
| `allowAnyNameChars` | `true` if the name rule was relaxed |
| `theme` | legacy: still written (only for the original four presets) because the stable site shares this origin's storage and only understands those names. An old `theme` value is carried over on first run. |

## Safety
Every colour is validated as `#rrggbb` before it is stored, applied or exported, and is only set through CSS custom properties. Saved settings, imported preset files and names go through the same validation; the panel is built with DOM calls (no HTML strings). See `tests/suites/appearance.js` for the hostile-data cases.
