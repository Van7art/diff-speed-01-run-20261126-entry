# diff-speed-01-run-20261126 — build notes

Competition: `diff-speed-01-run-20261126` ("Diff two texts faster, 27 November
2026"), program/v1, free entry, $100 total, top 10 x $10. Entries close
2026-11-29T06:07Z (14:07 WITA 29 Nov); result due 2026-12-14. Opened
2026-11-27T06:07Z. A reward needs beating the house baseline (makefun-diff
1.0.0) at 95% confidence in the final heat; places go by CPU time, least
first. Practice set: 4 cases, ~21–32k lines each, ~1,200–2,000 changed lines
(edit distance D ≈ 3,500–4,000).

## The rule (from the competition description + the baseline's header)

`run(input)` returns makefun-diff 1.0.0's patch of `{ old, new }` as one JSON
string: lines split on `\n` only; common prefix then common suffix trimmed;
then Myers's greedy search that keeps, per diagonal, the path furthest into
the old text, prefers a deletion on ties, never moves past either text's end,
prunes no edge diagonal, and follows every run of equal lines fully. Patch
header `makefun-diff/1 old=N new=M hunks=H deleted=D inserted=I`, hunk
headers `@ os ol ns nl`, `=`/`-`/`+` lines, deletions before insertions per
change run, up to 3 context lines, runs ≤ 6 kept lines apart share a hunk,
no-newline-at-EOF lines written with one + a `%` line, identical texts = first
line alone.

## Variants (all three implement the same search exactly)

- **vA** — line interning to int ids (`Map<string, number>` over tokenized
  lines), forward Myers with every level's V row in one flat `Int32Array`
  (row d at `d*d`, `-1` = no path), backtrack reconstruction with the same
  tie-break. Head-to-head CPU on the practice set: ~1.29 s (5 runs).
- **vB** — vA with a tighter forward pass: V rows padded with `-1` sentinels
  (no range checks), the insertion candidate of one diagonal carried as the
  deletion candidate of the next (one V read per step), pointer indexes
  walking by 2, end check only on the reaching diagonal. ~1.19 s.
- **vC (WINNER, shipped at the root)** — vB plus: no rebuilt line strings
  (the split's own parts are the lines; terminated lines interned in one
  `Map`, bare last lines in a separate negative id space, so `"abc\n"` and a
  bare `"abc"` stay different lines); V rows store `x + 1` so a fresh row's
  zeroes already mean "no path" (no fill); patch built as separate pieces
  joined once. ~1.05 s.

## Timings (local, Node v24.22.1, CPU time of `node main.ts` on the practice set)

Head-to-head in one session, 5 runs each (3 for the baseline):

| entry | CPU per full set (4 cases) | vs baseline |
|---|---|---|
| house baseline (makefun-diff 1.0.0) | ~2.05 s | 1.00x |
| vA | ~1.29 s | 1.6x |
| vB | ~1.19 s | 1.7x |
| **vC** | **~1.05 s** | **~2.0x** |

(An earlier baseline reading of ~4.55 s was taken under heavy machine load;
the head-to-head numbers above are the comparable ones. The server's timing
hardware differs, so only the ratio travels: vC is about twice the baseline.
The current leaderboard best is 2,800,000 µs = 2.8 s on the server's clock.)

## Verification (exactness is the gate — one miss pays nothing)

- Practice set: **4/4 byte-identical** to `practice/reference/expected.json`
  for every variant, on every run.
- Differential fuzz vs the reference `diffPatch`: **8,000 random small cases
  for vC** (3,000 each for vA/vB), 0 mismatches. Cases mix replaced /
  deleted / inserted / doubled / swapped / moved lines, repeated-line runs,
  CRLF texts, bare (no-final-newline) endings, empty lines, `\r` in lines.
- 25 hand-crafted edge cases (empty texts, single lines, all-identical
  lines, full reversals, `\r\n` mixes, bare endings, unicode): 0 mismatches.
- 24 full-size cases drawn from the kit's own generator
  (`program/generator/subject/diff-pairs.mjs`) with 6 fresh seeds: 0
  mismatches, all variants.
- Determinism: the root entry run twice on the practice set writes
  byte-identical `answers.json`.
- Kit `grade-local --driver process` on the root entry: **finished, passed 1,
  cases_passed 4/4, reproduced true, prize_eligible true**. Only note: local
  Node v24.22.1 vs the server harness's v26.13.1 (environment note, not a
  failure). Authorship in that run reads 0 authored / 216 absent because no
  transcript bundle was passed to grade-local; authorship is measured at
  submit from the bundled builder sessions, and all code here was written in
  this builder session.

## Decisions

- **No bidirectional / linear-space Myers.** A reversed greedy search does
  not reproduce the forward greedy's path in general (concrete
  counterexample: old `[A,B]`, new `[B,A]` — forward greedy keeps `A`, the
  reversed greedy keeps `B`), so a meet-in-the-middle script can differ from
  makefun-diff's and fail the gate. With a flat $10 for places 1–10, the
  extra speed is not worth the exactness risk.
- **`--no-incremental-marking` kept** in `main.ts`, as the house baseline
  does; measured with and without, it makes no difference here.
- **Nothing cached between cases**: every `run()` call builds fresh maps and
  arrays; the module holds no mutable state. Deterministic: no clock,
  randomness, or environment reads.
- **Not submitted, not pushed** (per task): built and committed locally only;
  the coordinator bundles this session and submits.
- Repo size ~76 KB total, far under the 1 MiB cap. No dependencies, no
  install step, JS/TS source only. `main.ts` was rewritten in the builder's
  own style (same behaviour as the house driver).
