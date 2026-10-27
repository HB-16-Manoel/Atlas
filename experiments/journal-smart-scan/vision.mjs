const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export class ScanError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function decodeImage(dataUrl) {
  const match = DATA_URL.exec(dataUrl ?? "");
  if (!match) throw new ScanError("Choose a JPEG, PNG, or WebP image. HEIC photos need conversion first.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    throw new ScanError("The image must be smaller than 5 MB. Try a clearer, smaller photo.", 413);
  }
  const kind = match[1];
  const valid = kind === "jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : kind === "png"
      ? bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new ScanError("The file does not match its image format.");
  return bytes.toString("base64");
}

export function extractTranscription(annotation) {
  const pages = annotation?.pages ?? [];
  const paragraphs = [];
  let uncertainWords = 0;
  for (const page of pages) {
    for (const block of page.blocks ?? []) {
      if (block.blockType && block.blockType !== "TEXT") continue;
      for (const paragraph of block.paragraphs ?? []) {
        let text = "";
        for (const word of paragraph.words ?? []) {
          const symbols = word.symbols ?? [];
          const letters = symbols.map((symbol) => symbol.text ?? "").join("");
          if (!letters) continue;
          // This is a review cue, not a calibrated probability of correctness.
          const uncertain = typeof word.confidence === "number" && word.confidence < 0.45;
          text += uncertain ? "[unclear]" : letters;
          if (uncertain) uncertainWords++;
          const lastBreak = symbols.at(-1)?.property?.detectedBreak?.type;
          text += lastBreak === "LINE_BREAK" || lastBreak === "EOL_SURE_SPACE" ? "\n" : " ";
        }
        if (text.trim()) paragraphs.push(text.replace(/[ \t]+\n/g, "\n").trim());
      }
    }
  }
  return { text: paragraphs.join("\n\n"), uncertainWords };
}

export async function recognizeVision(dataUrl, { apiKey = process.env.ATLAS_VISION_API_KEY, fetcher = fetch } = {}) {
  if (!apiKey) throw new ScanError("Vision API is not configured on this local server.", 503);
  const content = decodeImage(dataUrl);
  let response;
  try {
    response = await fetcher("https://vision.googleapis.com/v1/images:annotate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ requests: [{ image: { content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ScanError("The recognition service could not be reached. Please try again.", 502);
  }
  if (!response.ok) {
    throw new ScanError(
      response.status === 429 ? "Recognition is temporarily at capacity. Please try later."
        : response.status === 401 || response.status === 403 ? "Vision API access is unavailable. Check the server configuration."
          : "Recognition failed. Please try again or use a clearer photo.",
      502,
    );
  }
  let result;
  try { result = await response.json(); } catch { throw new ScanError("The recognition service returned an invalid response.", 502); }
  const first = result.responses?.[0];
  if (first?.error) throw new ScanError("Recognition could not process this image. Try a clearer photo.", 502);
  const output = extractTranscription(first?.fullTextAnnotation);
  if (!output.text) throw new ScanError("No handwriting was detected. Try a sharper photo in good light.", 422);
  return output;
}
