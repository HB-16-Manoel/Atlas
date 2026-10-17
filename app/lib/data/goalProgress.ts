import type { Goal, Milestone } from "./goalsRepository";

export function goalProgress(goal: Goal, milestones: Milestone[]) {
  if (goal.kind === "milestone") {
    const total = milestones.length;
    return { percent: total ? Math.round(100 * milestones.filter((item) => item.completed_at).length / total) : 0,
      label: `${milestones.filter((item) => item.completed_at).length} / ${total} milestones` };
  }
  const target = Number(goal.target_value) || 0;
  const current = Number(goal.current_value) || 0;
  return { percent: target > 0 ? Math.min(100, Math.round(100 * current / target)) : 0,
    label: `${current} / ${target} ${goal.unit ?? ""}`.trim() };
}
