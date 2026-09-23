import assert from "node:assert/strict";
import test from "node:test";

import {
  isFreshJwtIssuedAtFutureError,
  withFreshJwtRecovery,
} from "./freshJwtRecovery.ts";

test("recognizes only the proven fresh-JWT PostgREST failure", () => {
  assert.equal(
    isFreshJwtIssuedAtFutureError({
      code: "PGRST303",
      message: "JWT issued at future",
    }),
    true
  );
  assert.equal(
    isFreshJwtIssuedAtFutureError({
      code: "PGRST303",
      message: "JWT claims validation failed",
    }),
    false
  );
  assert.equal(
    isFreshJwtIssuedAtFutureError({
      code: "42501",
      message: "permission denied",
    }),
    false
  );
});

test("rechecks a first-load batch once after the fresh-JWT failure", async () => {
  let calls = 0;
  const waits: number[] = [];

  const result = await withFreshJwtRecovery(
    async () => {
      calls += 1;
      return calls === 1
        ? [{ error: { code: "PGRST303", message: "JWT issued at future" } }]
        : [{ error: null }];
    },
    (rows) => rows.map((row) => row.error),
    async (milliseconds) => {
      waits.push(milliseconds);
    }
  );

  assert.equal(calls, 2);
  assert.deepEqual(waits, [750]);
  assert.equal(result[0].error, null);
});

test("does not retry or hide genuine cloud errors", async () => {
  let calls = 0;
  const failure = { code: "42501", message: "permission denied" };

  const result = await withFreshJwtRecovery(
    async () => {
      calls += 1;
      return [{ error: failure }];
    },
    (rows) => rows.map((row) => row.error),
    async () => {
      throw new Error("wait should not run");
    }
  );

  assert.equal(calls, 1);
  assert.equal(result[0].error, failure);
});

test("stops after the single bounded recovery attempt", async () => {
  let calls = 0;
  const failure = { code: "PGRST303", message: "JWT issued at future" };

  const result = await withFreshJwtRecovery(
    async () => {
      calls += 1;
      return [{ error: failure }];
    },
    (rows) => rows.map((row) => row.error),
    async () => undefined
  );

  assert.equal(calls, 2);
  assert.equal(result[0].error, failure);
});
