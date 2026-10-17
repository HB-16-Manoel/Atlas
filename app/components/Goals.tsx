"use client";

import { useRef, useState } from "react";
import type { Habit, Task } from "./Planning";
import { useGoals } from "../hooks/useGoals";
import { goalProgress } from "../lib/data/goalProgress";
import {
  addMilestone,
  removeGoal,
  saveGoal,
  setGoalLink,
  updateMilestone,
  type Goal,
  type GoalInput,
  type Milestone,
} from "../lib/data/goalsRepository";
import GoalEditor, {
  goalInputClass as inputClass,
  goalButtonClass as buttonClass,
} from "./GoalEditor";

export default function Goals({
  tasks,
  habits,
  onAnalytics,
}: {
  tasks: Task[];
  habits: Habit[];
  onAnalytics: () => void;
}) {
  const { snapshot, loading, error, userId, client, refresh } = useGoals();
  const [editor, setEditor] = useState<{ goal?: Goal } | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState<Record<string, string>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const mutationRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function begin(goal?: Goal) {
    setActionError(null);
    // Keep the revision the user began editing, even if background sync refreshes the list.
    setEditor({ goal });
  }

  async function perform(action: () => Promise<void>) {
    if (!userId || mutationRef.current) return;
    mutationRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Could not save. Please try again.",
      );
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  }

  async function saveEditor(input: GoalInput) {
    if (!userId || !editor || mutationRef.current)
      throw new Error("Another change is saving. Please wait.");
    mutationRef.current = true;
    setBusy(true);
    try {
      await saveGoal(client, userId, input, editor.goal);
      await refresh();
      setEditor(null);
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  }

  const activeTasks = tasks.filter((task) => task.cloudId);
  const activeHabits = habits.filter((habit) => habit.cloudId);

  return (
    <div className="space-y-5 pb-24 md:pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/35">Your outcomes and next steps</p>
          <h2 className="mt-1 text-[1.75rem] font-semibold tracking-tight md:text-3xl">
            Goals
          </h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className={buttonClass} onClick={onAnalytics}>
            Analytics ↑
          </button>
          {userId && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => begin()}
              disabled={busy || loading}
            >
              New goal
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <p role="status" className="py-6 text-sm text-white/50">
          Loading goals…
        </p>
      ) : !userId ? (
        <p className="rounded-xl border border-white/10 p-5 text-sm text-white/50">
          Sign in to create and sync goals across devices.
        </p>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-400/30 p-3 text-sm text-red-200"
            >
              Could not load goals: {error}{" "}
              <button
                type="button"
                onClick={() => void refresh()}
                className="ml-2 underline"
              >
                Try again
              </button>
            </div>
          )}
          {actionError && (
            <p role="alert" className="text-sm text-red-200">
              {actionError}
            </p>
          )}
          {!snapshot.goals.length && !error && (
            <p className="rounded-xl border border-white/10 p-5 text-sm text-white/45">
              No goals yet. Create one to start tracking milestones or a
              measurable target.
            </p>
          )}
          {snapshot.goals.map((goal) => {
            const milestones = snapshot.milestones.filter(
              (item) => item.goal_id === goal.id,
            );
            const progress = goalProgress(goal, milestones);
            const linkedTasks = snapshot.taskLinks.filter(
              (item) => item.goal_id === goal.id,
            );
            const linkedHabits = snapshot.habitLinks.filter(
              (item) => item.goal_id === goal.id,
            );
            return (
              <article
                key={goal.id}
                aria-label={goal.title}
                className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-medium">
                      {goal.title}
                    </h3>
                    <p className="mt-1 text-xs text-white/40">
                      {goal.kind === "milestone"
                        ? "Milestone-based"
                        : "Measurable"}
                      {goal.target_date
                        ? ` · Due ${goal.target_date}`
                        : " · No deadline"}
                    </p>
                  </div>
                  <span className="rounded-md bg-white/[0.05] px-2 py-1 text-xs text-white/60">
                    {goal.status[0].toUpperCase() + goal.status.slice(1)}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/55">
                  <span>{progress.label}</span>
                  <span>{progress.percent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${goal.title} progress`}
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full bg-[#5B7CFF]"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                {goal.kind === "measurable" && (
                  <MeasurableUpdate
                    key={`${goal.id}:${goal.revision}`}
                    goal={goal}
                    busy={busy}
                    onSave={(value) =>
                      void perform(() =>
                        saveGoal(
                          client,
                          userId,
                          {
                            title: goal.title,
                            description: goal.description,
                            target_date: goal.target_date,
                            status: goal.status,
                            kind: goal.kind,
                            target_value: goal.target_value,
                            current_value: value,
                            unit: goal.unit,
                          },
                          goal,
                        ),
                      )
                    }
                  />
                )}
                <details className="mt-4 border-t border-white/[0.07] pt-3">
                  <summary className="w-fit cursor-pointer rounded-md py-2 text-sm text-white/55 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-[#7892FF]">
                    Details{" "}
                    <span className="ml-2 text-xs text-white/30">
                      {goal.kind === "milestone"
                        ? `${milestones.length} milestones · `
                        : ""}
                      {linkedTasks.length + linkedHabits.length} linked
                      activities
                    </span>
                  </summary>
                  <div className="mt-3 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-white/55">
                        {goal.description || "No description added."}
                      </p>
                      <button
                        type="button"
                        className={`${buttonClass} shrink-0`}
                        onClick={() => begin(goal)}
                        disabled={busy}
                      >
                        Edit goal
                      </button>
                    </div>
                    {goal.kind === "milestone" && (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-white/35">
                          Milestones
                        </p>
                        {!milestones.length && (
                          <p className="text-sm text-white/40">
                            Add the steps that will move this goal forward.
                          </p>
                        )}
                        {milestones.map((item) => (
                          <MilestoneRow
                            key={`${item.id}:${item.revision}`}
                            item={item}
                            busy={busy}
                            onChange={(changes) =>
                              void perform(() =>
                                updateMilestone(client, userId, item, changes),
                              )
                            }
                          />
                        ))}
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const title = milestoneTitle[goal.id]?.trim();
                            if (!title) return;
                            void perform(async () => {
                              await addMilestone(
                                client,
                                userId,
                                goal.id,
                                title,
                                milestones.length,
                              );
                              setMilestoneTitle((values) => ({
                                ...values,
                                [goal.id]: "",
                              }));
                            });
                          }}
                        >
                          <input
                            aria-label={`New milestone for ${goal.title}`}
                            className={inputClass}
                            maxLength={160}
                            placeholder="Add a milestone"
                            value={milestoneTitle[goal.id] ?? ""}
                            onChange={(event) =>
                              setMilestoneTitle((values) => ({
                                ...values,
                                [goal.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            className={buttonClass}
                            disabled={busy || !milestoneTitle[goal.id]?.trim()}
                          >
                            Add
                          </button>
                        </form>
                      </div>
                    )}
                    <div className="border-t border-white/[0.07] pt-4">
                      <p className="text-xs uppercase tracking-wide text-white/35">
                        Linked activity
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        Tasks and habits provide context. Only{" "}
                        {goal.kind === "milestone"
                          ? "completed milestones change"
                          : "the current measurable value changes"}{" "}
                        goal progress.
                      </p>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        {renderLinks(
                          "task",
                          goal,
                          linkedTasks,
                          activeTasks.map((task) => ({
                            id: task.cloudId!,
                            label: task.text,
                            detail: task.completed ? "Completed" : task.date,
                          })),
                        )}
                        {renderLinks(
                          "habit",
                          goal,
                          linkedHabits,
                          activeHabits.map((habit) => ({
                            id: habit.cloudId!,
                            label: habit.name,
                            detail: `${habit.completedDates.length} check-ins`,
                          })),
                        )}
                      </div>
                    </div>
                    <div className="border-t border-white/[0.07] pt-3">
                      <button
                        type="button"
                        className="min-h-10 rounded-lg px-2 text-xs text-red-200/65 hover:bg-red-400/5 focus-visible:outline-2 focus-visible:outline-[#7892FF]"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Delete ${goal.title}?`))
                            void perform(() =>
                              removeGoal(client, userId, goal),
                            );
                        }}
                      >
                        Delete goal
                      </button>
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </>
      )}
      {editor && userId && (
        <GoalEditor
          goal={editor.goal}
          onSave={saveEditor}
          onDismiss={() => {
            if (!mutationRef.current) setEditor(null);
          }}
        />
      )}
    </div>
  );

  function renderLinks(
    type: "task" | "habit",
    goal: Goal,
    links: {
      id: string;
      goal_id: string;
      task_id?: string;
      habit_id?: string;
    }[],
    options: { id: string; label: string; detail: string }[],
  ) {
    const key = type === "task" ? "task_id" : "habit_id";
    const linked = options.filter((option) =>
      links.some((link) => link[key] === option.id),
    );
    const available = options.filter(
      (option) => !links.some((link) => link[key] === option.id),
    );
    return (
      <div className="min-w-0">
        <p className="mb-2 text-sm text-white/65">
          {type === "task" ? "Tasks" : "Habits"}
        </p>
        {linked.map((option) => (
          <div
            key={option.id}
            className="flex min-w-0 items-center justify-between gap-2 py-1 text-sm"
          >
            <span
              className="min-w-0 truncate text-white/60"
              title={option.label}
            >
              {option.label}{" "}
              <span className="text-xs text-white/30">· {option.detail}</span>
            </span>
            <button
              type="button"
              className="min-h-11 shrink-0 px-2 text-xs text-white/40 hover:text-white"
              aria-label={`Unlink ${option.label}`}
              disabled={busy}
              onClick={() =>
                void perform(() =>
                  setGoalLink(
                    client,
                    userId!,
                    goal.id,
                    type,
                    option.id,
                    links.find((link) => link[key] === option.id),
                  ),
                )
              }
            >
              Unlink
            </button>
          </div>
        ))}
        <select
          aria-label={`Link an existing ${type} to ${goal.title}`}
          className={`${inputClass} mt-1`}
          value=""
          disabled={busy || !available.length}
          onChange={(event) => {
            if (event.target.value)
              void perform(() =>
                setGoalLink(client, userId!, goal.id, type, event.target.value),
              );
          }}
        >
          <option value="">
            {available.length ? `Link ${type}…` : `No ${type}s available`}
          </option>
          {available.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
}
function MilestoneRow({
  item,
  busy,
  onChange,
}: {
  item: Milestone;
  busy: boolean;
  onChange: (change: {
    title?: string;
    completed_at?: string | null;
    deleted_at?: string;
  }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        type="checkbox"
        className="h-5 w-5 accent-[#5B7CFF]"
        aria-label={`Complete ${item.title}`}
        checked={Boolean(item.completed_at)}
        disabled={busy}
        onChange={() =>
          onChange({
            completed_at: item.completed_at ? null : new Date().toISOString(),
          })
        }
      />
      {editing ? (
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) {
              onChange({ title: title.trim() });
              setEditing(false);
            }
          }}
        >
          <input
            aria-label="Milestone title"
            autoFocus
            required
            maxLength={160}
            className={inputClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className={buttonClass} disabled={busy}>
            Save
          </button>
        </form>
      ) : (
        <span
          className={`min-w-0 flex-1 break-words text-sm ${item.completed_at ? "text-white/35 line-through" : "text-white/70"}`}
        >
          {item.title}
        </span>
      )}
      <button
        type="button"
        className="min-h-11 px-1 text-xs text-white/40"
        disabled={busy}
        onClick={() => {
          if (editing) {
            setTitle(item.title);
            setEditing(false);
          } else setEditing(true);
        }}
      >
        {editing ? "Cancel" : "Edit"}
      </button>
      <button
        type="button"
        className="min-h-11 px-1 text-xs text-white/40"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Delete milestone ${item.title}?`))
            onChange({ deleted_at: new Date().toISOString() });
        }}
      >
        Delete
      </button>
    </div>
  );
}

function MeasurableUpdate({
  goal,
  busy,
  onSave,
}: {
  goal: Goal;
  busy: boolean;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState(goal.current_value.toString());
  return (
    <details className="mt-3">
      <summary className="w-fit cursor-pointer rounded-md py-2 text-sm text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-[#7892FF]">
        Update value
      </summary>
      <form
        className="mt-2 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed >= 0) onSave(parsed);
        }}
      >
        <label className="text-xs text-white/50">
          Current value
          <input
            type="number"
            min="0"
            step="0.01"
            required
            className={`${inputClass} mt-1 w-32`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <span className="pb-3 text-xs text-white/40">{goal.unit}</span>
        <button className={buttonClass} disabled={busy}>
          Update
        </button>
      </form>
    </details>
  );
}
