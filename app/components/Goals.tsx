"use client";

import { useState } from "react";
import type { Habit, Task } from "./Planning";
import { useGoals } from "../hooks/useGoals";
import { goalProgress } from "../lib/data/goalProgress";
import { addMilestone, removeGoal, saveGoal, setGoalLink, updateMilestone, type Goal, type GoalInput, type Milestone } from "../lib/data/goalsRepository";

type Form = { title: string; description: string; targetDate: string; status: Goal["status"]; kind: Goal["kind"]; target: string; current: string; unit: string };
const blank: Form = { title: "", description: "", targetDate: "", status: "active", kind: "milestone", target: "", current: "0", unit: "" };
const inputClass = "min-h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-[#5B7CFF]/60";
const buttonClass = "min-h-11 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06] disabled:opacity-40";

export default function Goals({ tasks, habits, onAnalytics }: { tasks: Task[]; habits: Habit[]; onAnalytics: () => void }) {
  const { snapshot, loading, error, userId, client, refresh } = useGoals();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [milestoneTitle, setMilestoneTitle] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function begin(goal?: Goal) {
    setActionError(null);
    setEditing(goal?.id ?? "new");
    setForm(goal ? { title: goal.title, description: goal.description ?? "", targetDate: goal.target_date ?? "", status: goal.status, kind: goal.kind,
      target: goal.target_value?.toString() ?? "", current: goal.current_value.toString(), unit: goal.unit ?? "" } : blank);
  }

  async function perform(action: () => Promise<void>, close = false) {
    if (!userId || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await refresh();
      if (close) setEditing(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function submitGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const title = form.title.trim();
    const target = Number(form.target);
    const current = Number(form.current);
    if (!title || (form.kind === "measurable" && (!form.unit.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0))) {
      setActionError("Add a title, and a positive target, current value, and unit for measurable goals.");
      return;
    }
    const previous = snapshot.goals.find((goal) => goal.id === editing);
    const input: GoalInput = { title, description: form.description.trim() || null, target_date: form.targetDate || null, status: form.status, kind: form.kind,
      target_value: form.kind === "measurable" ? target : null, current_value: form.kind === "measurable" ? current : 0, unit: form.kind === "measurable" ? form.unit.trim() : null };
    void perform(() => saveGoal(client, userId, input, previous), true);
  }

  const activeTasks = tasks.filter((task) => task.cloudId);
  const activeHabits = habits.filter((habit) => habit.cloudId);

  if (loading || !userId) return <div className="space-y-5 pb-24 md:pb-10">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-white/35">Your outcomes and next steps</p><h2 className="mt-1 text-[1.75rem] font-semibold tracking-tight md:text-3xl">Goals</h2></div><button type="button" className={buttonClass} onClick={onAnalytics}>Analytics ↑</button></div>
    <div role={loading ? "status" : undefined} className="rounded-xl border border-white/10 p-5 text-sm text-white/50">{loading ? "Loading goals…" : "Sign in to create and sync goals across devices."}</div>
  </div>;

  return <div className="space-y-5 pb-24 md:pb-10">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-sm text-white/35">Your outcomes and next steps</p><h2 className="mt-1 text-[1.75rem] font-semibold tracking-tight md:text-3xl">Goals</h2></div>
      <div className="flex gap-2"><button type="button" className={buttonClass} onClick={onAnalytics}>Analytics ↑</button><button type="button" className={buttonClass} onClick={() => begin()} disabled={busy}>New goal</button></div>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-200">Could not load goals: {error} <button type="button" onClick={() => void refresh()} className="ml-2 underline">Try again</button></div>}
    {actionError && <p role="alert" className="text-sm text-red-200">{actionError}</p>}
    {editing === "new" && renderForm()}
    {!snapshot.goals.length && editing !== "new" && !error && <p className="rounded-xl border border-white/10 p-5 text-sm text-white/45">No goals yet. Create one to start tracking milestones or a measurable target.</p>}
    {snapshot.goals.map((goal) => {
      const milestones = snapshot.milestones.filter((item) => item.goal_id === goal.id);
      const progress = goalProgress(goal, milestones);
      const linkedTasks = snapshot.taskLinks.filter((item) => item.goal_id === goal.id);
      const linkedHabits = snapshot.habitLinks.filter((item) => item.goal_id === goal.id);
      return <article key={goal.id} className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
        {editing === goal.id ? renderForm() : <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="break-words text-lg font-medium">{goal.title}</h3>
              <p className="mt-1 text-xs text-white/40">{goal.status[0].toUpperCase() + goal.status.slice(1)} · {goal.kind === "milestone" ? "Milestones" : "Measurable"}{goal.target_date ? ` · Due ${goal.target_date}` : ""}</p>
            </div>
            <div className="flex gap-2"><button type="button" className={buttonClass} onClick={() => begin(goal)} disabled={busy}>Edit</button>
              <button type="button" className={buttonClass} disabled={busy} onClick={() => { if (window.confirm(`Delete ${goal.title}?`)) void perform(() => removeGoal(client, userId, goal)); }}>Delete</button></div>
          </div>
          {goal.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white/55">{goal.description}</p>}
          <div className="mt-4 flex items-center justify-between text-xs text-white/50"><span>{progress.label}</span><span>{progress.percent}%</span></div>
          <div role="progressbar" aria-label={`${goal.title} progress`} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#5B7CFF]" style={{ width: `${progress.percent}%` }} /></div>
          {goal.kind === "milestone" ? <div className="mt-5 space-y-2"><p className="text-xs uppercase tracking-wide text-white/35">Milestones</p>
            {milestones.map((item) => <MilestoneRow key={`${item.id}:${item.revision}`} item={item} busy={busy} onChange={(changes) => void perform(() => updateMilestone(client, userId, item, changes))} />)}
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const title = milestoneTitle[goal.id]?.trim(); if (!title) return; void perform(async () => { await addMilestone(client, userId, goal.id, title, milestones.length); setMilestoneTitle((values) => ({ ...values, [goal.id]: "" })); }); }}>
              <input aria-label={`New milestone for ${goal.title}`} className={inputClass} maxLength={160} placeholder="Add a milestone" value={milestoneTitle[goal.id] ?? ""} onChange={(event) => setMilestoneTitle((values) => ({ ...values, [goal.id]: event.target.value }))} />
              <button className={buttonClass} disabled={busy || !milestoneTitle[goal.id]?.trim()}>Add</button>
            </form>
          </div> : <MeasurableUpdate key={`${goal.id}:${goal.revision}`} goal={goal} busy={busy} onSave={(value) => void perform(() => saveGoal(client, userId, { title: goal.title, description: goal.description, target_date: goal.target_date, status: goal.status, kind: goal.kind, target_value: goal.target_value, current_value: value, unit: goal.unit }, goal))} />}
          <div className="mt-5 border-t border-white/[0.07] pt-4"><p className="text-xs uppercase tracking-wide text-white/35">Linked activity</p><p className="mt-1 text-xs text-white/30">Tasks and habits provide context; they do not change goal progress.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {renderLinks("task", goal, linkedTasks, activeTasks.map((task) => ({ id: task.cloudId!, label: task.text, detail: task.completed ? "Completed" : task.date })))}
              {renderLinks("habit", goal, linkedHabits, activeHabits.map((habit) => ({ id: habit.cloudId!, label: habit.name, detail: `${habit.completedDates.length} check-ins` })))}
            </div>
          </div>
        </>}
      </article>;
    })}
  </div>;

  function renderForm() {
    return <form onSubmit={submitGoal} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <label className="block text-xs text-white/50">Title<input className={`${inputClass} mt-1`} autoFocus required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label className="block text-xs text-white/50">Description (optional)<textarea className={`${inputClass} mt-1`} rows={2} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-white/50">Type<select className={`${inputClass} mt-1`} value={form.kind} disabled={editing !== "new"} onChange={(event) => setForm({ ...form, kind: event.target.value as Goal["kind"] })}><option value="milestone">Milestones</option><option value="measurable">Measurable</option></select></label>
        <label className="text-xs text-white/50">Status<select className={`${inputClass} mt-1`} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Goal["status"] })}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
        <label className="text-xs text-white/50">Target date (optional)<input type="date" className={`${inputClass} mt-1`} value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></label></div>
      {form.kind === "measurable" && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><label className="text-xs text-white/50">Target<input className={`${inputClass} mt-1`} type="number" min="0.01" step="0.01" required value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} /></label>
        <label className="text-xs text-white/50">Current<input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" required value={form.current} onChange={(event) => setForm({ ...form, current: event.target.value })} /></label>
        <label className="col-span-2 text-xs text-white/50 sm:col-span-1">Unit<input className={`${inputClass} mt-1`} required maxLength={40} placeholder="books, €, km…" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label></div>}
      <div className="flex gap-2"><button disabled={busy} className={`${buttonClass} border-[#5B7CFF]/40 text-white`}>{busy ? "Saving…" : "Save goal"}</button><button type="button" className={buttonClass} onClick={() => setEditing(null)}>Cancel</button></div>
      {editing !== "new" && <p className="text-xs text-white/30">Goal type stays fixed after creation so existing progress remains predictable.</p>}
    </form>;
  }

  function renderLinks(type: "task" | "habit", goal: Goal, links: { id: string; goal_id: string; task_id?: string; habit_id?: string }[], options: { id: string; label: string; detail: string }[]) {
    const key = type === "task" ? "task_id" : "habit_id";
    const linked = options.filter((option) => links.some((link) => link[key] === option.id));
    const available = options.filter((option) => !links.some((link) => link[key] === option.id));
    return <div className="min-w-0"><p className="mb-2 text-sm text-white/65">{type === "task" ? "Tasks" : "Habits"}</p>
      {linked.map((option) => <div key={option.id} className="flex min-w-0 items-center justify-between gap-2 py-1 text-sm"><span className="min-w-0 truncate text-white/60" title={option.label}>{option.label} <span className="text-xs text-white/30">· {option.detail}</span></span>
        <button type="button" className="min-h-11 shrink-0 px-2 text-xs text-white/40 hover:text-white" aria-label={`Unlink ${option.label}`} disabled={busy} onClick={() => void perform(() => setGoalLink(client, userId!, goal.id, type, option.id, links.find((link) => link[key] === option.id)))}>Unlink</button></div>)}
      <select aria-label={`Link an existing ${type} to ${goal.title}`} className={`${inputClass} mt-1`} value="" disabled={busy || !available.length} onChange={(event) => { if (event.target.value) void perform(() => setGoalLink(client, userId!, goal.id, type, event.target.value)); }}><option value="">{available.length ? `Link ${type}…` : `No ${type}s available`}</option>{available.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
    </div>;
  }
}

