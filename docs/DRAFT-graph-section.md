# DRAFT: GRAPH section (Basic view)

Status: draft for the owner to review. Not merged into the user docs, tutorial or tests yet.

## What it does
A new GRAPH section sits under the battle-type split. The user picks what to graph (wins vs defeats, RP per match, net SL per match, time played) and the graph type (line by match order, or a histogram). It draws on a canvas from the matches the tool already counted, repeats removed. It also shows n, min, max and the mean. Histogram classes use Sturges (k = ceil(1 + 3.322 log10 n)), width c = A / k not rounded, and the last class runs to the maximum.

## Privacy
Everything is computed and drawn in the page. No network request, no storage, no markup built from log text (canvas plus textContent only). The `clientside` and `security` suites pass with it.

## Open items for the owner
1. **Size budget fails.** First-visit text is 58.0 KB gzipped against the 56 KB budget (core bundle 31.5 KB, under its 32 KB limit). Options: raise the budget, trim other code, or load the graph code only when the section is first used. This is a performance-policy decision, so it is left to the owner.
2. Tutorial: no step for the GRAPH section yet.
3. User docs: `docs/basic-view.md` and the controls reference do not mention it yet (then `node tools/build-docs.js`).
4. Tests: no dedicated graph suite yet (checks wanted: the canvas draws, the note matches the data, the type box is disabled for wins vs defeats, repeats are not counted).
5. Exported HTML reports do not include the graph.
