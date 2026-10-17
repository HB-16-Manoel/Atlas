"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Goal, GoalInput } from "../lib/data/goalsRepository";

export const goalInputClass =
  "min-h-11 w-full rounded-lg border border-white/15 bg-[#191C28] px-3 py-2 text-sm text-white outline-none [color-scheme:dark] focus-visible:border-[#7892FF] focus-visible:ring-2 focus-visible:ring-[#5B7CFF]/25 disabled:opacity-60";
export const goalButtonClass =
  "min-h-10 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7892FF] disabled:opacity-40";

type Fields = {
  title: string;
  description: string;
  date: string;
  status: Goal["status"];
  kind: Goal["kind"];
  target: string;
  current: string;
  unit: string;
};
type FieldErrors = Partial<Record<keyof Fields, string>>;

export default function GoalEditor({
  goal,
  onSave,
  onDismiss,
}: {
  goal?: Goal;
  onSave: (input: GoalInput) => Promise<void>;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savingRef = useRef(false);
  const id = useId();
  const [fields, setFields] = useState<Fields>(() => ({
    title: goal?.title ?? "",
    description: goal?.description ?? "",
    date: goal?.target_date ?? "",
    status: goal?.status ?? "active",
    kind: goal?.kind ?? "milestone",
    target: goal?.target_value?.toString() ?? "",
    current: goal?.current_value.toString() ?? "0",
    unit: goal?.unit ?? "",
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const scroller = document.querySelector<HTMLElement>(
      "[data-progress-scroll]",
    );
    const previousOverflow = scroller?.style.overflowY ?? "";
    const bodyOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    if (scroller) scroller.style.overflowY = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = bodyOverflow;
      if (scroller) scroller.style.overflowY = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setSaveError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const next: FieldErrors = {};
    const target = Number(fields.target);
    const current = Number(fields.current);
    if (!fields.title.trim()) next.title = "Enter a goal title.";
    if (fields.kind === "measurable") {
      if (
        !fields.target.trim() ||
        !Number.isFinite(target) ||
        target <= 0 ||
        target > 999999999999.99
      )
        next.target =
          "Enter a target greater than zero (up to 999,999,999,999.99).";
      if (
        !fields.current.trim() ||
        !Number.isFinite(current) ||
        current < 0 ||
        current > 999999999999.99
      )
        next.current = "Enter a current value of zero or more.";
      if (!fields.unit.trim()) next.unit = "Enter a unit, such as books or €.";
    }
    if (fields.date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.date))
      next.date = "Choose a valid target date, or leave it blank.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      (
        event.currentTarget.elements.namedItem(first) as HTMLElement | null
      )?.focus();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        title: fields.title.trim(),
        description: fields.description.trim() || null,
        target_date: fields.date || null,
        status: fields.status,
        kind: fields.kind,
        target_value: fields.kind === "measurable" ? target : null,
        current_value: fields.kind === "measurable" ? current : 0,
        unit: fields.kind === "measurable" ? fields.unit.trim() : null,
      });
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : "Could not save this goal. Please try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const errorProps = (key: keyof Fields) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });
  const fieldError = (key: keyof Fields) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="mt-1 text-xs text-red-200">
        {errors[key]}
      </p>
    ) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        if (!savingRef.current) onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,[tabindex]",
          ),
        ).filter(
          (element) =>
            !element.matches(":disabled") &&
            element.tabIndex >= 0 &&
            element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%_-_3rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#11131D] p-0 text-white shadow-2xl backdrop:bg-black/70 [color-scheme:dark]"
    >
      <form onSubmit={submit} noValidate className="p-6">
        <header className="mb-6">
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            {goal ? "Edit goal" : "New goal"}
          </h2>
          <p id={`${id}-description`} className="mt-1 text-sm text-white/45">
            Define the outcome and how you will measure it. A deadline is
            optional.
          </p>
        </header>
        <fieldset disabled={saving} className="min-w-0 space-y-5">
          <label className="block text-sm text-white/70">
            Title
            <input
              aria-label="Title"
              name="title"
              autoFocus
              required
              maxLength={160}
              className={`${goalInputClass} mt-2`}
              value={fields.title}
              onChange={(event) => update("title", event.target.value)}
              {...errorProps("title")}
            />
            {fieldError("title")}
          </label>
          {goal ? (
            <div className="rounded-lg border border-white/10 p-3">
              <p className="text-sm text-white/75">
                {goal.kind === "milestone"
                  ? "Milestone-based goal"
                  : "Measurable goal"}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Type is fixed after creation to preserve existing progress.
              </p>
            </div>
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm text-white/70">
                How will you track progress?
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    [
                      "milestone",
                      "Milestone-based",
                      "Complete individual steps. Progress is the share of milestones completed.",
                    ],
                    [
                      "measurable",
                      "Measurable",
                      "Track a number against a target, such as 12 books or €500.",
                    ],
                  ] as const
                ).map(([value, title, description]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${fields.kind === value ? "border-[#7892FF]/60 bg-[#5B7CFF]/[0.07]" : "border-white/10"}`}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={value}
                      checked={fields.kind === value}
                      onChange={() => update("kind", value)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#5B7CFF]"
                    />
                    <span>
                      <span className="block text-sm text-white/85">
                        {title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-white/45">
                        {description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {fields.kind === "measurable" && (
            <fieldset>
              <legend className="mb-2 text-sm text-white/70">
                Measurement
              </legend>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs text-white/55">
                  Target
                  <input
                    aria-label="Target"
                    name="target"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className={`${goalInputClass} mt-2`}
                    value={fields.target}
                    onChange={(event) => update("target", event.target.value)}
                    {...errorProps("target")}
                  />
                  {fieldError("target")}
                </label>
                <label className="text-xs text-white/55">
                  Current value
                  <input
                    aria-label="Current value"
                    name="current"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className={`${goalInputClass} mt-2`}
                    value={fields.current}
                    onChange={(event) => update("current", event.target.value)}
                    {...errorProps("current")}
                  />
                  {fieldError("current")}
                </label>
                <label className="text-xs text-white/55">
                  Unit
                  <input
                    aria-label="Unit"
                    name="unit"
                    required
                    maxLength={40}
                    placeholder="books, €, km…"
                    className={`${goalInputClass} mt-2`}
                    value={fields.unit}
                    onChange={(event) => update("unit", event.target.value)}
                    {...errorProps("unit")}
                  />
                  {fieldError("unit")}
                </label>
              </div>
              <p className="mt-2 text-xs text-white/35">
                Only this value changes measurable progress. Linked activity
                does not add to it.
              </p>
            </fieldset>
          )}
          <label className="block text-sm text-white/70">
            Description <span className="text-white/35">(optional)</span>
            <textarea
              name="description"
              rows={2}
              maxLength={2000}
              className={`${goalInputClass} mt-2 resize-y`}
              value={fields.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm text-white/70">
              Status
              <select
                aria-label="Status"
                name="status"
                className={`${goalInputClass} mt-2`}
                value={fields.status}
                onChange={(event) =>
                  update("status", event.target.value as Goal["status"])
                }
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="text-sm text-white/70">
              Target date <span className="text-white/35">(optional)</span>
              <input
                name="date"
                type="date"
                className={`${goalInputClass} mt-2`}
                value={fields.date}
                onChange={(event) => update("date", event.target.value)}
                {...errorProps("date")}
              />
              {fieldError("date")}
            </label>
          </div>
          <p className="text-xs text-white/35">
            Status is managed separately from calculated progress.
          </p>
        </fieldset>
        {saveError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-400/25 p-3 text-sm text-red-200"
          >
            {saveError}
          </p>
        )}
        <footer className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            disabled={saving}
            className={goalButtonClass}
            onClick={onDismiss}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`${goalButtonClass} border-[#5B7CFF]/50 bg-[#5B7CFF]/15 text-white`}
          >
            {saving ? "Saving…" : "Save goal"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
