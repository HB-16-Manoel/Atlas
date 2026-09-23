import assert from "node:assert/strict";
import test from "node:test";

import {
  ATLAS_PRODUCTION_ORIGIN,
  atlasAuthOrigin,
  atlasGoogleOAuthCallback,
} from "./urls.ts";

test("uses the canonical Atlas origin for production and preview deployments", () => {
  assert.equal(atlasAuthOrigin("https://atlas-five-kappa.vercel.app"), ATLAS_PRODUCTION_ORIGIN);
  assert.equal(atlasAuthOrigin("https://atlas-preview-example.vercel.app"), ATLAS_PRODUCTION_ORIGIN);
});

test("keeps localhost callbacks local during development", () => {
  assert.equal(atlasAuthOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(atlasAuthOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
});

test("uses the exact allow-listed callback for Google OAuth", () => {
  assert.equal(
    atlasGoogleOAuthCallback("https://atlas-five-kappa.vercel.app"),
    "https://atlas-five-kappa.vercel.app/auth/callback"
  );
  assert.equal(
    atlasGoogleOAuthCallback("https://atlas-preview-example.vercel.app"),
    "https://atlas-five-kappa.vercel.app/auth/callback"
  );
  assert.equal(
    atlasGoogleOAuthCallback("http://localhost:3000"),
    "http://localhost:3000/auth/callback"
  );
});
