import test from "node:test";
import assert from "node:assert/strict";
import { decodeImage, extractTranscription, recognizeVision, ScanError } from "./vision.mjs";
import { createAppServer } from "./server.mjs";
import { wordErrorRate } from "./wer.mjs";

const image = `data:image/png;base64,${Buffer.from("89504e470d0a1a0a", "hex").toString("base64")}`;
const word = (text, confidence, breakType) => ({
  confidence,
  symbols: [...text].map((character, index) => ({ text: character, ...(index === text.length - 1 ? { property: { detectedBreak: { type: breakType } } } : {}) })),
});
const annotation = { pages: [{ blocks: [{ paragraphs: [
  { words: [word("Today,", .95, "SPACE"), word("I", .98, "SPACE"), word("walked.", .97, "LINE_BREAK"), word("Home", .91, "SPACE"), word("felt", .88, "SPACE"), word("quiet.", .9, "LINE_BREAK")] },
  { words: [word("Later", .91, "SPACE"), word("mystery", .2, "SPACE"), word("returned.", .92, "LINE_BREAK")] },
] }] }] };

test("preserves punctuation, line breaks, and paragraphs and marks low-confidence words", () => {
  assert.deepEqual(extractTranscription(annotation), {
    text: "Today, I walked.\nHome felt quiet.\n\nLater [unclear] returned.",
    uncertainWords: 1,
  });
});

test("rejects unsupported, oversized, and mislabeled uploads", () => {
  assert.throws(() => decodeImage("data:image/heic;base64,YQ=="), ScanError);
  assert.throws(() => decodeImage("data:image/png;base64,YQ=="), /does not match/);
  assert.throws(() => decodeImage(`data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64")}`), /smaller than 5 MB/);
});

test("sends the key only to the provider; never returns it to the caller", async () => {
  const output = await recognizeVision(image, { apiKey: "test-only-key", fetcher: async (url, options) => {
    assert.equal(url, "https://vision.googleapis.com/v1/images:annotate");
    assert.equal(options.headers["x-goog-api-key"], "test-only-key");
    assert.equal(JSON.parse(options.body).requests[0].features[0].type, "DOCUMENT_TEXT_DETECTION");
    return { ok: true, json: async () => ({ responses: [{ fullTextAnnotation: annotation }] }) };
  } });
  assert.ok(!JSON.stringify(output).includes("test-only-key"));
  assert.match(output.text, /Today, I walked/);
});

test("reports absent credentials and upstream provider failures explicitly", async () => {
  await assert.rejects(recognizeVision(image, { apiKey: "" }), /not configured/);
  await assert.rejects(recognizeVision(image, { apiKey: "test", fetcher: async () => ({ ok: false, status: 429 }) }), /at capacity/);
  await assert.rejects(recognizeVision(image, { apiKey: "test", fetcher: async () => ({ ok: true, json: async () => ({ responses: [{}] }) }) }), /No handwriting/);
});

test("local HTTP prototype serves review UI and returns isolated recognition results", async (t) => {
  const server = createAppServer({ recognize: async () => ({ text: "A tested paragraph.", uncertainWords: 0 }) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Editable transcription/);
  const result = await fetch(`${origin}/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image }) });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { text: "A tested paragraph.", uncertainWords: 0 });
});

test("WER ignores case and punctuation but counts a missing word", () => {
  assert.deepEqual(wordErrorRate("Today, I walked home.", "today I walked"), { edits: 1, words: 4, wer: .25 });
});
