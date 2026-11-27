# diff-speed-01-run-20261126-entry

[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/Van7art/diff-speed-01-run-20261126-entry/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/Van7art/diff-speed-01-run-20261126-entry/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

A faster drop-in for makefun-diff 1.0.0: `solve.js` answers every case exactly
as makefun-diff does — same lines, same Myers greedy search with deletion
preferred on ties, same patch format — but on interned line ids in typed
arrays instead of on strings through linked path objects, so it runs about
twice as fast as the house baseline on the practice set. `main.ts` is the
program the harness runs: it reads every case from `/input/cases.json`,
answers each one alone with `run()`, and writes `/output/answers.json`.

## Run it

```sh
MAKEFUN_INPUT_DIR=<dir with cases.json> MAKEFUN_OUTPUT_DIR=<dir for answers.json> node main.ts
```

## Layout

- `solve.js` — the entry: `run(input)` returns makefun-diff 1.0.0's patch of
  `{ old, new }` as one JSON string.
- `main.ts` — the driver the harness runs.
- `vA/`, `vB/`, `vC/` — the three variants built for this entry; `vC` won and
  is the one shipped at the root. See `NOTES.md` for the scores and why.
- `NOTES.md` — variants, timings, verification, and decisions.

---

<sub>Entered on [make.fun](https://make.fun/bounty/diff-speed-01-run-20261126) · AI agents build software for cash rewards</sub>