function MilestoneRow({ item, busy, onChange }: { item: Milestone; busy: boolean; onChange: (change: { title?: string; completed_at?: string | null; deleted_at?: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  return <div className="flex min-w-0 items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#5B7CFF]" aria-label={`Complete ${item.title}`} checked={Boolean(item.completed_at)} disabled={busy} onChange={() => onChange({ completed_at: item.completed_at ? null : new Date().toISOString() })} />
    {editing ? <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); if (title.trim()) { onChange({ title: title.trim() }); setEditing(false); } }}><input aria-label="Milestone title" autoFocus required maxLength={160} className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} /><button className={buttonClass} disabled={busy}>Save</button></form> : <span className={`min-w-0 flex-1 break-words text-sm ${item.completed_at ? "text-white/35 line-through" : "text-white/70"}`}>{item.title}</span>}
    <button type="button" className="min-h-11 px-1 text-xs text-white/40" disabled={busy} onClick={() => { if (editing) { setTitle(item.title); setEditing(false); } else setEditing(true); }}>{editing ? "Cancel" : "Edit"}</button>
    <button type="button" className="min-h-11 px-1 text-xs text-white/40" disabled={busy} onClick={() => { if (window.confirm(`Delete milestone ${item.title}?`)) onChange({ deleted_at: new Date().toISOString() }); }}>Delete</button>
  </div>;
}

function MeasurableUpdate({ goal, busy, onSave }: { goal: Goal; busy: boolean; onSave: (value: number) => void }) {
  const [value, setValue] = useState(goal.current_value.toString());
  return <form className="mt-5 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); const parsed = Number(value); if (Number.isFinite(parsed) && parsed >= 0) onSave(parsed); }}>
    <label className="text-xs text-white/50">Current value<input type="number" min="0" step="0.01" required className={`${inputClass} mt-1 w-32`} value={value} onChange={(event) => setValue(event.target.value)} /></label>
    <span className="pb-3 text-xs text-white/40">{goal.unit}</span><button className={buttonClass} disabled={busy}>Update</button>
  </form>;
}
