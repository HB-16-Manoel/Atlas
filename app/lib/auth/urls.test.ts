import assert from "node:assert/strict";
import test from "node:test";

import { ATLAS_PRODUCTION_ORIGIN, atlasAuthOrigin } from "./urls.ts";

test("uses the canonical Atlas origin for production and preview deployments", () => {
  assert.equal(atlasAuthOrigin("https://atlas-five-kappa.vercel.app"), ATLAS_PRODUCTION_ORIGIN);
  assert.equal(atlasAuthOrigin("https://atlas-preview-example.vercel.app"), ATLAS_PRODUCTION_ORIGIN);
});

test("keeps localhost callbacks local during development", () => {
  assert.equal(atlasAuthOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(atlasAuthOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
});
