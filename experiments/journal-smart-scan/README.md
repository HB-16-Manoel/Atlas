# Atlas Journal Smart Scan — isolated local prototype

This is an experiment, not an Atlas feature. It does not modify Journal, authenticate users, persist photos, or save entries. It listens on the local machine only.

## Run

Requires Node.js 20+ and a **Google Cloud Vision API key** restricted to Cloud Vision API. Google Cloud must have Vision enabled and billing configured; the first 1,000 Document Text Detection images per month currently have no Vision API charge, but enabling billing is still a decision for the project owner. No credential is present in the repository or deployment. Never use a browser-restricted key in this server, put a key in `NEXT_PUBLIC_*`, or commit it.

Windows Command Prompt:

```cmd
set ATLAS_VISION_API_KEY=YOUR_RESTRICTED_KEY
node experiments\journal-smart-scan\server.mjs
```

macOS/Linux:

```sh
ATLAS_VISION_API_KEY=YOUR_RESTRICTED_KEY node experiments/journal-smart-scan/server.mjs
```

Open `http://127.0.0.1:4179` on the same computer. Upload a camera photo transferred from a phone, edit the result, and download a `.txt` copy. JPEG, PNG, and WebP are supported; convert HEIC locally before upload. Files must be below 5 MiB. If no key is configured, the prototype shows a clear configuration error and makes no external request. The provider receives the image during recognition; Atlas does not retain the photo. Keep the browser tab private if using personal pages.

## Google Cloud setup for an approved evaluation

1. In Google Cloud Console choose an existing project or create a project, enable **Cloud Vision API**, and review its billing settings and budget alerts. No project or paid infrastructure was created in Phase 1.
2. In **APIs & Services → Credentials**, create an API key and restrict its **API restrictions** to **Cloud Vision API**. Keep the key on the local server; do not place it in Atlas's public environment variables or a commit.
3. Set `ATLAS_VISION_API_KEY` locally as shown above. Test non-sensitive sample images first. If Google requires billing for the project, explicitly review that before proceeding.

## Tests and evaluation

```sh
node --test experiments/journal-smart-scan/scan.test.mjs
node experiments/journal-smart-scan/wer.mjs reference.txt recognized.txt
```

WER lower is better. The WER tool ignores punctuation and case, and counts substitutions, deletions, and insertions divided by reference words. It can exceed 100%. Reference transcripts must be checked manually from the page, not taken from the OCR output. For a genuine accuracy evaluation, use user-consented, non-sensitive page photos covering clear print, cursive, irregular writing, multiple paragraphs, angle, shadows, and edits/cross-outs; annotate each before scanning. Keep the photos out of Git and avoid uploading real diary pages to a provider until privacy terms and retention are reviewed.

Provider responses are treated as suggestions: a `word.confidence` below 0.45 becomes `[unclear]`, but high confidence does not guarantee correctness, and the threshold is not calibrated. Do not save without human review. Raw images and provider responses are never written by the prototype. The local HTTP interface has no Atlas authentication and must not be exposed to the public internet.
