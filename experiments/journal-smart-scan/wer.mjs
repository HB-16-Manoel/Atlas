import { readFile } from "node:fs/promises";

export function wordErrorRate(reference, hypothesis) {
  const words = (s) => s.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
  const a = words(reference), b = words(hypothesis);
  if (!a.length) throw new Error("Reference transcript has no words.");
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    previous = current;
  }
  return { edits: previous[b.length], words: a.length, wer: previous[b.length] / a.length };
}

if (process.argv[1]?.endsWith("wer.mjs")) {
  if (process.argv.length !== 4) throw new Error("Usage: node wer.mjs reference.txt recognized.txt");
  const result = wordErrorRate(await readFile(process.argv[2], "utf8"), await readFile(process.argv[3], "utf8"));
  console.log(`${result.edits}/${result.words} word edits: ${(result.wer * 100).toFixed(1)}% WER`);
}
