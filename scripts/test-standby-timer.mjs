import assert from "node:assert/strict";
import { initialTimer, recover, toggleTimer, elapsedAt } from "../app/standby/timer.ts";

const started = toggleTimer({ ...initialTimer, countdown: 1 }, 1000);
const paused = toggleTimer(started, 6000);
assert.equal(elapsedAt(paused, 16000), 5000);
const resumed = toggleTimer(paused, 16000);
assert.equal(elapsedAt(resumed, 21000), 10000);
assert.equal(recover(resumed, 3_600_000).finished, true);

const work = toggleTimer({ ...initialTimer, mode: "pomodoro", work: 1, break: 1 }, 1000);
const recovered = recover(work, 3_600_000);
assert.equal(recovered.phase, "break");
assert.equal(recovered.started, null);
assert.equal(recovered.elapsed, 0);
assert.deepEqual(recover(recovered, 9_000_000), recovered);
assert.equal(recover(toggleTimer(recovered, 9_000_000), 9_060_000).phase, "work");

const stopwatch = toggleTimer({ ...initialTimer, mode: "stopwatch" }, 1000);
assert.equal(elapsedAt(recover(stopwatch, 3_601_000), 3_601_000), 3_600_000);
console.log("PASS: countdown, stopwatch, pause/resume, and Pomodoro recovery");
