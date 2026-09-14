import type { SupabaseClient } from "@supabase/supabase-js";

import type { JournalEntry } from "../../components/Journal";
import type {
  AtlasEvent,
  Habit,
  Task,
} from "../../components/Planning";

export type CloudTaskHistoryEvent = {
  id: string;
  cloudId?: string;
  revision?: number;
  cloudUpdatedAt?: string;
  taskId: number;
  taskCloudId?: string;
  taskText: string;
  taskDate: string;
  type: "created" | "completed" | "uncompleted" | "deleted";
  timestamp: string;
};

export type AtlasSnapshot = {
  tasks: Task[];
  habits: Habit[];
  events: AtlasEvent[];
  journalEntries: JournalEntry[];
  taskHistory: CloudTaskHistoryEvent[];
};

export class CloudConflictError extends Error {
  constructor(entity: string) {
    super(`${entity} changed on another device before this update finished.`);
    this.name = "CloudConflictError";
  }
}

function stableNumericId(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash) + 1;
}

function localId(legacyId: unknown, cloudId: string) {
  const parsed = Number(legacyId);
  return Number.isSafeInteger(parsed) ? parsed : stableNumericId(cloudId);
}

function requireCloudId(record: { cloudId?: string }, entity: string) {
  if (!record.cloudId) {
    throw new Error(`${entity} is missing its cloud UUID.`);
  }

  return record.cloudId;
}

function taskShape(task: Task) {
  return {
    cloudId: task.cloudId,
    id: task.id,
    text: task.text,
    completed: task.completed,
    date: task.date,
    order: task.order,
    carryOver: task.carryOver !== false,
    carriedFromId: task.carriedFromId ?? null,
    carriedToId: task.carriedToId ?? null,
  };
}

function habitShape(habit: Habit) {
  return {
    cloudId: habit.cloudId,
    id: habit.id,
    name: habit.name,
    order: habit.order,
    createdAt: habit.createdAt,
    completedDates: [...habit.completedDates].sort(),
  };
}

function eventShape(event: AtlasEvent) {
  return {
    cloudId: event.cloudId,
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time ?? null,
    repeatYearly: event.repeatYearly,
  };
}

function journalShape(entry: JournalEntry) {
  return {
    cloudId: entry.cloudId,
    date: entry.date,
    text: entry.text,
    mood: entry.mood,
    energy: entry.energy,
    rating: entry.rating,
  };
}

function activityShape(event: CloudTaskHistoryEvent) {
  return {
    cloudId: event.cloudId,
    id: event.id,
    taskCloudId: event.taskCloudId ?? null,
    taskId: event.taskId,
    taskText: event.taskText,
    taskDate: event.taskDate,
    type: event.type,
    timestamp: event.timestamp,
  };
}

function sortedShapes<T extends { cloudId?: string }>(
  records: T[],
  shape: (record: T) => unknown
) {
  return records
    .map(shape)
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right))
    );
}

export function snapshotsMatch(left: AtlasSnapshot, right: AtlasSnapshot) {
  return JSON.stringify({
    tasks: sortedShapes(left.tasks, taskShape),
    habits: sortedShapes(left.habits, habitShape),
    events: sortedShapes(left.events, eventShape),
    journalEntries: sortedShapes(left.journalEntries, journalShape),
    taskHistory: sortedShapes(left.taskHistory, activityShape),
  }) === JSON.stringify({
    tasks: sortedShapes(right.tasks, taskShape),
    habits: sortedShapes(right.habits, habitShape),
    events: sortedShapes(right.events, eventShape),
    journalEntries: sortedShapes(right.journalEntries, journalShape),
    taskHistory: sortedShapes(right.taskHistory, activityShape),
  });
}

function changed<T>(left: T, right: T) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function indexByCloudId<T extends { cloudId?: string }>(records: T[]) {
  return new Map(
    records
      .filter((record): record is T & { cloudId: string } => Boolean(record.cloudId))
      .map((record) => [record.cloudId, record] as const)
  );
}

async function assertUpdated(
  result: PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>,
  entity: string
) {
  const { data, error } = await result;

  if (error) throw new Error(error.message);
  if (!data) throw new CloudConflictError(entity);
}

