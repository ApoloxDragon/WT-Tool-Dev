# Sample data

The match logs and files in this folder come from **Apolox**, the project owner — they are from their own War Thunder matches, shared here for testing and demonstration. They are **not** anyone else's data.

| File | What it is |
|---|---|
| `matches.txt` | Raw match-log text (the sample behind **Load Example Data**) |
| `matches-large.txt` | A larger raw log (334 pasted reports = 300 unique matches, 34 repeats), used to test bigger sessions and as the source of the chart PDFs in `docs/examples/` |
| `wt-session-data.json` | A minimal export (summaries only) made from the owner's matches |
| `wt-session-report-*.html` | An HTML report export made from the owner's matches (supplied by the owner) |

Rules for this folder:
- Add data only if it is **your own** (or you have clear permission) and contains nothing private.
- Never invent logs and present them as real. Synthetic stress-test data belongs in `example data/generated/`, which is git-ignored.
- War Thunder and its names belong to their respective owners; this project is independent and unofficial.
