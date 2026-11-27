// Variant B — fast exact drop-in for makefun-diff 1.0.0.
//
// Same answer as makefun-diff's diffPatch on every input, by the same rule
// (the house baseline's vendor/makefun-diff/index.js header): lines split on
// '\n' only; common prefix then common suffix trimmed; then Myers's greedy
// search that keeps, per diagonal, the path furthest into the old text,
// prefers a deletion on ties, never moves past either text's end, prunes no
// edge diagonal, and follows every run of equal lines fully.
//
// Speed over variant A comes from a tighter forward pass: the V rows live in
// one flat Int32Array padded with -1 sentinels at both ends, so no diagonal
// is ever out of range and the loop does no range checks; the insertion
// candidate of one diagonal is the deletion candidate of the next, so each
// step reads one V slot; and the write/read indexes walk by 2. The script is
// rebuilt by walking the rows backwards with the same tie-break the forward
// pass used, so it is the forward pass's own path, edit for edit.

const KEEP = 0;
const DEL = 1;
const INS = 2;

/** Split a text into lines exactly as makefun-diff's tokenize does. */
function splitLines(text) {
  const parts = text.split('\n');
  const last = parts.length - 1;
  const lines = new Array(last + (parts[last] !== '' ? 1 : 0));
  for (let i = 0; i < last; i++) lines[i] = parts[i] + '\n';
  if (parts[last] !== '') lines[last] = parts[last];
  return lines;
}

/** Push a run, merging with the previous one when it is the same kind. */
function pushRun(runs, kind, count) {
  if (count <= 0) return;
  const prev = runs[runs.length - 1];
  if (prev !== undefined && prev.kind === kind) prev.count += count;
  else runs.push({ kind, count });
}

/** Row d starts here in the flat V store; it holds diagonals -(d+1)..(d+1). */
function rowOffset(d) {
  return d * (d + 2);
}

/**
 * The edit runs of the middle slice a[ap .. ap+N) into b[bp .. bp+M), as
 * makefun-diff's editRuns returns them, as [{kind, count}] in order.
 * aIds/bIds hold the interned ids of a/b's lines.
 */
function myersRuns(a, b, ap, bp, N, M) {
  if (N === 0 && M === 0) return [];
  // One flat store, every slot -1 to start: a slot of -1 is a diagonal with
  // no path, and the two sentinel slots at each row's ends stay -1.
  let cap = 512;
  let V = new Int32Array((cap + 1) * (cap + 3));
  V.fill(-1);
  const grow = (d) => {
    while (d > cap) {
      cap *= 2;
      const nv = new Int32Array((cap + 1) * (cap + 3));
      nv.fill(-1);
      nv.set(V);
      V = nv;
    }
  };

  // d = 0: the opening run of equal lines.
  let x = 0;
  let y = 0;
  while (x < N && y < M && a[ap + x] === b[bp + y]) { x++; y++; }
  V[1] = x;
  let D = (x === N && y === M) ? 0 : -1;
  const kEnd = N - M;

  for (let d = 1; D < 0; d++) {
    grow(d);
    const base = rowOffset(d);
    const prevBase = rowOffset(d - 1);
    // The insertion candidate of diagonal k is read at prevBase + (k+1) + d;
    // that index walks by 2 as k does, starting at prevBase + 1 for k = -d.
    // The deletion candidate of diagonal k is the previous step's insertion
    // candidate, carried in `left`.
    let ri = prevBase + 1;
    let wi = base + 1;
    let left = -1;
    for (let k = -d; k <= d; k += 2) {
      const right = V[ri];
      ri += 2;
      // Deletion reaches left + 1 old lines when left < N; insertion reaches
      // right old lines when its new line exists (right - k <= M); the
      // deletion wins a tie, so the insertion only replaces it when further.
      let xx = -1;
      if (left >= 0 && left < N) xx = left + 1;
      if (right >= 0 && right - k <= M && right > xx) xx = right;
      if (xx < 0) { V[wi] = -1; wi += 2; left = right; continue; }
      let yy = xx - k;
      if (xx < N && yy < M && a[ap + xx] === b[bp + yy]) {
        do { xx++; yy++; } while (xx < N && yy < M && a[ap + xx] === b[bp + yy]);
      }
      V[wi] = xx;
      wi += 2;
      left = right;
      if (k === kEnd && xx === N) { D = d; break; }
    }
  }

  // Walk the rows backwards: the pre-snake point of level d on diagonal k is
  // the same candidate the forward pass picked there, so the walk rebuilds
  // the forward pass's own path, edit for edit.
  const rev = [];
  let d = D;
  let k = kEnd;
  x = N;
  while (d > 0) {
    const prevBase = rowOffset(d - 1);
    const left = V[prevBase + (k - 1) + d];
    const right = V[prevBase + (k + 1) + d];
    let xDel = -1;
    let xIns = -1;
    if (left >= 0 && left < N) xDel = left + 1;
    if (right >= 0 && right - k <= M) xIns = right;
    let isDel;
    let xPre;
    if (xDel >= 0 && xIns >= 0) { isDel = xDel >= xIns; xPre = isDel ? xDel : xIns; }
    else if (xDel >= 0) { isDel = true; xPre = xDel; }
    else { isDel = false; xPre = xIns; }
    if (x > xPre) pushRun(rev, KEEP, x - xPre);
    if (isDel) { pushRun(rev, DEL, 1); x = xPre - 1; k = k - 1; }
    else { pushRun(rev, INS, 1); x = xPre; k = k + 1; }
    d--;
  }
  if (x > 0) pushRun(rev, KEEP, x);
  rev.reverse();
  return rev;
}

