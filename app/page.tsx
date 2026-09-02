"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Home from "./components/Home";

import Journal, {
  type JournalEntry,
} from "./components/Journal";

import Planning, {
  type Habit,
  type Task,
} from "./components/Planning";

import Progress from "./components/Progress";

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

        <aside className="w-60 shrink-0 border-r border-white/10 p-6">
          <h1 className="text-2xl font-semibold text-[#5B7CFF]">
            Atlas
          </h1>

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

        <section
          className={`min-w-0 flex-1 ${
            activePage === "Home"
              ? "px-10 py-7"
              : "p-10"
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
    </main>
  );
}