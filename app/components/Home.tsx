"use client";

import type {
  AtlasEvent,
  Habit,
  Task,
} from "./Planning";

import type {
  JournalEntry,
} from "./Journal";

import {
  calculateDailyScore,
} from "../lib/dailyScore";

import {
  getAtlasIntelligence,
  type TaskHistoryEventLike,
} from "../lib/atlasIntelligence";

/* ============================================================
 * TYPES
 * ============================================================
 */

type HomeProps = {
  tasks: Task[];
  habits: Habit[];
  events: AtlasEvent[];

  journalEntries: JournalEntry[];

  taskHistory:
    TaskHistoryEventLike[];

  onNavigate?: (
    page: string
  ) => void;
};

type DayStatus = {
  planned: boolean;
  onTrack: boolean;
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

/* ============================================================
 * DAY STATUS
 * ============================================================
 */

function getDayStatus(
  date: Date,
  tasks: Task[],
  habits: Habit[]
): DayStatus {
  const dateKey =
    formatDateKey(
      date
    );

  const dayTasks =
    tasks.filter(
      (
        task
      ) =>
        task.date ===
        dateKey
    );

  const activeHabits =
    habits.filter(
      (
        habit
      ) =>
        habit.createdAt
          .slice(
            0,
            10
          ) <=
        dateKey
    );

  const planned =
    dayTasks.length +
    activeHabits.length;

  if (
    planned ===
    0
  ) {
    return {
      planned:
        false,

      onTrack:
        false,
    };
  }

  const completedTasks =
    dayTasks.filter(
      (
        task
      ) =>
        task.completed
    ).length;

  const completedHabits =
    activeHabits.filter(
      (
        habit
      ) =>
        habit.completedDates.includes(
          dateKey
        )
    ).length;

  const completed =
    completedTasks +
    completedHabits;

  return {
    planned:
      true,

    onTrack:
      completed /
        planned >=
      0.8,
  };
}

/* ============================================================
 * CURRENT STREAK
 * ============================================================
 */

function getCurrentStreak(
  today: Date,
  tasks: Task[],
  habits: Habit[]
) {
  let streak =
    0;

  for (
    let offset = 0;
    offset < 365;
    offset += 1
  ) {
    const date =
      addDays(
        today,
        -offset
      );

    const status =
      getDayStatus(
        date,
        tasks,
        habits
      );

    if (
      !status.planned
    ) {
      continue;
    }

    if (
      status.onTrack
    ) {
      streak +=
        1;

      continue;
    }

    break;
  }

  return streak;
}

/* ============================================================
 * HOME
 * ============================================================
 */

export default function Home({
  tasks,
  habits,
  events,
  journalEntries,
  taskHistory,
  onNavigate,
}: HomeProps) {
  const today =
    startOfDay(
      new Date()
    );

  const todayKey =
    formatDateKey(
      today
    );

  /* ============================================================
   * EVENTS
   * ============================================================
   */

  const eventOccurrences =
    events
      .map(
        (
          event
        ) => {
          if (!event.repeatYearly) {
            return {
              event,
              occurrenceDate:
                event.date,
            };
          }

          const monthDay =
            event.date.slice(5);
          const year =
            today.getFullYear();
          const thisYear =
            `${year}-${monthDay}`;

          return {
            event,
            occurrenceDate:
              thisYear >=
              todayKey
                ? thisYear
                : `${year + 1}-${monthDay}`,
          };
        }
      )
      .filter(
        (
          occurrence
        ) =>
          occurrence.occurrenceDate >=
          todayKey
      )
      .sort(
        (
          a,
          b
        ) =>
          a.occurrenceDate.localeCompare(
            b.occurrenceDate
          ) ||
          (a.event.time ?? "").localeCompare(
            b.event.time ?? ""
          )
      );

  const displayEvent =
    eventOccurrences[0] ??
    null;

  const formatEventDate =
    (
      dateKey: string
    ) => {
      if (dateKey === todayKey) {
        return "Today";
      }

      const [
        year,
        month,
        day,
      ] = dateKey
        .split("-")
        .map(Number);

      return new Date(
        year,
        month - 1,
        day
      ).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
        }
      );
    };

  const formatEventTime =
    (
      time?: string
    ) => {
      if (!time) {
        return null;
      }

      const [
        hours,
        minutes,
      ] = time
        .split(":")
        .map(Number);

      return new Date(
        2000,
        0,
        1,
        hours,
        minutes
      ).toLocaleTimeString(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
        }
      );
    };

  /* ============================================================
   * TODAY TASKS
   * ============================================================
   */

  const todayTasks =
    tasks
      .filter(
        (
          task
        ) =>
          task.date ===
          todayKey
      )
      .sort(
        (
          a,
          b
        ) =>
          a.order -
          b.order
      );

  const completedTasks =
    todayTasks.filter(
      (
        task
      ) =>
        task.completed
    ).length;

  const unfinishedTasks =
    todayTasks.filter(
      (
        task
      ) =>
        !task.completed
    );

  /* ============================================================
   * TODAY HABITS
   * ============================================================
   */

  const activeHabits =
    habits
      .filter(
        (
          habit
        ) =>
          habit.createdAt
            .slice(
              0,
              10
            ) <=
          todayKey
      )
      .sort(
        (
          a,
          b
        ) =>
          a.order -
          b.order
      );

  const completedHabits =
    activeHabits.filter(
      (
        habit
      ) =>
        habit.completedDates.includes(
          todayKey
        )
    ).length;

  const unfinishedHabits =
    activeHabits.filter(
      (
        habit
      ) =>
        !habit.completedDates.includes(
          todayKey
        )
    );

  /* ============================================================
   * TODAY TOTALS
   * ============================================================
   */

  const completedCount =
    completedTasks +
    completedHabits;

  const plannedCount =
    todayTasks.length +
    activeHabits.length;

  const remainingCount =
    unfinishedTasks.length +
    unfinishedHabits.length;

  const followThrough =
    plannedCount >
    0
      ? Math.round(
          (
            completedCount /
            plannedCount
          ) *
            100
        )
      : null;

  const dailyScore =
    calculateDailyScore(
      completedTasks,
      todayTasks.length,
      completedHabits,
      activeHabits.length
    );

  /* ============================================================
   * GREETING
   * ============================================================
   */

  const hour =
    new Date().getHours();

  let greeting =
    "Good evening.";

  if (
    hour <
    12
  ) {
    greeting =
      "Good morning.";
  } else if (
    hour <
    18
  ) {
    greeting =
      "Good afternoon.";
  }

  /* ============================================================
   * FOCUS
   * ============================================================
   */

  const focusTask =
    unfinishedTasks[0] ??
    null;

  const focusHabit =
    unfinishedHabits[0] ??
    null;

  let focusTitle =
    "Nothing urgent";

  let focusBody =
    "Your plan is clear right now.";

  let focusType =
    "Open day";

  if (
    focusTask
  ) {
    focusTitle =
      focusTask.text;

    focusBody =
      "This is your first unfinished task for today.";

    focusType =
      "Task";
  } else if (
    focusHabit
  ) {
    focusTitle =
      focusHabit.name;

    focusBody =
      "Your tasks are clear. This is the next unfinished habit.";

    focusType =
      "Habit";
  } else if (
    plannedCount >
    0
  ) {
    focusTitle =
      "Today is complete";

    focusBody =
      "Everything Atlas recorded for today is finished.";

    focusType =
      "Complete";
  }

  /* ============================================================
   * CONSISTENCY
   * ============================================================
   */

  const recentDays =
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
          today,
          index -
            6
        )
    );

  const recentStatuses =
    recentDays.map(
      (
        date
      ) =>
        getDayStatus(
          date,
          tasks,
          habits
        )
    );

  const recentPlannedDays =
    recentStatuses.filter(
      (
        status
      ) =>
        status.planned
    ).length;

  const recentOnTrackDays =
    recentStatuses.filter(
      (
        status
      ) =>
        status.planned &&
        status.onTrack
    ).length;

  const currentStreak =
    getCurrentStreak(
      today,
      tasks,
      habits
    );

  /* ============================================================
   * INTELLIGENCE
   * ============================================================
   */

  const atlasInsight =
    getAtlasIntelligence({
      tasks,
      habits,
      journalEntries,
      taskHistory,
    });

  /* ============================================================
   * UPCOMING ITEMS
   * ============================================================
   */

  const nextItems:
    {
      id: string;
      text: string;
      type:
        | "Task"
        | "Habit";
    }[] = [
      ...unfinishedTasks.map(
        (
          task
        ) => ({
          id:
            `task-${task.id}`,

          text:
            task.text,

          type:
            "Task" as const,
        })
      ),

      ...unfinishedHabits.map(
        (
          habit
        ) => ({
          id:
            `habit-${habit.id}`,

          text:
            habit.name,

          type:
            "Habit" as const,
        })
      ),
    ].slice(
      0,
      3
    );

  /* ============================================================
   * UI
   * ============================================================
   */

  return (
    <div className="w-full">
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div>
        <p className="text-sm text-white/35">
          {today.toLocaleDateString(
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
        </p>

        <h2 className="mt-1.5 text-4xl font-semibold tracking-[-0.035em]">
          {
            greeting
          }
        </h2>

        <p className="mt-1.5 text-white/45">
          Here&apos;s what today looks like.
        </p>
      </div>

      {displayEvent && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#5B7CFF]/25 bg-[#5B7CFF]/[0.07] px-4 py-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5B7CFF]/15 text-[#8EA3FF]"
          >
            <span className="text-base">●</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#8EA3FF]">
              {formatEventDate(
                displayEvent.occurrenceDate
              )}
              {displayEvent.event.repeatYearly
                ? " · Yearly"
                : ""}
            </p>

            <p className="mt-0.5 truncate font-medium text-white/85">
              {displayEvent.event.title}
            </p>
          </div>

          {displayEvent.event.time && (
            <p className="shrink-0 text-sm text-white/40">
              {formatEventTime(
                displayEvent.event.time
              )}
            </p>
          )}
        </div>
      )}

      {/* ======================================================
       * TOP ROW
       * ====================================================== */}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">

        {/* DAILY SCORE */}

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/30">
                Daily Score
              </p>

              <p className="mt-1 text-xs text-white/22">
                Today
              </p>
            </div>

            <div className="h-2 w-2 rounded-full bg-[#5B7CFF]" />
          </div>

          <div className="mt-3 flex items-end">
            <p className="text-5xl font-semibold tracking-[-0.055em]">
              {
                dailyScore ??
                "—"
              }
            </p>

            {dailyScore !==
              null && (
              <p className="mb-1.5 ml-2 text-sm text-white/25">
                / 100
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/20">
                Tasks
              </p>

              <p className="mt-1 text-lg font-semibold text-white/75">
                {
                  completedTasks
                }
                <span className="text-xs font-normal text-white/25">
                  {" "}
                  /{" "}
                  {
                    todayTasks.length
                  }
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/20">
                Habits
              </p>

              <p className="mt-1 text-lg font-semibold text-white/75">
                {
                  completedHabits
                }
                <span className="text-xs font-normal text-white/25">
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

        {/* TODAY */}

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/30">
                Today
              </p>

              <h3 className="mt-1.5 text-2xl font-semibold tracking-[-0.025em]">
                {remainingCount ===
                0
                  ? plannedCount >
                    0
                    ? "Everything is done"
                    : "Nothing planned yet"
                  : `${remainingCount} ${
                      remainingCount ===
                      1
                        ? "item"
                        : "items"
                    } remaining`}
              </h3>
            </div>

            <div className="text-right">
              <p className="text-2xl font-semibold text-white/70">
                {followThrough !==
                null
                  ? `${followThrough}%`
                  : "—"}
              </p>

              <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-white/20">
                Follow-through
              </p>
            </div>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#5B7CFF] transition-[width] duration-500"
              style={{
                width:
                  `${followThrough ?? 0}%`,
              }}
            />
          </div>

          <div className="mt-3 min-h-[96px]">
            {nextItems.length ===
            0 ? (
              <div className="flex h-[96px] items-center justify-center rounded-xl border border-dashed border-white/[0.06]">
                <p className="text-sm text-white/25">
                  {plannedCount >
                  0
                    ? "Nothing left for today."
                    : "Add something in Planning when you're ready."}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {nextItems.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.015] px-4 py-2"
                    >
                      <div className="h-2 w-2 shrink-0 rounded-full border border-white/20" />

                      <p className="min-w-0 flex-1 truncate text-sm text-white/60">
                        {
                          item.text
                        }
                      </p>

                      <span className="text-[9px] uppercase tracking-[0.1em] text-white/18">
                        {
                          item.type
                        }
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <button
            onClick={() =>
              onNavigate?.(
                "Planning"
              )
            }
            className="mt-2 text-xs font-medium text-[#8EA4FF]/80 transition hover:text-[#A8B7FF]"
          >
            Open Planning →
          </button>
        </div>
      </div>

      {/* ======================================================
       * SECOND ROW
       * ====================================================== */}

      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">

        {/* FOCUS */}

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/30">
              Focus
            </p>

            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-white/25">
              {
                focusType
              }
            </span>
          </div>

          <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-white/85">
            {
              focusTitle
            }
          </h3>

          <p className="mt-1.5 text-sm leading-5 text-white/35">
            {
              focusBody
            }
          </p>
        </div>

        {/* CONSISTENCY */}

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/30">
                Consistency
              </p>

              <p className="mt-1 text-xs text-white/22">
                Recent rhythm
              </p>
            </div>

            <button
              onClick={() =>
                onNavigate?.(
                  "Progress"
                )
              }
              className="text-xs text-white/25 transition hover:text-white/50"
            >
              View Progress →
            </button>
          </div>

          <div className="mt-3 flex items-end gap-2">
            <p className="text-4xl font-semibold tracking-[-0.045em]">
              {
                currentStreak
              }
            </p>

            <p className="mb-1 text-xs text-white/25">
              day streak
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            {recentStatuses.map(
              (
                status,
                index
              ) => (
                <div
                  key={
                    index
                  }
                  className="flex-1"
                >
                  <div
                    className={`h-1.5 rounded-full ${
                      !status.planned
                        ? "bg-white/[0.055]"
                        : status.onTrack
                          ? "bg-[#5B7CFF]"
                          : "bg-white/15"
                    }`}
                  />
                </div>
              )
            )}
          </div>

          <p className="mt-2.5 text-xs text-white/25">
            {
              recentOnTrackDays
            }{" "}
            of{" "}
            {
              recentPlannedDays
            }{" "}
            planned days on track
          </p>
        </div>
      </div>

      {/* ======================================================
       * ATLAS INTELLIGENCE
       * ====================================================== */}

      <div className="mt-3 rounded-2xl border border-[#5B7CFF]/15 bg-[#5B7CFF]/[0.035] px-5 py-3">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#5B7CFF]/20 bg-[#5B7CFF]/10 text-[#91A6FF]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M9 2.5C6.45 2.5 4.4 4.5 4.4 6.98C4.4 8.68 5.34 10.09 6.64 10.92V12.72H11.36V10.92C12.66 10.09 13.6 8.68 13.6 6.98C13.6 4.5 11.55 2.5 9 2.5Z"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinejoin="round"
              />

              <path
                d="M6.9 15H11.1"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#91A6FF]/70">
                Atlas Intelligence
              </p>

              <span className="rounded-md border border-white/[0.055] bg-white/[0.02] px-2 py-0.5 text-[9px] capitalize text-white/20">
                {
                  atlasInsight.confidence
                }{" "}
                confidence
              </span>
            </div>

            <h3 className="mt-1.5 text-base font-semibold tracking-[-0.015em] text-white/85">
              {
                atlasInsight.title
              }
            </h3>

            <p className="mt-1.5 max-w-4xl text-sm leading-5 text-white/42">
              {
                atlasInsight.observation
              }
            </p>

            <div className="mt-2 border-t border-[#5B7CFF]/10 pt-2">
  <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#91A6FF]/45">
    Recommendation
  </p>

  <p className="mt-1.5 text-sm leading-5 text-white/65">
    {
      atlasInsight.recommendation
    }
  </p>
</div>

            <p className="mt-1 text-[9px] text-white/16">
              Based on{" "}
              {
                atlasInsight.source
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}