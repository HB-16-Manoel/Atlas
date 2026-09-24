"use client";

import {
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type {
  Habit,
  Task,
} from "./Planning";

import { calculateDailyScore } from "../lib/dailyScore";

/* ============================================================
 * TYPES
 * ============================================================
 */

export type JournalMood =
  | "Great"
  | "Good"
  | "Okay"
  | "Low"
  | "Rough";

export type JournalEnergy =
  | "High"
  | "Good"
  | "Average"
  | "Low";

export type JournalEntry = {
  date: string;

  cloudId?: string;

  revision?: number;

  cloudUpdatedAt?: string;

  text: string;

  mood:
    | JournalMood
    | null;

  energy:
    | JournalEnergy
    | null;

  rating:
    | number
    | null;

  updatedAt: string;
};

type JournalProps = {
  tasks: Task[];

  habits: Habit[];

  entries: JournalEntry[];

  setEntries: Dispatch<
    SetStateAction<
      JournalEntry[]
    >
  >;
};

/* ============================================================
 * DATE HELPERS
 * ============================================================
 */

function startOfDay(
  date: Date
) {
  const next =
    new Date(date);

  next.setHours(
    0,
    0,
    0,
    0
  );

  return next;
}

function addDays(
  date: Date,
  amount: number
) {
  const next =
    new Date(date);

  next.setDate(
    next.getDate() +
      amount
  );

  return startOfDay(
    next
  );
}

function formatDateKey(
  date: Date
) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function parseDateKey(
  dateKey: string
) {
  const [
    year,
    month,
    day,
  ] =
    dateKey
      .split("-")
      .map(Number);

  return startOfDay(
    new Date(
      year,
      month - 1,
      day
    )
  );
}

/* ============================================================
 * JOURNAL
 * ============================================================
 */

export default function Journal({
  tasks,
  habits,
  entries,
  setEntries,
}: JournalProps) {
  const today =
    startOfDay(
      new Date()
    );

  const todayKey =
    formatDateKey(
      today
    );

  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState(
      todayKey
    );

  /*
   * Right-most visible date in the
   * rolling 7-day calendar.
   */

  const [
    calendarEnd,
    setCalendarEnd,
  ] =
    useState(
      todayKey
    );

  /* ============================================================
   * SELECTED DATE
   * ============================================================
   */

  const selectedDateObject =
    parseDateKey(
      selectedDate
    );

  const calendarEndObject =
    parseDateKey(
      calendarEnd
    );

  const calendarStartObject =
    addDays(
      calendarEndObject,
      -6
    );

  const isToday =
    selectedDate ===
    todayKey;

  const selectedEntry =
    entries.find(
      (
        entry
      ) =>
        entry.date ===
        selectedDate
    ) ??
    null;

  /* ============================================================
   * CALENDAR
   * ============================================================
   */

  const calendarDates =
    Array.from(
      {
        length:
          7,
      },
      (
        _,
        index
      ) =>
        addDays(
          calendarStartObject,
          index
        )
    );

  /* ============================================================
   * DAY DATA
   * ============================================================
   */

  const dayTasks =
    tasks.filter(
      (
        task
      ) =>
        task.date ===
        selectedDate
    );

  const completedTasks =
    dayTasks.filter(
      (
        task
      ) =>
        task.completed
    ).length;

  const activeHabits =
    habits.filter(
      (
        habit
      ) =>
        habit.createdAt <=
        selectedDate
    );

  const completedHabits =
    activeHabits.filter(
      (
        habit
      ) =>
        habit.completedDates.includes(
          selectedDate
        )
    ).length;

  const dailyScore =
    calculateDailyScore(
      completedTasks,
      dayTasks.length,
      completedHabits,
      activeHabits.length
    );

  const totalPlanned =
    dayTasks.length +
    activeHabits.length;

  const totalCompleted =
    completedTasks +
    completedHabits;

  const followThrough =
    totalPlanned >
    0
      ? Math.round(
          (totalCompleted /
            totalPlanned) *
            100
        )
      : null;

  /* ============================================================
   * STATUS
   * ============================================================
   */

  let statusLabel =
    "No plan";

  if (
    followThrough !==
    null
  ) {
    if (
      isToday &&
      followThrough <
        100
    ) {
      statusLabel =
        "In progress";
    } else if (
      followThrough >=
      80
    ) {
      statusLabel =
        "On track";
    } else if (
      followThrough >=
      40
    ) {
      statusLabel =
        "Partial";
    } else {
      statusLabel =
        "Missed";
    }
  }

  /* ============================================================
   * UPDATE TODAY ONLY
   * ============================================================
   */

  const updateEntry = (
    patch:
      Partial<
        JournalEntry
      >
  ) => {
    if (
      !isToday
    ) {
      return;
    }

    setEntries(
      (
        current
      ) => {
        const existing =
          current.find(
            (
              entry
            ) =>
              entry.date ===
              selectedDate
          );

        if (
          existing
        ) {
          return current.map(
            (
              entry
            ) =>
              entry.date ===
              selectedDate
                ? {
                    ...entry,
                    ...patch,

                    updatedAt:
                      new Date().toISOString(),
                  }
                : entry
          );
        }

        const newEntry:
          JournalEntry = {
          cloudId:
            crypto.randomUUID(),

          date:
            selectedDate,

          text:
            "",

          mood:
            null,

          energy:
            null,

          rating:
            null,

          updatedAt:
            new Date().toISOString(),

          ...patch,
        };

        return [
          ...current,
          newEntry,
        ];
      }
    );
  };

  /* ============================================================
   * DAY NAVIGATION
   * ============================================================
   */

  const moveDay = (
    amount: number
  ) => {
    const next =
      addDays(
        selectedDateObject,
        amount
      );

    /*
     * Future days cannot be opened.
     */

    if (
      next >
      today
    ) {
      return;
    }

    /*
     * When selection crosses an edge,
     * move the visible calendar with it.
     */

    if (
      next <
      calendarStartObject
    ) {
      setCalendarEnd(
        formatDateKey(
          addDays(
            calendarEndObject,
            -1
          )
        )
      );
    }

    if (
      next >
      calendarEndObject
    ) {
      const proposedEnd =
        addDays(
          calendarEndObject,
          1
        );

      setCalendarEnd(
        formatDateKey(
          proposedEnd >
          today
            ? today
            : proposedEnd
        )
      );
    }

    setSelectedDate(
      formatDateKey(
        next
      )
    );
  };

  const goToToday =
    () => {
      setSelectedDate(
        todayKey
      );

      setCalendarEnd(
        todayKey
      );
    };

  /* ============================================================
   * OPTIONS
   * ============================================================
   */

  const moods:
    JournalMood[] = [
      "Great",
      "Good",
      "Okay",
      "Low",
      "Rough",
    ];

  const energyLevels:
    JournalEnergy[] = [
      "High",
      "Good",
      "Average",
      "Low",
    ];

  /* ============================================================
   * WORD COUNT
   * ============================================================
   */

  const wordCount =
    (
      selectedEntry?.text ??
      ""
    )
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      ).length;

  /* ============================================================
   * UI
   * ============================================================
   */

  return (
    <div className="w-full min-w-0 md:h-[calc(100vh-5rem)] md:overflow-hidden">
      <div className="flex min-w-0 flex-col md:h-full md:min-h-0">

        {/* ======================================================
         * HEADER
         * ====================================================== */}

        <div className="flex shrink-0 items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/35">
              Capture the context behind your day
            </p>

            <h2 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.025em] md:text-3xl">
              Journal
            </h2>
          </div>

          <button
            type="button"

            onClick={
              goToToday
            }

            className={`min-h-11 shrink-0 rounded-xl border px-3.5 py-2 text-xs transition md:min-h-0 md:rounded-lg ${
              isToday
                ? "border-[#5B7CFF]/25 bg-[#5B7CFF]/10 text-[#91A6FF]"
                : "border-white/[0.07] bg-white/[0.025] text-white/40 hover:bg-white/[0.045] hover:text-white/65"
            }`}
          >
            Today
          </button>
        </div>

        {/* ======================================================
         * CALENDAR — SEPARATE DAY CARDS
         * ====================================================== */}

        <div className="mt-4 grid min-w-0 shrink-0 grid-cols-7 gap-1 md:mt-5 md:gap-2.5">
          {calendarDates.map(
            (
              date
            ) => {
              const dateKey =
                formatDateKey(
                  date
                );

              const selected =
                dateKey ===
                selectedDate;

              const dateEntry =
                entries.find(
                  (
                    entry
                  ) =>
                    entry.date ===
                    dateKey
                );

              const hasEntry =
                Boolean(
                  dateEntry &&
                  (
                    dateEntry.text.trim() ||
                    dateEntry.mood ||
                    dateEntry.energy ||
                    dateEntry.rating
                  )
                );

              const dateIsToday =
                dateKey ===
                todayKey;

              return (
                <button
                  type="button"

                  key={
                    dateKey
                  }

                  aria-current={
                    selected
                      ? "date"
                      : undefined
                  }

                  onClick={() =>
                    setSelectedDate(
                      dateKey
                    )
                  }

                  className={`relative min-w-0 rounded-lg border px-0.5 py-2.5 text-center transition-all duration-200 md:rounded-xl md:px-3 md:py-3 ${
                    selected
                      ? "border-[#5B7CFF]/40 bg-[#5B7CFF]/10 shadow-[0_0_24px_rgba(91,124,255,0.035)]"
                      : "border-white/[0.07] bg-white/[0.022] hover:border-white/[0.11] hover:bg-white/[0.04]"
                  }`}
                >
                  <p
                    className={`truncate text-[9px] font-medium uppercase tracking-[0.08em] md:text-[10px] md:tracking-[0.13em] ${
                      selected
                        ? "text-[#91A6FF]"
                        : "text-white/28"
                    }`}
                  >
                    {date.toLocaleDateString(
                      "en-US",
                      {
                        weekday:
                          "short",
                      }
                    )}
                  </p>

                  <p
                    className={`mt-1 text-base font-medium md:text-lg ${
                      selected
                        ? "text-white"
                        : "text-white/72"
                    }`}
                  >
                    {
                      date.getDate()
                    }
                  </p>

                  <div className="mt-1.5 flex h-1.5 items-center justify-center md:mt-2">
                    {hasEntry ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#6F8CFF]" />
                    ) : dateIsToday ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-white/18" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-white/[0.06]" />
                    )}
                  </div>
                </button>
              );
            }
          )}
        </div>

        {/* ======================================================
         * MAIN CONTENT
         * ====================================================== */}

        <div className="mt-4 grid min-w-0 grid-cols-1 items-start gap-4 md:min-h-0 md:flex-1 xl:grid-cols-[minmax(0,1fr)_310px]">

          {/* ====================================================
           * JOURNAL ENTRY
           * ==================================================== */}

          <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] md:h-full md:min-h-0">

            {/* ENTRY HEADER */}

            <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-4 pt-4 md:px-6 md:pt-5">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/25">
                  {isToday
                    ? "Today’s reflection"
                    : "Journal entry"}
                </p>

                <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.025em] md:text-xl">
                  {selectedDateObject.toLocaleDateString(
                    "en-US",
                    {
                      weekday:
                        "long",

                      month:
                        "long",

                      day:
                        "numeric",
                    }
                  )}
                </h3>

                <p className="mt-1 text-xs text-white/28">
                  {isToday
                    ? "What stood out about today?"
                    : selectedEntry
                      ? "Saved reflection"
                      : "No reflection recorded"}
                </p>
              </div>

              {/* DAY NAVIGATION */}

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"

                  onClick={() =>
                    moveDay(
                      -1
                    )
                  }

                  aria-label="Previous day"

                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] text-base text-white/40 transition hover:bg-white/[0.05] hover:text-white/65 md:h-9 md:w-9 md:rounded-lg md:text-sm"
                >
                  ←
                </button>

                <button
                  type="button"

                  onClick={() =>
                    moveDay(
                      1
                    )
                  }

                  disabled={
                    isToday
                  }

                  aria-label="Next day"

                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] text-base text-white/40 transition hover:bg-white/[0.05] hover:text-white/65 disabled:cursor-default disabled:opacity-15 md:h-9 md:w-9 md:rounded-lg md:text-sm"
                >
                  →
                </button>
              </div>
            </div>

            <div className="mx-4 h-px shrink-0 bg-white/[0.055] md:mx-6" />

            {/* ==================================================
             * TODAY — EDITABLE
             * ================================================== */}

            {isToday ? (
              <div className="flex min-w-0 flex-col px-4 pb-4 md:min-h-0 md:flex-1 md:px-6 md:pb-5">

                {/* ==================================================
                 * MOOD / ENERGY / RATING
                 * ================================================== */}

                <div className="grid shrink-0 grid-cols-1 gap-5 py-4 md:py-5 lg:grid-cols-[1.05fr_0.95fr_0.8fr]">

                  {/* MOOD */}

                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-white/45">
                        Mood
                      </p>

                      <span className="text-[10px] text-white/18">
                        How you felt
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-2 md:flex md:flex-wrap">
                      {moods.map(
                        (
                          mood
                        ) => (
                          <button
                            type="button"

                            key={
                              mood
                            }

                            onClick={() =>
                              updateEntry({
                                mood:
                                  selectedEntry?.mood ===
                                  mood
                                    ? null
                                    : mood,
                              })
                            }

                            aria-pressed={
                              selectedEntry?.mood ===
                              mood
                            }

                            className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-medium transition md:min-h-0 md:rounded-lg md:px-3.5 ${
                              selectedEntry?.mood ===
                              mood
                                ? "border-[#5B7CFF]/40 bg-[#5B7CFF]/12 text-[#A0B2FF]"
                                : "border-white/[0.075] bg-white/[0.022] text-white/40 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/65"
                            }`}
                          >
                            {
                              mood
                            }
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* ENERGY */}

                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-white/45">
                        Energy
                      </p>

                      <span className="text-[10px] text-white/18">
                        How you felt physically
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2 md:flex md:flex-wrap">
                      {energyLevels.map(
                        (
                          energy
                        ) => (
                          <button
                            type="button"

                            key={
                              energy
                            }

                            onClick={() =>
                              updateEntry({
                                energy:
                                  selectedEntry?.energy ===
                                  energy
                                    ? null
                                    : energy,
                              })
                            }

                            aria-pressed={
                              selectedEntry?.energy ===
                              energy
                            }

                            className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-medium transition md:min-h-0 md:rounded-lg md:px-3.5 ${
                              selectedEntry?.energy ===
                              energy
                                ? "border-[#5B7CFF]/40 bg-[#5B7CFF]/12 text-[#A0B2FF]"
                                : "border-white/[0.075] bg-white/[0.022] text-white/40 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/65"
                            }`}
                          >
                            {
                              energy
                            }
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* RATING */}

                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-white/45">
                        Day rating
                      </p>

                      <span className="text-[10px] text-white/18">
                        Optional
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-5 gap-2 md:flex">
                      {[
                        1,
                        2,
                        3,
                        4,
                        5,
                      ].map(
                        (
                          rating
                        ) => (
                          <button
                            type="button"

                            key={
                              rating
                            }

                            onClick={() =>
                              updateEntry({
                                rating:
                                  selectedEntry?.rating ===
                                  rating
                                    ? null
                                    : rating,
                              })
                            }

                            aria-pressed={
                              selectedEntry?.rating ===
                              rating
                            }

                            className={`flex h-11 min-w-0 items-center justify-center rounded-xl border text-xs font-medium transition md:h-9 md:w-9 md:rounded-lg ${
                              selectedEntry?.rating ===
                              rating
                                ? "border-[#5B7CFF]/40 bg-[#5B7CFF]/12 text-[#A0B2FF]"
                                : "border-white/[0.075] bg-white/[0.022] text-white/38 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/65"
                            }`}
                          >
                            {
                              rating
                            }
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* ==================================================
                 * WRITING
                 * ================================================== */}

                <div className="flex min-w-0 flex-col border-t border-white/[0.055] pt-4 md:min-h-0 md:flex-1">
                  <div className="mb-2">
                    <p className="text-xs font-medium text-white/35">
                      Your reflection
                    </p>
                  </div>

                  <textarea
                    aria-label="Your reflection"

                    autoCapitalize="sentences"

                    spellCheck

                    rows={
                      10
                    }

                    value={
                      selectedEntry?.text ??
                      ""
                    }

                    onChange={(
                      event
                    ) =>
                      updateEntry({
                        text:
                          event.target.value,
                      })
                    }

                    placeholder="Write whatever feels important — what happened, what went well, what felt difficult, what you're thinking about..."

                    className="
                      min-h-[17rem]
                      w-full
                      scroll-mt-24
                      resize-none
                      bg-transparent
                      text-base
                      leading-7
                      text-white/75
                      outline-none
                      placeholder:text-white/16
                      md:min-h-0
                      md:flex-1
                      md:pr-4
                      md:text-[15px]
                    "
                  />

                  <div className="mt-3 flex shrink-0 items-center justify-between border-t border-white/[0.05] pt-3">
                    <span className="text-[10px] text-white/18">
                      Saved automatically
                    </span>

                    <span className="text-[10px] text-white/18">
                      {
                        wordCount
                      }{" "}
                      words
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* ==================================================
               * PAST DAY — READ ONLY
               * ================================================== */

              <div className="flex min-w-0 flex-col px-4 pb-4 md:min-h-0 md:flex-1 md:px-6 md:pb-5">

                {/* SAVED SIGNALS */}

                <div className="grid shrink-0 grid-cols-3 gap-3 py-4 md:gap-6 md:py-5">
                  <div>
                    <p className="text-xs font-medium text-white/30">
                      Mood
                    </p>

                    <p className="mt-2 text-base font-medium text-white/65">
                      {
                        selectedEntry?.mood ??
                        "—"
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-white/30">
                      Energy
                    </p>

                    <p className="mt-2 text-base font-medium text-white/65">
                      {
                        selectedEntry?.energy ??
                        "—"
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-white/30">
                      Day rating
                    </p>

                    <p className="mt-2 text-base font-medium text-white/65">
                      {selectedEntry?.rating
                        ? `${selectedEntry.rating} / 5`
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* SAVED WRITING */}

                <div className="flex min-h-0 flex-1 flex-col border-t border-white/[0.055] pt-4">
                  <p className="shrink-0 text-xs font-medium text-white/30">
                    Reflection
                  </p>

                  <div className="mt-3 min-h-[10rem] flex-1 md:min-h-0 md:overflow-y-auto md:pr-3 md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden">
                    {selectedEntry?.text.trim() ? (
                      <p className="whitespace-pre-wrap text-[15px] leading-7 text-white/70">
                        {
                          selectedEntry.text
                        }
                      </p>
                    ) : (
                      <div className="flex min-h-[10rem] items-center justify-center md:h-full md:min-h-0">
                        <div className="text-center">
                          <p className="text-sm text-white/22">
                            No journal entry was written for this day.
                          </p>

                          <p className="mt-1.5 text-xs text-white/14">
                            Past entries are read-only.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ====================================================
           * RIGHT COLUMN
           * ==================================================== */}

          <div className="min-w-0 space-y-4 self-start">

            {/* ==================================================
             * DAY CONTEXT
             * ================================================== */}

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/25">
                    Day context
                  </p>

                  <p className="mt-1 text-[11px] text-white/22">
                    What Atlas recorded
                  </p>
                </div>

                <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[9px] font-medium text-white/35">
                  {
                    statusLabel
                  }
                </span>
              </div>

              {/* SCORE */}

              <div className="mt-5">
                <p className="text-xs text-white/30">
                  Daily Score
                </p>

                <div className="mt-1 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-[-0.045em]">
                    {
                      dailyScore ??
                      "—"
                    }
                  </span>

                  {dailyScore !==
                    null && (
                    <span className="mb-1 text-xs text-white/20">
                      / 100
                    </span>
                  )}
                </div>
              </div>

              {/* FOLLOW THROUGH */}

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30">
                    Follow-through
                  </span>

                  <span className="text-xs font-medium text-white/55">
                    {followThrough !==
                    null
                      ? `${followThrough}%`
                      : "—"}
                  </span>
                </div>

                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#5B7CFF] transition-[width] duration-500"

                    style={{
                      width:
                        `${followThrough ?? 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* TASK / HABIT STATS */}

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-white/[0.065] bg-white/[0.02] p-3.5">
                  <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-white/20">
                    Tasks
                  </p>

                  <p className="mt-1.5 text-xl font-semibold">
                    {
                      completedTasks
                    }

                    <span className="text-xs font-normal text-white/22">
                      {" "}
                      /{" "}
                      {
                        dayTasks.length
                      }
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.065] bg-white/[0.02] p-3.5">
                  <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-white/20">
                    Habits
                  </p>

                  <p className="mt-1.5 text-xl font-semibold">
                    {
                      completedHabits
                    }

                    <span className="text-xs font-normal text-white/22">
                      {" "}
                      /{" "}
                      {
                        activeHabits.length
                      }
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* ==================================================
             * ATLAS CONTEXT
             * ================================================== */}

            <div className="rounded-2xl border border-[#5B7CFF]/12 bg-[#5B7CFF]/[0.025] p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#5B7CFF]/15 bg-[#5B7CFF]/10 text-[#8EA4FF]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M8 2.3C5.8 2.3 4.05 4.02 4.05 6.15C4.05 7.62 4.86 8.83 5.98 9.54V11.1H10.02V9.54C11.14 8.83 11.95 7.62 11.95 6.15C11.95 4.02 10.2 2.3 8 2.3Z"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M6.2 13.15H9.8"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#8EA4FF]/60">
                    Atlas context
                  </p>

                  <p className="mt-1.5 text-xs leading-5 text-white/32">
                    Your reflection can later help Atlas understand why this day looked the way it did — not just what you completed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
