# Controls reference

Every button, field and toggle, in one place. For explanations and examples see the linked pages.

## Basic view

### Top bar
| Control | What it does |
|---|---|
| **Advanced view →** | Opens the per-match archive view |
| **? Tutorial** | Starts this page's guided tour |
| **GitHub logo** | Opens the project's source page in a new tab |
| **Theme swatches** | Apply one of the eight colour presets instantly |
| **Customise…** | Opens the colour, font and text-size panel |
| **Menu** *(narrow screens only)* | Shows the top bar's controls and jump-to-section links |

### Paste area and buttons
| Control | What it does |
|---|---|
| Paste box | Where you paste match logs |
| **Analyze** | Reads the text, shows results, saves matches to the archive |
| **Clear** | Empties the paste box, the results and imported summaries; the archive is untouched |
| **Load Example Data** | Loads and analyzes the sample session (needs the hosted site) |
| **Print / Save PDF** | Print dialog for the results (Analyze first) |
| **Export HTML** | Standalone themed report of the unique matches |
| **Minimal export** (toggle) | Changes the export button to **Export Data (minimal)** — a compact summary-only file |
| **Export Raw** | Original text of the whole archive, `.json.gz` |
| **Import Report** | Loads a raw export, minimal export, HTML report or `.txt` log |

### Notes under the buttons
A file note (name of the last file), an **import note** (what was imported or why it failed), an **archive note** (how many matches are saved), and the **duplicate warning**.

### Battle-type categories
| Control | What it does |
|---|---|
| Rule rows (keyword, label) | Edit in place; saved as you type |
| **Remove** | Deletes the rule |
| **mode keyword** / **category label** + **Add rule** | Adds a rule at the end |

### Results
| Area | Notes |
|---|---|
| **Overall** | Matches, win rate, total net SL, total RP |
| **Battle type split** | One row per category |
| **Goal calculator** | See [The goal calculator in depth](goal-calculator-guide.md) |
| **RP by research target** | New-vehicle RP, largest first |
| **Other RP** (collapsed) | Module / progress RP |
| **Per-match detail** | Every match; first 200 rows with **Show 500 more** and **Show all** |

### Goal calculator fields
**Load averages from**, **Win rate %**, **+30% RP Booster**, **Avg win RP**, **Avg loss RP**, **Avg win SL**, **Avg loss SL**, **RP goal remaining**, **SL goal remaining**.

## Advanced view

### Top bar
**← Basic view**, **? Tutorial**, GitHub logo, theme swatches, **Customise…**, **Menu** on narrow screens.

### Library
| Control | What it does |
|---|---|
| **Search** | Mission, category, target |
| **Battle type** drop-down | Filter by category |
| **Win + loss / Victories / Defeats** | Filter by result |
| **Sort** | Newest, oldest, most SL, most RP, longest |
| **Detail only** | Hide summary-only matches |
| Table row (● or ○) | Click or press **Enter** on a ● row to open its detail |

### Match detail
**Close ✕**, event sections (expand/collapse), **Raw log text** (expand), **Copy raw text**, **Export this match (raw)**, **Delete from archive**.

### Insights
Three collapsible tables: **By map**, **By vehicle**, **Earnings by event type**.

### Storage
| Control | What it does |
|---|---|
| **Export raw (.json.gz)** | Compressed lossless backup |
| **Export raw (.json)** | Uncompressed lossless backup |
| **Import raw / log file** | Adds matches from a raw export or plain log |
| **Clear duplicate matches** | Removes repeats, keeping the first copy |
| **Delete entire archive** | Empties the archive (asks first) |

## Customise panel
Titled **Colours & text**.

| Section | Controls |
|---|---|
| **Start from a preset** | Preset list (Built-in and My presets, plus *Custom colours* when you have edited), **Reset to preset** |
| **Colours** | Nine colour squares plus **#rrggbb** boxes, grouped Surfaces / Text / Accent & results |
| **Readability** | Contrast list with warnings and refusals |
| **Font style** / **Text size** | Monospace, sans-serif, serif / small, medium, large, with a sample line |
| **My presets** | Name box, **Save as my preset**, and per preset **Use**, **Rename**, **Delete** (asks *Sure?*); **Export my presets**, **Import…**; checkboxes **Allow other characters in names** and **Allow up to 100 presets (at your own risk)** |
| Footer | **Reset everything to default**, **? How this works**, **Close ✕** |

## Keyboard
| Key | Does |
|---|---|
| **Esc** | Closes the tour, the Customise panel, the phone menu, the match-detail panel |
| **← →** | Previous / next tour step |
| **Tab / Shift+Tab** | Move between controls |
| **Enter / Space** | Activate a focused button; **Enter** opens a focused library row |

## Messages you may see
| Message | Meaning |
|---|---|
| *Still loading — this is taking a while…* | Slow connection; it clears itself |
| *Part of this page didn't load…* + **Reload** | A file failed to arrive |
| *A new version is ready.* **Reload / Later** | An update is waiting |
| *N duplicate match(es) detected…* | Repeats were left out of totals |
| *Could not read that file…* | The import file wasn't understood |
| *Run Analyze first.* | Print/export needs results |