/** A line as the patch writes it, with a '%' line when it had no newline. */
function written(op, line) {
  return line.endsWith('\n') ? op + line : op + line + '\n%\n';
}

/** makefun-diff 1.0.0's answer for one case's input. */
export function run(input) {
  if (input === null || typeof input !== 'object' || typeof input.old !== 'string' || typeof input.new !== 'string') {
    throw new TypeError('makefun-diff: the input is { old, new }, two strings');
  }
  const a = splitLines(input.old);
  const b = splitLines(input.new);
  const n = a.length;
  const m = b.length;

  // Intern every line once, so the search compares small ints, not strings.
  const ids = new Map();
  const aIds = new Int32Array(n);
  const bIds = new Int32Array(m);
  for (let i = 0; i < n; i++) {
    let id = ids.get(a[i]);
    if (id === undefined) { id = ids.size; ids.set(a[i], id); }
    aIds[i] = id;
  }
  for (let i = 0; i < m; i++) {
    let id = ids.get(b[i]);
    if (id === undefined) { id = ids.size; ids.set(b[i], id); }
    bIds[i] = id;
  }

  // The common prefix, then the common suffix of what is left.
  let prefix = 0;
  while (prefix < n && prefix < m && aIds[prefix] === bIds[prefix]) prefix++;
  let suffix = 0;
  while (suffix < n - prefix && suffix < m - prefix && aIds[n - 1 - suffix] === bIds[m - 1 - suffix]) suffix++;

  const runs = [];
  if (prefix > 0) pushRun(runs, KEEP, prefix);
  for (const r of myersRuns(aIds, bIds, prefix, prefix, n - prefix - suffix, m - prefix - suffix)) {
    pushRun(runs, r.kind, r.count);
  }
  if (suffix > 0) pushRun(runs, KEEP, suffix);

  // The change runs: each a stretch of deletions and insertions between two
  // kept lines, at old line o and new line p.
  const changes = [];
  let o = 0;
  let p = 0;
  let deleted = 0;
  let inserted = 0;
  for (const r of runs) {
    if (r.kind === KEEP) { o += r.count; p += r.count; continue; }
    let c = changes[changes.length - 1];
    if (c === undefined || c.o + c.dels !== o || c.p + c.ins !== p) {
      c = { o, p, dels: 0, ins: 0 };
      changes.push(c);
    }
    if (r.kind === DEL) { c.dels += r.count; o += r.count; deleted += r.count; }
    else { c.ins += r.count; p += r.count; inserted += r.count; }
  }

  // The hunks: change runs at most 2 * 3 kept lines apart share one.
  const hunks = [];
  for (const c of changes) {
    const h = hunks[hunks.length - 1];
    const prev = h !== undefined ? h[h.length - 1] : undefined;
    if (prev !== undefined && c.o - (prev.o + prev.dels) <= 2 * 3) h.push(c);
    else hunks.push([c]);
  }

  const out = [`makefun-diff/1 old=${n} new=${m} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`];
  for (const h of hunks) {
    const first = h[0];
    const last = h[h.length - 1];
    const oldStart = Math.max(0, first.o - 3);
    const newStart = first.p - (first.o - oldStart);
    const after = Math.min(3, n - (last.o + last.dels));
    const oldEnd = last.o + last.dels + after;
    const newEnd = last.p + last.ins + after;
    out.push(`@ ${oldStart + 1} ${oldEnd - oldStart} ${newStart + 1} ${newEnd - newStart}\n`);
    let at = oldStart;
    for (const c of h) {
      for (; at < c.o; at++) out.push(written('=', a[at]));
      for (let i = 0; i < c.dels; i++) out.push(written('-', a[c.o + i]));
      for (let i = 0; i < c.ins; i++) out.push(written('+', b[c.p + i]));
      at = c.o + c.dels;
    }
    for (; at < oldEnd; at++) out.push(written('=', a[at]));
  }
  return out.join('');
}
