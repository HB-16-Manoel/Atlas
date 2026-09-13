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

function InlineScript({
  html,
}: {
  html: string;
}) {
  return (
    <script
      type={
        typeof window ===
        "undefined"
          ? "text/javascript"
          : "text/plain"
      }
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  );
}

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

      <header className="pb-1">
        <p
          id="atlas-local-date"
          className="text-[13px] text-white/35 md:text-sm"
          suppressHydrationWarning
        >
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

        <InlineScript
          html={'{var n=document.getElementById("atlas-local-date");if(n)n.textContent=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}'}
        />

        <h2
          id="atlas-local-greeting"
          className="mt-1 text-[2rem] font-semibold leading-[1.08] tracking-[-0.04em] md:mt-1.5 md:text-4xl"
          suppressHydrationWarning
        >
          {
            greeting
          }
        </h2>

        <InlineScript
          html={'{var n=document.getElementById("atlas-local-greeting"),h=new Date().getHours();if(n)n.textContent=h<12?"Good morning.":h<18?"Good afternoon.":"Good evening."}'}
        />

        <p className="mt-1.5 text-sm text-white/45 md:text-base">
          Here&apos;s what today looks like.
        </p>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-y-3 xl:grid-cols-10 xl:gap-x-4">
        {/* ====================================================
         * DAILY SCORE
         * ==================================================== */}

        <section className="order-1 flex h-full min-w-0 flex-col rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 xl:col-span-4 xl:col-start-1 xl:row-start-1 xl:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/30 md:text-xs">
                Daily Score
              </p>

              <p className="mt-1 text-[11px] text-white/22 md:text-xs">
                Today
              </p>
            </div>

            <div className="mt-0.5 h-2 w-2 rounded-full bg-[#5B7CFF]" />
          </div>

          <div className="mt-3 flex items-end md:mt-4">
            <p className="text-5xl font-semibold leading-none tracking-[-0.055em] md:text-6xl">
              {
                dailyScore ??
                "—"
              }
            </p>

            {dailyScore !==
              null && (
              <p className="mb-1 ml-2 text-sm text-white/25 md:mb-1.5">
                / 100
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 xl:mt-auto xl:gap-3 xl:pt-5">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 xl:px-4">
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

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 xl:px-4">
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
        </section>

        {/* ====================================================
         * FOCUS
         * ==================================================== */}

        <section className="order-2 flex h-full min-w-0 flex-col rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 xl:col-span-5 xl:col-start-1 xl:row-start-2 xl:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/30 md:text-xs">
              Focus
            </p>

            <span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-white/25">
              {focusType}
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-center pb-1 pt-3 xl:py-4">
            <h3 className="break-words text-xl font-semibold leading-tight tracking-[-0.025em] text-white/85 sm:text-2xl">
              {focusTitle}
            </h3>

            <p className="mt-1.5 text-sm leading-5 text-white/40 xl:mt-2">
              {focusBody}
            </p>
          </div>
        </section>

        {/* ====================================================
         * TODAY
         * ==================================================== */}

        <section className="order-3 min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 xl:col-span-6 xl:col-start-5 xl:row-start-1">
          <div className="flex items-start justify-between gap-4 xl:gap-5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/30 md:text-xs">
                Today
              </p>

              <h3 className="mt-1.5 text-xl font-semibold leading-tight tracking-[-0.025em] sm:text-2xl">
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

            <div className="shrink-0 text-right">
              <p className="text-xl font-semibold text-white/70 sm:text-2xl">
                {followThrough !==
                null
                  ? `${followThrough}%`
                  : "—"}
              </p>

              <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-white/20 sm:text-[10px]">
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

          <div className="mt-3 xl:min-h-[96px]">
            {nextItems.length ===
            0 ? (
              <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-white/[0.06] px-4 text-center xl:h-[96px]">
                <p className="text-sm leading-5 text-white/25">
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
                      className="flex min-h-10 items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.015] px-3.5 py-2 sm:px-4"
                    >
                      <div className="h-2 w-2 shrink-0 rounded-full border border-white/20" />

                      <p className="min-w-0 flex-1 truncate text-sm text-white/60">
                        {
                          item.text
                        }
                      </p>

                      <span className="shrink-0 text-[9px] uppercase tracking-[0.1em] text-white/18">
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
            type="button"
            onClick={() =>
              onNavigate?.(
                "Planning"
              )
            }
            className="-mb-1 mt-2 flex min-h-9 items-center text-xs font-medium text-[#8EA4FF]/80 transition hover:text-[#A8B7FF]"
          >
            Open Planning →
          </button>
        </section>

        {/* ====================================================
         * CONSISTENCY
         * ==================================================== */}

        <section className="order-4 min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 xl:col-span-5 xl:col-start-6 xl:row-start-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/30 md:text-xs">
                Consistency
              </p>

              <p className="mt-1 text-xs text-white/22">
                Recent rhythm
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate?.(
                  "Progress"
                )
              }
              className="-mr-1 -mt-1 flex min-h-10 shrink-0 items-center px-1 text-xs text-white/30 transition hover:text-white/50"
            >
              View Progress →
            </button>
          </div>

          <div className="mt-2.5 flex items-end gap-2 xl:mt-3">
            <p className="text-4xl font-semibold leading-none tracking-[-0.045em]">
              {
                currentStreak
              }
            </p>

            <p className="mb-0.5 text-xs text-white/25 xl:mb-1">
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
        </section>

        {/* ====================================================
         * ATLAS INTELLIGENCE
         * ==================================================== */}

        <section className="order-5 min-w-0 rounded-2xl border border-[#5B7CFF]/15 bg-[#5B7CFF]/[0.035] px-4 py-3.5 xl:col-span-10 xl:col-start-1 xl:row-start-3 xl:px-5 xl:py-3">
          <div className="flex items-start gap-3 xl:gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#5B7CFF]/20 bg-[#5B7CFF]/10 text-[#91A6FF] xl:h-9 xl:w-9">
              <svg
                aria-hidden="true"
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

              <h3 className="mt-1.5 text-base font-semibold leading-snug tracking-[-0.015em] text-white/85">
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
        </section>
      </div>
    </div>
  );
}
