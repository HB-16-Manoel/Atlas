import assert from "node:assert/strict";
import test from "node:test";
import {
  ATLAS_PRODUCTION_ORIGIN,
  atlasAuthOrigin,
  atlasAuthNext,
  atlasRequestAuthOrigin,
} from "../app/lib/auth/urls.ts";

const preview =
  "https://atlas-git-desktop-progress-usability-hb-16-manoel.vercel.app";
test("only explicitly authorized preview origins stay on preview", () => {
  assert.equal(atlasAuthOrigin(preview, preview), preview);
  assert.equal(atlasAuthOrigin(preview, ""), ATLAS_PRODUCTION_ORIGIN);
  assert.equal(
    atlasAuthOrigin(`${preview}.evil.example`, preview),
    ATLAS_PRODUCTION_ORIGIN,
  );
  assert.equal(
    atlasAuthOrigin(preview, `https://attacker.example/${preview}`),
    ATLAS_PRODUCTION_ORIGIN,
  );
  assert.equal(
    atlasAuthOrigin(ATLAS_PRODUCTION_ORIGIN, preview),
    ATLAS_PRODUCTION_ORIGIN,
  );
  assert.equal(
    atlasAuthOrigin("http://localhost:3000", ""),
    "http://localhost:3000",
  );
});
test("callback next stays within the authorized origin", () => {
  assert.equal(
    atlasAuthNext("/auth/update-password", preview),
    "/auth/update-password",
  );
  for (const next of [
    "//attacker.example",
    "/\\attacker.example",
    "https://attacker.example",
  ]) {
    assert.equal(atlasAuthNext(next, preview), "/");
  }
});

test("callback accepts only allowlisted proxy hosts and rejects hosted localhost spoofing", () => {
  const request = (host: string) =>
    new Request("http://localhost:3000/auth/callback", {
      headers: { "x-forwarded-host": host, "x-forwarded-proto": "https" },
    });
  assert.equal(
    atlasRequestAuthOrigin(request(new URL(preview).host), preview, true),
    preview,
  );
  for (const host of [
    "attacker.example",
    "localhost:3000",
    "127.0.0.1:3000",
    "allowed.example,attacker.example",
  ]) {
    assert.equal(
      atlasRequestAuthOrigin(request(host), preview, true),
      ATLAS_PRODUCTION_ORIGIN,
    );
  }
});
