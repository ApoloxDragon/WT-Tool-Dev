# Colour customisation — DRAFT (not implemented)

> **Status: design draft only.** Parts of the request were ambiguous, so nothing in this document is built.
> Every open question is marked **Q#** with the assumption the draft makes. Answer them (or just say "go with
> your assumptions") and this becomes the implementation plan.

## What was asked
1. Let the user **pick from the already-provided colour presets**.
2. Let the user **use whatever colour they wish for everything**.
3. An **optional tutorial for the "advanced colour picker"**.
4. **Options for presets using the default, already-present settings.**

## What exists today
- Four presets in `javascript/themes.js` — **blue** (default), **amber**, **slate**, **forest** — shown as four unlabeled swatches in the top bar (the name is only a hover tooltip).
- Each preset defines **7 colours**: background, panel, panel-2, border, accent, text, dim.
- **Win green (`#7fbf6a`) and loss red (`#d16158`) are fixed** — they are not part of any preset.
- The choice is saved under `localStorage` key `wtSessionReadout.theme`; the exported HTML report copies the active preset; printing always forces dark-on-white.
- All four presets are dark.

## Draft design

### Two levels
```
Top bar:   [? Tutorial] [🎨 Colours ▾]  ...

Basic level (click "Colours")                Advanced level (click "Customise…")
┌───────────────────────────────┐            ┌────────────────────────────────────────────┐
│ Preset                        │            │ Background   [■] #0d1420   Panel   [■] #131b2b │
│ (●) Blue (default)            │            │ Panel 2      [■] #182338   Border  [■] #26344d │
│ ( ) Amber                     │            │ Accent       [■] #4d9fe8   Text    [■] #dbe6f2 │
│ ( ) Slate                     │            │ Dim text     [■] #6f8299   Win     [■] #7fbf6a │
│ ( ) Forest                    │            │ Loss         [■] #d16158                       │
│ ( ) My presets ▸              │            │ Contrast: Text on Background  12.1:1  ✔        │
│                               │            │ [Reset to preset] [Save as my preset…]         │
│ [Customise…]  [Reset to default]│           │ [? How this works]   live preview = the page   │
└───────────────────────────────┘            └────────────────────────────────────────────┘
```
- **Basic level** = the presets, now with visible names and a one-click **Reset to default** (Blue).
- **Advanced level** = one colour control per role (9 roles: the 7 preset colours + win + loss). Each has the browser's native colour input plus a hex text box. Changes apply **live to the whole page**; nothing is saved until the user chooses **Save as my preset** (or leaves it applied — see Q4).
- **My presets**: user-named, stored locally, start as a copy of whichever preset was active ("presets using the default settings" — see Q3). They can be renamed, deleted, exported/imported as a small JSON file.
- **Contrast helper**: shows the contrast ratio of text on background / panel and warns (never blocks) below 4.5:1.
- **Optional tutorial**: a "? How this works" link inside the panel starts a short spotlight tour of the colour panel (reusing the existing tutorial engine). It is **never** auto-started.

### Where it applies
Both views share the colours (one saved setting). The exported HTML report is styled with the active colours, as today. Printing stays forced dark-on-white regardless.

### Data & safety rules
- Stored as `{ name, colors: { bg, panel, panel2, border, accent, text, dim, win, loss } }`.
- Every colour is validated as `#rrggbb` hex before it is stored, applied or exported — anything else is discarded (prevents CSS / HTML injection via imported or tampered settings).
- Applied only through CSS custom properties (`--bg`, `--accent`, …), never by building style strings.
- **Important:** the stable site shares this origin's `localStorage`, and its code expects the existing `theme` key to hold a preset *name*. The draft therefore stores custom themes under a **new key** (e.g. `customTheme`) and leaves `theme` alone, so a custom theme chosen here can never break the stable site.

## Open questions
| # | Question | Assumption in this draft |
|---|---|---|
| **Q1** | "Whatever colour for **everything**" — which colours? | The 9 roles above (7 preset colours + win + loss). *Not* fonts, sizes or spacing. |
| **Q2** | What is the "**advanced colour picker**"? | The per-role editor above (native colour input + hex box + live preview). *Not* a custom-built HSL wheel / eyedropper widget. |
| **Q3** | "**Options for presets using the default already present settings**" — which of these? (a) save *my own* presets, starting from the existing ones; (b) just a "reset to default"; (c) *more built-in* presets (e.g. light, high-contrast) derived from the existing ones. | (a) and (b). Not (c). |
| **Q4** | Should an unsaved custom colour set **stay applied** after reload, or only persist once saved as a named preset? | It stays applied automatically (saved as the current colours); naming it as a preset is optional. |
| **Q5** | Should there be a **light** theme (all current presets are dark)? | No — only what the user builds themselves. |
| **Q6** | Should the exported HTML report use the custom colours (as it does for presets today)? | Yes. |
| **Q7** | Contrast: **warn** on low contrast, or **block**? | Warn only. |
| **Q8** | Should "my presets" be **exportable / importable** as a file (to move between devices)? Is there a limit (I'd say 20)? | Yes, with a limit of 20. |
| **Q9** | Is the **tutorial** a short tour of the colour panel only, or should it also teach colour-theory basics (what "panel", "dim", "accent" affect)? | Panel tour only, with one line per role saying what it changes. |

## What would be built once clarified
1. `themes.js`: custom-theme model, validation, apply, persist, my-presets CRUD.
2. A Colours panel (both views) with the two levels.
3. Contrast helper + reset buttons.
4. Optional tutorial steps for the panel (added to `tutorial.js`).
5. Export/report integration and tests (same before/after workflow as `tests/`).
