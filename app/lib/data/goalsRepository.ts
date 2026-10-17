import { createClient } from "../supabase/client";

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: "active" | "paused" | "completed";
  kind: "milestone" | "measurable";
  current_value: number;
  target_value: number | null;
  unit: string | null;
  revision: number;
  created_at: string;
};

export type Milestone = {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  position: number;
  completed_at: string | null;
  revision: number;
};

export type GoalLink = { id: string; goal_id: string; task_id?: string; habit_id?: string };
export type GoalSnapshot = { goals: Goal[]; milestones: Milestone[]; taskLinks: GoalLink[]; habitLinks: GoalLink[] };
export type GoalInput = Pick<Goal, "title" | "description" | "target_date" | "status" | "kind" | "target_value" | "current_value" | "unit">;

type Client = ReturnType<typeof createClient>;

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function loadGoals(client: Client, userId: string): Promise<GoalSnapshot> {
  const [goals, milestones, taskLinks, habitLinks] = await Promise.all([
    client.from("goals").select("*").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }),
    client.from("goal_milestones").select("*").eq("user_id", userId).is("deleted_at", null).order("position"),
    client.from("goal_task_links").select("id,goal_id,task_id").eq("user_id", userId),
    client.from("goal_habit_links").select("id,goal_id,habit_id").eq("user_id", userId),
  ]);
  for (const result of [goals, milestones, taskLinks, habitLinks]) check(result.error);
  return {
    goals: (goals.data ?? []) as Goal[],
    milestones: (milestones.data ?? []) as Milestone[],
    taskLinks: (taskLinks.data ?? []) as GoalLink[],
    habitLinks: (habitLinks.data ?? []) as GoalLink[],
  };
}

export async function saveGoal(client: Client, userId: string, input: GoalInput, previous?: Goal) {
  if (!previous) {
    const { error } = await client.from("goals").insert({ ...input, id: crypto.randomUUID(), user_id: userId });
    check(error);
    return;
  }
  await changeRecord(client, "goals", userId, previous, input);
}

async function changeRecord(
  client: Client,
  table: "goals" | "goal_milestones",
  userId: string,
  previous: { id: string; revision: number },
  changes: Record<string, unknown>
) {
  const { data, error } = await client.from(table).update(changes)
    .eq("id", previous.id).eq("user_id", userId).eq("revision", previous.revision)
    .is("deleted_at", null).select("id");
  check(error);
  if (!data?.length) throw new Error("This item changed on another device. Reload its latest version before editing.");
}

export async function removeGoal(client: Client, userId: string, goal: Goal) {
  await changeRecord(client, "goals", userId, goal, { deleted_at: new Date().toISOString() });
}

export async function addMilestone(client: Client, userId: string, goalId: string, title: string, position: number) {
  const { error } = await client.from("goal_milestones").insert({ id: crypto.randomUUID(), user_id: userId, goal_id: goalId, title, position });
  check(error);
}

export async function updateMilestone(client: Client, userId: string, milestone: Milestone, changes: { title?: string; completed_at?: string | null; deleted_at?: string }) {
  await changeRecord(client, "goal_milestones", userId, milestone, changes);
}

export async function setGoalLink(client: Client, userId: string, goalId: string, type: "task" | "habit", recordId: string, existing?: GoalLink) {
  const table = type === "task" ? "goal_task_links" : "goal_habit_links";
  if (existing) {
    const { error } = await client.from(table).delete().eq("id", existing.id).eq("user_id", userId);
    check(error);
  } else {
    const { error } = await client.from(table).insert({ id: crypto.randomUUID(), user_id: userId, goal_id: goalId, [`${type}_id`]: recordId });
    check(error);
  }
}
