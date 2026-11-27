// The program the harness runs: `node /bot/main.ts` under Node 22. It reads
// every case from /input/cases.json, answers each one alone with run() from
// solve.js, and writes the answers, one per case and in the cases' order, to
// /output/answers.json. Outside a container, MAKEFUN_INPUT_DIR and
// MAKEFUN_OUTPUT_DIR stand in for /input and /output. Nothing is installed
// before the program runs; the entry is JavaScript/TypeScript source only.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// Keep V8's incremental marking off while solve.js works, as the house
// baseline does (the rules allow an entry to tune V8's flags the same way).
// This has to happen before solve.js is imported.
setFlagsFromString('--no-incremental-marking');

type Solver = { run: (input: unknown) => unknown };

const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as Solver;

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

type Case = { id: string; input: unknown };
const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as Case[];

const answers: unknown[] = new Array(cases.length);
for (let i = 0; i < cases.length; i++) answers[i] = run(cases[i]!.input);

writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answers));
