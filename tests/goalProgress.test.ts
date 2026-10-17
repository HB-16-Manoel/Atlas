import assert from "node:assert/strict";
import test from "node:test";
import { goalProgress } from "../app/lib/data/goalProgress.ts";
import type { Goal, Milestone } from "../app/lib/data/goalsRepository.ts";

const goal = { kind: "milestone", current_value: 0, target_value: null, unit: null } as Goal;
const milestone = (done: boolean) => ({ completed_at: done ? "2026-10-17T00:00:00Z" : null }) as Milestone;

test("milestones calculate only milestone completion", () => {
  assert.deepEqual(goalProgress(goal, []), { percent: 0, label: "0 / 0 milestones" });
  assert.deepEqual(goalProgress(goal, [milestone(true), milestone(false)]), { percent: 50, label: "1 / 2 milestones" });
});

test("measurable targets calculate and cap progress", () => {
  const measurable = { ...goal, kind: "measurable", target_value: 12, current_value: 3, unit: "books" } as Goal;
  assert.deepEqual(goalProgress(measurable, [milestone(true)]), { percent: 25, label: "3 / 12 books" });
  assert.deepEqual(goalProgress({ ...measurable, current_value: 15 }, []), { percent: 100, label: "15 / 12 books" });
});
