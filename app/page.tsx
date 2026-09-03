"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Image from "next/image";

import Home from "./components/Home";

import Journal, {
  type JournalEntry,
} from "./components/Journal";

import Planning, {
  type Habit,
  type Task,
} from "./components/Planning";

import Progress from "./components/Progress";

function AtlasWordmark({
  compact = false,
}: {
  compact?: boolean;
}) {
  const logoSize =
    compact
      ? 32
      : 40;

  return (
    <div className="flex items-center gap-3">
      <Image
        src="/atlas-icon.svg"
        alt=""
        width={
          logoSize
        }
        height={
          logoSize
        }
        className="shrink-0"
        priority
      />

      <span
        aria-label="Atlas"
        className={`flex items-center font-semibold leading-none ${
          compact
            ? "text-lg"
            : "text-[1.35rem]"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 20"
          className="mr-1 h-[1.08em] w-[1.28em] shrink-0 overflow-visible"
          fill="none"
        >
          <path
            d="M3 18 12 3 21 18"
            stroke="#5B7CFF"
            strokeWidth="3.7"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>

        <span
          aria-hidden="true"
          className="tracking-[0.17em] text-[#F4F6FF]"
        >
          TLAS
        </span>
      </span>
    </div>
  );
}

type MobilePage =
  | "Home"
  | "Planning"
  | "Progress"
  | "Journal";

const mobilePages: MobilePage[] = [
  "Home",
  "Planning",
  "Progress",
  "Journal",
];

function MobileNavIcon({
  page,
}: {
  page: MobilePage;
}) {
  const iconClasses =
    "h-5 w-5";

  if (page === "Home") {
    return (
      <svg
        aria-hidden="true"
        className={iconClasses}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m3 11 9-8 9 8"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 10v10h14V10M9 20v-6h6v6"
        />
      </svg>
    );
  }

  if (page === "Planning") {
    return (
      <svg
        aria-hidden="true"
        className={iconClasses}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m8.5 14 2 2 4.5-5"
        />
      </svg>
    );
  }

  if (page === "Progress") {
    return (
      <svg
        aria-hidden="true"
        className={iconClasses}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 19V9m6 10V5m6 14v-7m4 7H2"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={iconClasses}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Zm16 0A2.5 2.5 0 0 0 17.5 3H13v17h4.5a2.5 2.5 0 0 1 2.5 2V5.5Z"
      />
    </svg>
  );
}

/* ============================================================
 * TASK HISTORY
 * ============================================================
 */

export type TaskHistoryEventType =
  | "created"
  | "completed"
  | "uncompleted"
  | "deleted";

export type TaskHistoryEvent = {
  id: string;

  taskId: number;

  taskText: string;

  taskDate: string;

  type: TaskHistoryEventType;

  timestamp: string;
};

/* ============================================================
 * MAIN ATLAS APP
 * ============================================================
 */

export default function AtlasApp() {
  const [
    activePage,
    setActivePage,
  ] = useState(
    "Home"
  );

  /* ============================================================
   * TASK STATE
   * ============================================================
   */

  const [
    tasks,
    setTasks,
  ] = useState<Task[]>(
    []
  );

  const [
    tasksLoaded,
    setTasksLoaded,
  ] =
    useState(false);

  /* ============================================================
   * HABIT STATE
   * ============================================================
   */

  const [
    habits,
    setHabits,
  ] = useState<Habit[]>(
    []
  );

  const [
    habitsLoaded,
    setHabitsLoaded,
  ] =
    useState(false);

  /* ============================================================
   * JOURNAL STATE
   * ============================================================
   */

  const [
    journalEntries,
    setJournalEntries,
  ] = useState<
    JournalEntry[]
  >([]);

  const [
    journalLoaded,
    setJournalLoaded,
  ] =
    useState(false);

  /* ============================================================
   * TASK HISTORY STATE
   * ============================================================
   */

  const [
    taskHistory,
    setTaskHistory,
  ] = useState<
    TaskHistoryEvent[]
  >([]);

  const [
    taskHistoryLoaded,
    setTaskHistoryLoaded,
  ] =
    useState(false);

  const previousTasksRef =
    useRef<Task[]>(
      []
    );

  const taskTrackingReadyRef =
    useRef(false);

  /* ============================================================
   * LOAD TASKS
   * ============================================================
   */

  useEffect(
    () => {
      try {
        const saved =
          localStorage.getItem(
            "atlas-tasks"
          );

        if (
          !saved
        ) {
          return;
        }

        const parsed =
          JSON.parse(
            saved
          );

        if (
          !Array.isArray(
            parsed
          )
        ) {
          return;
        }

        setTasks(
          parsed.map(
            (
              task: Task,
              index: number
            ): Task => ({
              ...task,

              order:
                typeof task.order ===
                "number"
                  ? task.order
                  : index,
            })
          )
        );
      } catch {
        console.log(
          "Atlas could not load tasks."
        );
      } finally {
        setTasksLoaded(
          true
        );
      }
    },
    []
  );

  /* ============================================================
   * SAVE TASKS
   * ============================================================
   */

  useEffect(
    () => {
      if (
        !tasksLoaded
      ) {
        return;
      }

      try {
        localStorage.setItem(
          "atlas-tasks",

          JSON.stringify(
            tasks
          )
        );
      } catch {
        console.log(
          "Atlas could not save tasks."
        );
      }
    },
    [
      tasks,
      tasksLoaded,
    ]
  );

  /* ============================================================
   * LOAD HABITS
   * ============================================================
   */

  useEffect(
    () => {
      try {
        const saved =
          localStorage.getItem(
            "atlas-habits"
          );

        if (
          !saved
        ) {
          return;
        }

        const parsed =
          JSON.parse(
            saved
          );

        if (
          !Array.isArray(
            parsed
          )
        ) {
          return;
        }

        setHabits(
          parsed.map(
            (
              habit: Habit,
              index: number
            ) => ({
              ...habit,

              order:
                typeof habit.order ===
                "number"
                  ? habit.order
                  : index,

              completedDates:
                Array.isArray(
                  habit.completedDates
                )
                  ? habit.completedDates
                  : [],
            })
          )
        );
      } catch {
        console.log(
          "Atlas could not load habits."
        );
      } finally {
        setHabitsLoaded(
          true
        );
      }
    },
    []
  );

  /* ============================================================
   * SAVE HABITS
   * ============================================================
   */

  useEffect(
    () => {
      if (
        !habitsLoaded
      ) {
        return;
      }

      try {
        localStorage.setItem(
          "atlas-habits",

          JSON.stringify(
            habits
          )
        );
      } catch {
        console.log(
          "Atlas could not save habits."
        );
      }
    },
    [
      habits,
      habitsLoaded,
    ]
  );

  /* ============================================================
   * LOAD JOURNAL
   * ============================================================
   */

  useEffect(
    () => {
      try {
        const saved =
          localStorage.getItem(
            "atlas-journal"
          );

        if (
          !saved
        ) {
          return;
        }

        const parsed =
          JSON.parse(
            saved
          );

        if (
          !Array.isArray(
            parsed
          )
        ) {
          return;
        }

        setJournalEntries(
          parsed.filter(
            (
              entry
            ): entry is JournalEntry =>
              entry &&
              typeof entry.date ===
                "string" &&
              typeof entry.text ===
                "string" &&
              typeof entry.updatedAt ===
                "string"
          )
        );
      } catch {
        console.log(
          "Atlas could not load journal entries."
        );
      } finally {
        setJournalLoaded(
          true
        );
      }
    },
    []
  );

  /* ============================================================
   * SAVE JOURNAL
   * ============================================================
   */

  useEffect(
    () => {
      if (
        !journalLoaded
      ) {
        return;
      }

      try {
        localStorage.setItem(
          "atlas-journal",

          JSON.stringify(
            journalEntries
          )
        );
      } catch {
        console.log(
          "Atlas could not save journal entries."
        );
      }
    },
    [
      journalEntries,
      journalLoaded,
    ]
  );

  /* ============================================================
   * LOAD TASK HISTORY
   * ============================================================
   */

  useEffect(
    () => {
      try {
        const saved =
          localStorage.getItem(
            "atlas-task-history"
          );

        if (
          !saved
        ) {
          return;
        }

        const parsed =
          JSON.parse(
            saved
          );

        if (
          !Array.isArray(
            parsed
          )
        ) {
          return;
        }

        setTaskHistory(
          parsed.filter(
            (
              event
            ): event is TaskHistoryEvent =>
              event &&
              typeof event.id ===
                "string" &&
              typeof event.taskId ===
                "number" &&
              typeof event.taskText ===
                "string" &&
              typeof event.taskDate ===
                "string" &&
              typeof event.type ===
                "string" &&
              typeof event.timestamp ===
                "string"
          )
        );
      } catch {
        console.log(
          "Atlas could not load task history."
        );
      } finally {
        setTaskHistoryLoaded(
          true
        );
      }
    },
    []
  );

  /* ============================================================
   * SAVE TASK HISTORY
   * ============================================================
   */

  useEffect(
    () => {
      if (
        !taskHistoryLoaded
      ) {
        return;
      }

      try {
        localStorage.setItem(
          "atlas-task-history",

          JSON.stringify(
            taskHistory
          )
        );
      } catch {
        console.log(
          "Atlas could not save task history."
        );
      }
    },
    [
      taskHistory,
      taskHistoryLoaded,
    ]
  );

  /* ============================================================
   * TRACK TASK HISTORY
   * ============================================================
   */

  useEffect(
    () => {
      if (
        !tasksLoaded ||
        !taskHistoryLoaded
      ) {
        return;
      }

      if (
        !taskTrackingReadyRef.current
      ) {
        previousTasksRef.current =
          tasks;

        taskTrackingReadyRef.current =
          true;

        return;
      }

      const previousTasks =
        previousTasksRef.current;

      const previousById =
        new Map(
          previousTasks.map(
            (
              task
            ) => [
              task.id,
              task,
            ] as const
          )
        );

      const currentById =
        new Map(
          tasks.map(
            (
              task
            ) => [
              task.id,
              task,
            ] as const
          )
        );

      const changes: {
        taskId: number;
        taskText: string;
        taskDate: string;
        type: TaskHistoryEventType;
      }[] = [];

      /* ========================================================
       * CREATED + COMPLETION CHANGES
       * ========================================================
       */

      tasks.forEach(
        (
          task
        ) => {
          const previous =
            previousById.get(
              task.id
            );

          if (
            !previous
          ) {
            changes.push({
              taskId:
                task.id,

              taskText:
                task.text,

              taskDate:
                task.date,

              type:
                "created",
            });

            return;
          }

          if (
            !previous.completed &&
            task.completed
          ) {
            changes.push({
              taskId:
                task.id,

              taskText:
                task.text,

              taskDate:
                task.date,

              type:
                "completed",
            });

            return;
          }

          if (
            previous.completed &&
            !task.completed
          ) {
            changes.push({
              taskId:
                task.id,

              taskText:
                task.text,

              taskDate:
                task.date,

              type:
                "uncompleted",
            });
          }
        }
      );

      /* ========================================================
       * DELETED TASKS
       * ========================================================
       */

      previousTasks.forEach(
        (
          task
        ) => {
          if (
            currentById.has(
              task.id
            )
          ) {
            return;
          }

          changes.push({
            taskId:
              task.id,

            taskText:
              task.text,

            taskDate:
              task.date,

            type:
              "deleted",
          });
        }
      );

      /* ========================================================
       * WRITE EVENTS
       * ========================================================
       */

      if (
        changes.length >
        0
      ) {
        const timestamp =
          new Date().toISOString();

        setTaskHistory(
          (
            current
          ) => [
            ...current,

            ...changes.map(
              (
                change,
                index
              ): TaskHistoryEvent => ({
                id:
                  `${change.taskId}-${change.type}-${timestamp}-${index}`,

                taskId:
                  change.taskId,

                taskText:
                  change.taskText,

                taskDate:
                  change.taskDate,

                type:
                  change.type,

                timestamp,
              })
            ),
          ]
        );
      }

      previousTasksRef.current =
        tasks;
    },
    [
      tasks,
      tasksLoaded,
      taskHistoryLoaded,
    ]
  );

  /* ============================================================
   * APP
   * ============================================================
   */

  return (
    <main className="min-h-screen bg-[#11131D] text-white">
      <div className="flex min-h-screen">

        {/* ====================================================
         * SIDEBAR
         * ==================================================== */}

        <aside className="hidden w-60 shrink-0 border-r border-white/10 p-6 md:block">
          <AtlasWordmark />

          <nav className="mt-10 space-y-2">
            {[
              "Home",
              "Planning",
              "Progress",
              "Journal",
            ].map(
              (
                page
              ) => (
                <button
                  key={
                    page
                  }

                  onClick={() =>
                    setActivePage(
                      page
                    )
                  }

                  className={`w-full cursor-pointer rounded-lg px-4 py-3 text-left transition-all duration-200 ${
                    activePage ===
                    page
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {
                    page
                  }
                </button>
              )
            )}
          </nav>

          <div className="mt-10">
            <button
              onClick={() =>
                setActivePage(
                  "Settings"
                )
              }

              className={`w-full cursor-pointer rounded-lg px-4 py-3 text-left transition-all duration-200 ${
                activePage ===
                "Settings"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              Settings
            </button>
          </div>
        </aside>

        {/* ====================================================
         * MAIN
         * ==================================================== */}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#11131D]/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl md:hidden">
            <AtlasWordmark
              compact
            />

            <button
              type="button"
              aria-label="Open Settings"
              aria-current={
                activePage === "Settings"
                  ? "page"
                  : undefined
              }
              onClick={() =>
                setActivePage(
                  "Settings"
                )
              }
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                activePage === "Settings"
                  ? "bg-[#5B7CFF]/15 text-[#7892FF]"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"
                />
              </svg>
            </button>
          </header>

          <section
          className={`min-w-0 flex-1 ${
            activePage === "Home"
              ? "px-4 pb-28 pt-4 md:px-10 md:py-4"
              : activePage === "Progress"
                ? "p-10 pb-28 md:p-10"
                : "px-4 pb-28 pt-4 md:p-10"
          }`}
        >

          {/* HOME */}

          {activePage ===
            "Home" && (
           <Home
  tasks={
    tasks
  }

  habits={
    habits
  }

  journalEntries={
    journalEntries
  }

  taskHistory={
    taskHistory
  }

  onNavigate={
    setActivePage
  }
/>
          )}

          {/* PLANNING */}

          {activePage ===
            "Planning" && (
            <Planning
              tasks={
                tasks
              }

              setTasks={
                setTasks
              }

              habits={
                habits
              }

              setHabits={
                setHabits
              }
            />
          )}

          {/* PROGRESS */}

          {activePage ===
            "Progress" && (
            <Progress
              tasks={
                tasks
              }

              habits={
                habits
              }
            />
          )}

          {/* JOURNAL */}

          {activePage ===
            "Journal" && (
            <Journal
              tasks={
                tasks
              }

              habits={
                habits
              }

              entries={
                journalEntries
              }

              setEntries={
                setJournalEntries
              }
            />
          )}

          {/* SETTINGS */}

          {activePage ===
            "Settings" && (
            <div className="mt-8">
              <h2 className="text-3xl font-semibold">
                Settings
              </h2>

              <p className="mt-2 text-white/50">
                Your settings will live here.
              </p>
            </div>
          )}
          </section>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#11131D]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {mobilePages.map(
              (
                page
              ) => {
                const isActive =
                  activePage ===
                  page;

                return (
                  <button
                    type="button"
                    key={
                      page
                    }
                    aria-current={
                      isActive
                        ? "page"
                        : undefined
                    }
                    onClick={() =>
                      setActivePage(
                        page
                      )
                    }
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition-colors ${
                      isActive
                        ? "bg-[#5B7CFF]/15 text-[#7892FF]"
                        : "text-white/45 hover:bg-white/5 hover:text-white/75"
                    }`}
                  >
                    <MobileNavIcon
                      page={
                        page
                      }
                    />
                    <span>
                      {
                        page
                      }
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </nav>
      </div>
    </main>
  );
}