export function createCloudAtlasRepository(
  supabase: SupabaseClient,
  userId: string
) {
  async function loadSnapshot(): Promise<AtlasSnapshot> {
    const [tasksResult, habitsResult, completionsResult, eventsResult, journalResult, activityResult] =
      await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", userId).is("deleted_at", null).order("task_date").order("position"),
        supabase.from("habits").select("*").eq("user_id", userId).is("deleted_at", null).order("position"),
        // Tombstones are loaded as metadata so re-checking a date revives the
        // existing row instead of racing a unique constraint with a new UUID.
        supabase.from("habit_completions").select("*").eq("user_id", userId).order("completion_date"),
        supabase.from("events").select("*").eq("user_id", userId).is("deleted_at", null).order("event_date"),
        supabase.from("journal_entries").select("*").eq("user_id", userId).is("deleted_at", null).order("entry_date"),
        supabase.from("task_activity").select("*").eq("user_id", userId).is("deleted_at", null).order("occurred_at"),
      ]);

    for (const result of [
      tasksResult,
      habitsResult,
      completionsResult,
      eventsResult,
      journalResult,
      activityResult,
    ]) {
      if (result.error) throw result.error;
    }

    const taskRows = tasksResult.data ?? [];
    const taskRowsById = new Map(taskRows.map((row) => [row.id as string, row] as const));
    const taskLocalIds = new Map(
      taskRows.map((row) => [row.id as string, localId(row.legacy_id, row.id as string)] as const)
    );

    const tasks: Task[] = taskRows.map((row) => {
      const carriedFrom = row.carried_from_id
        ? taskRowsById.get(row.carried_from_id as string)
        : null;
      const carriedTo = row.carried_to_id
        ? taskRowsById.get(row.carried_to_id as string)
        : null;

      return {
        id: localId(row.legacy_id, row.id as string),
        cloudId: row.id as string,
        revision: Number(row.revision),
        cloudUpdatedAt: row.updated_at as string,
        text: row.title as string,
        completed: Boolean(row.completed_at),
        completedAt: (row.completed_at as string | null) ?? undefined,
        date: row.task_date as string,
        order: Number(row.position),
        carryOver: row.carry_over !== false,
        carriedFrom: (carriedFrom?.task_date as string | undefined) ?? undefined,
        carriedTo: (carriedTo?.task_date as string | undefined) ?? undefined,
        carriedFromId: (row.carried_from_id as string | null) ?? undefined,
        carriedToId: (row.carried_to_id as string | null) ?? undefined,
      };
    });

    const completionRows = completionsResult.data ?? [];
    const completionsByHabit = new Map<string, typeof completionRows>();

    for (const completion of completionRows) {
      const habitId = completion.habit_id as string;
      completionsByHabit.set(habitId, [
        ...(completionsByHabit.get(habitId) ?? []),
        completion,
      ]);
    }

    const habits: Habit[] = (habitsResult.data ?? []).map((row) => {
      const completions = completionsByHabit.get(row.id as string) ?? [];

      return {
        id: localId(row.legacy_id, row.id as string),
        cloudId: row.id as string,
        revision: Number(row.revision),
        cloudUpdatedAt: row.updated_at as string,
        name: row.name as string,
        order: Number(row.position),
        createdAt: row.started_on as string,
        completedDates: completions
          .filter((completion) => !completion.deleted_at)
          .map((completion) => completion.completion_date as string),
        completionMeta: Object.fromEntries(
          completions.map((completion) => [
            completion.completion_date as string,
            {
              id: completion.id as string,
              revision: Number(completion.revision),
              deletedAt: (completion.deleted_at as string | null) ?? undefined,
            },
          ])
        ),
      };
    });

    const events: AtlasEvent[] = (eventsResult.data ?? []).map((row) => ({
      id: localId(row.legacy_id, row.id as string),
      cloudId: row.id as string,
      revision: Number(row.revision),
      cloudUpdatedAt: row.updated_at as string,
      title: row.title as string,
      date: row.event_date as string,
      time: (row.event_time as string | null)?.slice(0, 5) || undefined,
      repeatYearly: row.repeat_yearly === true,
    }));

    const journalEntries: JournalEntry[] = (journalResult.data ?? []).map((row) => ({
      cloudId: row.id as string,
      revision: Number(row.revision),
      cloudUpdatedAt: row.updated_at as string,
      date: row.entry_date as string,
      text: row.body as string,
      mood: row.mood as JournalEntry["mood"],
      energy: row.energy as JournalEntry["energy"],
      rating: row.rating === null ? null : Number(row.rating),
      updatedAt: row.updated_at as string,
    }));

    const taskHistory: CloudTaskHistoryEvent[] = (activityResult.data ?? []).map((row) => ({
      id: (row.legacy_id as string | null) ?? (row.id as string),
      cloudId: row.id as string,
      revision: Number(row.revision),
      cloudUpdatedAt: row.updated_at as string,
      taskId:
        taskLocalIds.get(row.task_id as string) ??
        stableNumericId((row.task_id as string | null) ?? (row.id as string)),
      taskCloudId: (row.task_id as string | null) ?? undefined,
      taskText: row.task_title as string,
      taskDate: row.task_date as string,
      type: row.activity_type as CloudTaskHistoryEvent["type"],
      timestamp: row.occurred_at as string,
    }));

    return { tasks, habits, events, journalEntries, taskHistory };
  }

  async function syncTasks(previous: Task[], current: Task[]) {
    const previousById = indexByCloudId(previous);
    const currentById = indexByCloudId(current);
    const additions = current.filter((task) => !previousById.has(requireCloudId(task, "Task")));

    await Promise.all(
      additions.map(async (task) => {
        const cloudId = requireCloudId(task, "Task");
        const { error } = await supabase.from("tasks").insert({
          id: cloudId,
          user_id: userId,
          legacy_id: task.id,
          title: task.text,
          task_date: task.date,
          position: task.order,
          completed_at: task.completed ? task.completedAt ?? new Date().toISOString() : null,
          carry_over: task.carryOver !== false,
          carried_from_id: task.carriedFromId ?? null,
          carried_to_id: task.carriedToId ?? null,
        });

        if (error) throw error;
      })
    );

    await Promise.all(
      current.map(async (task) => {
        const cloudId = requireCloudId(task, "Task");
        const before = previousById.get(cloudId);

        if (!before || !changed(taskShape(before), taskShape(task))) return;

        await assertUpdated(
          supabase
            .from("tasks")
            .update({
              title: task.text,
              task_date: task.date,
              position: task.order,
              completed_at: task.completed
                ? before.completedAt ?? task.completedAt ?? new Date().toISOString()
                : null,
              carry_over: task.carryOver !== false,
              carried_from_id: task.carriedFromId ?? null,
              carried_to_id: task.carriedToId ?? null,
            })
            .eq("id", cloudId)
            .eq("revision", before.revision ?? 1)
            .is("deleted_at", null)
            .select("id")
            .maybeSingle(),
          "Task"
        );
      })
    );

    await Promise.all(
      previous.map(async (task) => {
        const cloudId = requireCloudId(task, "Task");
        if (currentById.has(cloudId)) return;

        await assertUpdated(
          supabase
            .from("tasks")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", cloudId)
            .eq("revision", task.revision ?? 1)
            .is("deleted_at", null)
            .select("id")
            .maybeSingle(),
          "Task"
        );
      })
    );
  }

  async function syncHabits(previous: Habit[], current: Habit[]) {
    const previousById = indexByCloudId(previous);
    const currentById = indexByCloudId(current);

    await Promise.all(
      current.map(async (habit) => {
        const cloudId = requireCloudId(habit, "Habit");
        const before = previousById.get(cloudId);

        if (!before) {
          const { error } = await supabase.from("habits").insert({
            id: cloudId,
            user_id: userId,
            legacy_id: habit.id,
            name: habit.name,
            position: habit.order,
            started_on: habit.createdAt.slice(0, 10),
          });
          if (error) throw error;
          return;
        }

        const beforeWithoutDates = { ...habitShape(before), completedDates: [] };
        const currentWithoutDates = { ...habitShape(habit), completedDates: [] };
        if (!changed(beforeWithoutDates, currentWithoutDates)) return;

        await assertUpdated(
          supabase
            .from("habits")
            .update({ name: habit.name, position: habit.order, started_on: habit.createdAt.slice(0, 10) })
            .eq("id", cloudId)
            .eq("revision", before.revision ?? 1)
            .is("deleted_at", null)
            .select("id")
            .maybeSingle(),
          "Habit"
        );
      })
    );

    for (const habit of current) {
      const cloudId = requireCloudId(habit, "Habit");
      const before = previousById.get(cloudId);
      const beforeDates = new Set(before?.completedDates ?? []);
      const currentDates = new Set(habit.completedDates);

      await Promise.all(
        [...currentDates]
          .filter((date) => !beforeDates.has(date))
          .map(async (date) => {
            const existing = before?.completionMeta?.[date];

            if (existing) {
              await assertUpdated(
                supabase
                  .from("habit_completions")
                  .update({ deleted_at: null })
                  .eq("id", existing.id)
                  .eq("revision", existing.revision)
                  .select("id")
                  .maybeSingle(),
                "Habit completion"
              );
              return;
            }

            const { error } = await supabase.from("habit_completions").insert({
                id: crypto.randomUUID(),
                user_id: userId,
                habit_id: cloudId,
                completion_date: date,
                legacy_id: `${habit.id}:${date}`,
              });
            if (error) throw error;
          })
      );

      await Promise.all(
        [...beforeDates]
          .filter((date) => !currentDates.has(date))
          .map(async (date) => {
            const meta = before?.completionMeta?.[date];
            if (!meta) return;

            await assertUpdated(
              supabase
                .from("habit_completions")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", meta.id)
                .eq("revision", meta.revision)
                .is("deleted_at", null)
                .select("id")
                .maybeSingle(),
              "Habit completion"
            );
          })
      );
    }

    await Promise.all(
      previous.map(async (habit) => {
        const cloudId = requireCloudId(habit, "Habit");
        if (currentById.has(cloudId)) return;

        await assertUpdated(
          supabase
            .from("habits")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", cloudId)
            .eq("revision", habit.revision ?? 1)
            .is("deleted_at", null)
            .select("id")
            .maybeSingle(),
          "Habit"
        );
      })
    );
  }

  async function syncEvents(previous: AtlasEvent[], current: AtlasEvent[]) {
    const previousById = indexByCloudId(previous);
    const currentById = indexByCloudId(current);

    await Promise.all(
      current.map(async (event) => {
        const cloudId = requireCloudId(event, "Event");
        const before = previousById.get(cloudId);
        const payload = {
          title: event.title,
          event_date: event.date,
          event_time: event.time || null,
          repeat_yearly: event.repeatYearly,
        };

        if (!before) {
          const { error } = await supabase.from("events").insert({
            id: cloudId,
            user_id: userId,
            legacy_id: event.id,
            ...payload,
          });
          if (error) throw error;
          return;
        }

        if (!changed(eventShape(before), eventShape(event))) return;

        await assertUpdated(
          supabase
            .from("events")
            .update(payload)
            .eq("id", cloudId)
            .eq("revision", before.revision ?? 1)
            .is("deleted_at", null)
            .select("id")
            .maybeSingle(),
          "Event"
        );
      })
    );

    await Promise.all(
      previous.map(async (event) => {
        const cloudId = requireCloudId(event, "Event");
        if (currentById.has(cloudId)) return;
        await assertUpdated(
          supabase
            .from("events")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", cloudId)
            .eq("revision", event.revision ?? 1)
            .is("deleted_at", null)
            .select("id")
            .maybeSingle(),
          "Event"
        );
      })
    );
  }

  async function syncJournal(previous: JournalEntry[], current: JournalEntry[]) {
    const previousById = indexByCloudId(previous);
    const currentById = indexByCloudId(current);

    await Promise.all(
      current.map(async (entry) => {
        const cloudId = requireCloudId(entry, "Journal entry");
        const before = previousById.get(cloudId);
        const payload = {
          entry_date: entry.date,
          body: entry.text,
          mood: entry.mood,
          energy: entry.energy,
          rating: entry.rating,
        };

        if (!before) {
          const { error } = await supabase.from("journal_entries").insert({
            id: cloudId,
            user_id: userId,
            legacy_id: entry.date,
            ...payload,
          });
          if (error) throw error;
          return;
        }

        if (!changed(journalShape(before), journalShape(entry))) return;
        await assertUpdated(
          supabase
            .from("journal_entries")
            .update(payload)
            .eq("id", cloudId)
            .eq("revision", before.revision ?? 1)
            .is("deleted_at", null)
            .select("id")
            .maybeSingle(),
          "Journal entry"
        );
      })
    );

    await Promise.all(
      previous.map(async (entry) => {
        const cloudId = requireCloudId(entry, "Journal entry");
        if (currentById.has(cloudId)) return;
        await assertUpdated(
          supabase
            .from("journal_entries")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", cloudId)
            .eq("revision", entry.revision ?? 1)
            .is("deleted_at", null)
            .select("id")
            .maybeSingle(),
          "Journal entry"
        );
      })
    );
  }

  async function syncTaskActivity(
    previous: CloudTaskHistoryEvent[],
    current: CloudTaskHistoryEvent[]
  ) {
    const previousById = indexByCloudId(previous);

    await Promise.all(
      current.map(async (event) => {
        const cloudId = requireCloudId(event, "Task activity");
        if (previousById.has(cloudId)) return;

        const { error } = await supabase.from("task_activity").insert({
          id: cloudId,
          user_id: userId,
          task_id: event.taskCloudId ?? null,
          legacy_id: event.id,
          activity_type: event.type,
          task_title: event.taskText,
          task_date: event.taskDate,
          occurred_at: event.timestamp,
        });
        if (error) throw error;
      })
    );
  }

  return {
    async getAccountStatus() {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },

    loadSnapshot,

    async syncSnapshot(previous: AtlasSnapshot, current: AtlasSnapshot) {
      await syncTasks(previous.tasks, current.tasks);
      await syncHabits(previous.habits, current.habits);
      await Promise.all([
        syncEvents(previous.events, current.events),
        syncJournal(previous.journalEntries, current.journalEntries),
      ]);
      await syncTaskActivity(previous.taskHistory, current.taskHistory);
      return loadSnapshot();
    },
  };
}
