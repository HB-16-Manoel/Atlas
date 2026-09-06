"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { flushSync } from "react-dom";

import { calculateDailyScore } from "../lib/dailyScore";

/* ============================================================
 * TYPES
 * ============================================================
 */

export type Task = {
  id: number;
  text: string;
  completed: boolean;
  date: string;
  order: number;
  carryOver?: boolean;
  carriedFrom?: string;
  carriedTo?: string;
};

export type AtlasEvent = {
  id: number;
  title: string;
  date: string;
  time?: string;
  repeatYearly: boolean;
};

export type Habit = {
  id: number;
  name: string;
  order: number;
  createdAt: string;
  completedDates: string[];
};

type DragPhase = "dragging" | "settling";

type DragState = {
  id: number;

  originalIndex: number;
  targetIndex: number;

  startY: number;
  currentY: number;

  top: number;
  left: number;
  width: number;
  height: number;

  text: string;

  phase: DragPhase;

  originalIds: number[];
  previewIds: number[];

  slotCenters: number[];
};

type PendingDragState = {
  task: Task;
  index: number;

  pointerId: number;

  startX: number;
  startY: number;
  currentY: number;
};

type MobileWeekGestureState = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type HabitDragState = {
  id: number;

  originalIndex: number;
  targetIndex: number;

  startY: number;
  currentY: number;

  top: number;
  left: number;
  width: number;
  height: number;

  name: string;

  phase: DragPhase;

  originalIds: number[];
  previewIds: number[];

  slotCenters: number[];
};

type PendingHabitDragState = {
  habit: Habit;
  index: number;

  pointerId: number;

  startX: number;
  startY: number;
};

/* ============================================================
 * DATE HELPERS
 * ============================================================
 */

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function startOfDay(date: Date) {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);

  d.setDate(d.getDate() - d.getDay());

  return d;
}

function startOfMobileWeek(date: Date) {
  const d = startOfDay(date);
  const mondayOffset =
    (d.getDay() + 6) %
    7;

  d.setDate(
    d.getDate() -
      mondayOffset
  );

  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isPast(date: Date) {
  return startOfDay(date) < startOfDay(new Date());
}

/* ============================================================
 * PLANNING
 * ============================================================
 */

type PlanningProps = {
  tasks: Task[];

  setTasks: Dispatch<
    SetStateAction<Task[]>
  >;

  habits: Habit[];

  setHabits: Dispatch<
    SetStateAction<Habit[]>
  >;

  events: AtlasEvent[];

  setEvents: Dispatch<
    SetStateAction<AtlasEvent[]>
  >;
};

export default function Planning({
  tasks,
  setTasks,
  habits,
  setHabits,
  events,
  setEvents,
}: PlanningProps) {
  /* ============================================================
   * TODAY
   * ============================================================
   */

  const [
    today,
    setToday,
  ] = useState(
    startOfDay(new Date())
  );

  useEffect(() => {
    let timeoutId: number;

    const scheduleNextMidnight =
      () => {
        const now =
          new Date();

        const nextMidnight =
          new Date(now);

        nextMidnight.setHours(
          24,
          0,
          0,
          0
        );

        const delay =
          nextMidnight.getTime() -
          now.getTime();

        timeoutId =
          window.setTimeout(
            () => {
              setToday(
                startOfDay(
                  new Date()
                )
              );

              scheduleNextMidnight();
            },
            delay
          );
      };

    scheduleNextMidnight();

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, []);

  /* ============================================================
   * PLANNING STATE
   * ============================================================
   */

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    new Date(today)
  );

  const [
    weekStart,
    setWeekStart,
  ] = useState(
    startOfWeek(today)
  );

  const [
    weekDirection,
    setWeekDirection,
  ] = useState<
    "left" | "right"
  >("right");

  const [
    addingTask,
    setAddingTask,
  ] = useState(false);

  const [
    newTask,
    setNewTask,
  ] = useState("");

  const [
    newTaskCarryOver,
    setNewTaskCarryOver,
  ] = useState(true);

  const [
    openTaskMenuId,
    setOpenTaskMenuId,
  ] = useState<number | null>(null);

  const [
    openHabitMenuId,
    setOpenHabitMenuId,
  ] = useState<number | null>(null);

  const [
    addingEvent,
    setAddingEvent,
  ] = useState(false);

  const [
    newEventTitle,
    setNewEventTitle,
  ] = useState("");

  const [
    newEventTime,
    setNewEventTime,
  ] = useState("");

  const [
    newEventRepeatYearly,
    setNewEventRepeatYearly,
  ] = useState(false);

  const [
    editingEventId,
    setEditingEventId,
  ] = useState<
    number | null
  >(null);

  const [
    editEventTitle,
    setEditEventTitle,
  ] = useState("");

  const [
    editEventTime,
    setEditEventTime,
  ] = useState("");

  const [
    editEventRepeatYearly,
    setEditEventRepeatYearly,
  ] = useState(false);

  /* ============================================================
   * HABIT STATE
   * ============================================================
   */

  const [
    addingHabit,
    setAddingHabit,
  ] = useState(false);

  const [
    newHabit,
    setNewHabit,
  ] = useState("");

  const [
    editingHabitId,
    setEditingHabitId,
  ] = useState<
    number | null
  >(null);

  const [
    editHabitName,
    setEditHabitName,
  ] = useState("");

  const habitEditCancelledRef =
    useRef(false);

  const [
    deletingHabits,
    setDeletingHabits,
  ] = useState<number[]>(
    []
  );

  const [
    confirmDeleteHabitId,
    setConfirmDeleteHabitId,
  ] = useState<
    number | null
  >(null);

  const [
    habitReorderMode,
    setHabitReorderMode,
  ] = useState(false);

  /* ============================================================
   * TASK EDITING
   * ============================================================
   */

  const [
    editingTaskId,
    setEditingTaskId,
  ] = useState<
    number | null
  >(null);

  const [
    editTaskText,
    setEditTaskText,
  ] = useState("");

  const editCancelledRef =
    useRef(false);

  /* ============================================================
   * TASK ANIMATION STATE
   * ============================================================
   */

  const [
    deletingTasks,
    setDeletingTasks,
  ] = useState<number[]>(
    []
  );

  const [
    visualCompleted,
    setVisualCompleted,
  ] = useState<number[]>(
    []
  );

  /* ============================================================
   * TASK DRAG
   * ============================================================
   */

  const [
    drag,
    setDrag,
  ] = useState<
    DragState | null
  >(null);

  const pendingDragRef =
    useRef<
      PendingDragState | null
    >(null);

  const taskLongPressTimerRef =
    useRef<number | null>(
      null
    );

  const suppressTaskMenuClickUntilRef =
    useRef(0);

  const mobileWeekGestureRef =
    useRef<
      MobileWeekGestureState | null
    >(null);

  const suppressMobileDateClickUntilRef =
    useRef(0);

  const inputVisibilityTimerRef =
    useRef<number | null>(
      null
    );

  const suppressDoubleClickUntilRef =
    useRef(0);

  const taskRefs =
    useRef<
      Map<
        number,
        HTMLDivElement
      >
    >(
      new Map()
    );

  const dragOverlayRef =
    useRef<
      HTMLDivElement | null
    >(null);

  const dragRef =
    useRef<
      DragState | null
    >(null);

  const animationFrameRef =
    useRef<
      number | null
    >(null);

  const rowAnimationsRef =
    useRef<
      Map<
        number,
        Animation
      >
    >(
      new Map()
    );

  /* ============================================================
   * HABIT DRAG
   * ============================================================
   */

  const [
    habitDrag,
    setHabitDrag,
  ] = useState<
    HabitDragState | null
  >(null);

  const habitDragRef =
    useRef<
      HabitDragState | null
    >(null);

  const pendingHabitDragRef =
    useRef<
      PendingHabitDragState | null
    >(null);

  const habitRefs =
    useRef<
      Map<
        number,
        HTMLDivElement
      >
    >(
      new Map()
    );

  const habitDragOverlayRef =
    useRef<
      HTMLDivElement | null
    >(null);

  const habitAnimationFrameRef =
    useRef<
      number | null
    >(null);

  const habitRowAnimationsRef =
    useRef<
      Map<
        number,
        Animation
      >
    >(
      new Map()
    );

  /* ============================================================
   * TIMERS
   * ============================================================
   */

  const completionTimersRef =
    useRef<
      Map<
        number,
        {
          completeTimer?: number;
          cleanupTimer?: number;
        }
      >
    >(
      new Map()
    );

  const deleteTimersRef =
    useRef<
      Map<
        number,
        number
      >
    >(
      new Map()
    );

  const habitDeleteTimersRef =
    useRef<
      Map<
        number,
        number
      >
    >(
      new Map()
    );

  /* ============================================================
   * DATES
   * ============================================================
   */

  const weekDays =
    Array.from(
      {
        length: 7,
      },
      (
        _,
        index
      ) => {
        const date =
          new Date(
            weekStart
          );

        date.setDate(
          weekStart.getDate() +
            index
        );

        return date;
      }
    );

  const mobileWeekStart =
    startOfMobileWeek(
      selectedDate
    );

  const mobileWeekDays =
    Array.from(
      {
        length: 7,
      },
      (
        _,
        index
      ) => {
        const date =
          new Date(
            mobileWeekStart
          );

        date.setDate(
          mobileWeekStart.getDate() +
            index
        );

        return date;
      }
    );

  const selectedDateKey =
    formatDateKey(
      selectedDate
    );

  const selectedDateIsPast =
    isPast(
      selectedDate
    );

  /* ============================================================
   * TASK LIST
   * ============================================================
   */

  const selectedTasks =
    tasks
      .filter(
        (
          task
        ) =>
          task.date ===
            selectedDateKey &&
          !deletingTasks.includes(
            task.id
          )
      )
      .sort(
        (
          a,
          b
        ) => {
          if (
            a.completed !==
            b.completed
          ) {
            return a.completed
              ? 1
              : -1;
          }

          return (
            a.order -
            b.order
          );
        }
      );

  const unfinishedTasks =
    selectedTasks.filter(
      (
        task
      ) =>
        !task.completed
    );

  const completedTasks =
    selectedTasks.filter(
      (
        task
      ) =>
        task.completed
    );

  const unfinishedById =
    new Map(
      unfinishedTasks.map(
        (
          task
        ) =>
          [
            task.id,
            task,
          ] as const
      )
    );

  const displayedUnfinishedTasks =
    drag
      ? drag.previewIds
          .map(
            (
              id
            ) =>
              unfinishedById.get(
                id
              )
          )
          .filter(
            (
              task
            ): task is Task =>
              Boolean(task)
          )
      : unfinishedTasks;

  const displayedTasks = [
    ...displayedUnfinishedTasks,
    ...completedTasks,
  ];

  const visualTaskCompletedCount =
    selectedTasks.filter(
      (
        task
      ) =>
        task.completed ||
        visualCompleted.includes(
          task.id
        )
    ).length;

  const allTasksComplete =
    selectedTasks.length >
      0 &&
    visualTaskCompletedCount ===
      selectedTasks.length;

  /* ============================================================
   * HABIT LIST
   * ============================================================
   */

  const selectedHabits =
    habits
      .filter(
        (
          habit
        ) =>
          habit.createdAt <=
            selectedDateKey &&
          !deletingHabits.includes(
            habit.id
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          a.order -
          b.order
      );

  const habitById =
    new Map(
      selectedHabits.map(
        (
          habit
        ) =>
          [
            habit.id,
            habit,
          ] as const
      )
    );

  const displayedHabits =
    habitDrag
      ? habitDrag.previewIds
          .map(
            (
              id
            ) =>
              habitById.get(
                id
              )
          )
          .filter(
            (
              habit
            ): habit is Habit =>
              Boolean(habit)
          )
      : selectedHabits;

  const completedHabitsCount =
    selectedHabits.filter(
      (
        habit
      ) =>
        habit.completedDates.includes(
          selectedDateKey
        )
    ).length;

  const dailyScore =
    selectedDate > today
      ? null
      : calculateDailyScore(
          visualTaskCompletedCount,
          selectedTasks.length,
          completedHabitsCount,
          selectedHabits.length
        );

  const allHabitsComplete =
    selectedHabits.length >
      0 &&
    completedHabitsCount ===
      selectedHabits.length;

  /* ============================================================
   * UPCOMING EVENTS
   * ============================================================
   */

  const upcomingEvents =
    events
      .map(
        (
          event
        ) => {
          if (!event.repeatYearly) {
            return {
              event,
              date: event.date,
            };
          }

          const monthDay =
            event.date.slice(5);
          const year =
            selectedDate.getFullYear();
          const thisYear =
            `${year}-${monthDay}`;

          return {
            event,
            date:
              thisYear >= selectedDateKey
                ? thisYear
                : `${year + 1}-${monthDay}`,
          };
        }
      )
      .filter(
        (
          occurrence
        ) =>
          occurrence.date >=
          selectedDateKey
      )
      .sort(
        (
          a,
          b
        ) => {
          const dateOrder =
            a.date.localeCompare(
              b.date
            );

          if (dateOrder !== 0) {
            return dateOrder;
          }

          const aTime =
            a.event.time;
          const bTime =
            b.event.time;

          if (!aTime && !bTime) {
            return 0;
          }

          if (!aTime) {
            return -1;
          }

          if (!bTime) {
            return 1;
          }

          return aTime.localeCompare(
            bTime
          );
        }
      )
      .slice(0, 3);

  /* ============================================================
   * EDIT HELPERS
   * ============================================================
   */

  const closeEditing =
    () => {
      editCancelledRef.current =
        true;

      setEditingTaskId(
        null
      );

      setEditTaskText(
        ""
      );
    };

  const closeHabitEditing =
    () => {
      habitEditCancelledRef.current =
        true;

      setEditingHabitId(
        null
      );

      setEditHabitName(
        ""
      );
    };

  const closeHabitControls =
    () => {
      closeHabitEditing();

      setConfirmDeleteHabitId(
        null
      );
    };

  const keepMobileInputVisible = (
    element: HTMLInputElement
  ) => {
    if (
      !window.matchMedia(
        "(max-width: 767px)"
      ).matches
    ) {
      return;
    }

    const revealInput =
      () => {
        element.scrollIntoView(
          {
            block:
              "center",
            inline:
              "nearest",
          }
        );
      };

    requestAnimationFrame(
      revealInput
    );

    if (
      inputVisibilityTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        inputVisibilityTimerRef.current
      );
    }

    inputVisibilityTimerRef.current =
      window.setTimeout(
        () => {
          revealInput();

          inputVisibilityTimerRef.current =
            null;
        },
        280
      );
  };

  /* ============================================================
   * WEEK NAVIGATION
   * ============================================================
   */

  const moveWeek = (
    amount: number
  ) => {
    closeEditing();
    closeHabitControls();

    setOpenTaskMenuId(
      null
    );

    setOpenHabitMenuId(
      null
    );

    setHabitReorderMode(
      false
    );

    setWeekDirection(
      amount >
        0
        ? "right"
        : "left"
    );

    const nextWeek =
      new Date(
        weekStart
      );

    nextWeek.setDate(
      weekStart.getDate() +
        amount *
          7
    );

    setWeekStart(
      nextWeek
    );

    if (
      isSameDay(
        startOfWeek(
          nextWeek
        ),
        startOfWeek(
          today
        )
      )
    ) {
      setSelectedDate(
        new Date(
          today
        )
      );
    } else {
      setSelectedDate(
        new Date(
          nextWeek
        )
      );
    }

    setAddingTask(
      false
    );

    setNewTask(
      ""
    );

    setAddingHabit(
      false
    );

    setNewHabit(
      ""
    );

    setVisualCompleted(
      []
    );
  };

  const goToToday =
    () => {
      closeEditing();
      closeHabitControls();

      setOpenTaskMenuId(
        null
      );

      setOpenHabitMenuId(
        null
      );

      setHabitReorderMode(
        false
      );

      setWeekDirection(
        "right"
      );

      setWeekStart(
        startOfWeek(
          today
        )
      );

      setSelectedDate(
        new Date(
          today
        )
      );

      setAddingTask(
        false
      );

      setNewTask(
        ""
      );

      setAddingHabit(
        false
      );

      setNewHabit(
        ""
      );

      setVisualCompleted(
        []
      );
    };

  const selectDate = (
    date: Date
  ) => {
    closeEditing();
    closeHabitControls();

    setOpenTaskMenuId(
      null
    );

    setOpenHabitMenuId(
      null
    );

    setHabitReorderMode(
      false
    );

    setSelectedDate(
      new Date(
        date
      )
    );

    setAddingTask(
      false
    );

    setNewTask(
      ""
    );

    setAddingHabit(
      false
    );

    setNewHabit(
      ""
    );

    setVisualCompleted(
      []
    );
  };

  const moveMobileWeek = (
    amount: number
  ) => {
    const nextDate =
      new Date(
        selectedDate
      );

    nextDate.setDate(
      selectedDate.getDate() +
        amount *
          7
    );

    setWeekStart(
      startOfWeek(
        nextDate
      )
    );

    setWeekDirection(
      amount > 0
        ? "right"
        : "left"
    );

    selectDate(
      nextDate
    );
  };

  const jumpToDate = (
    dateKey: string
  ) => {
    if (!dateKey) {
      return;
    }

    const nextDate =
      new Date(
        `${dateKey}T12:00:00`
      );

    if (
      Number.isNaN(
        nextDate.getTime()
      )
    ) {
      return;
    }

    setWeekDirection(
      nextDate >= selectedDate
        ? "right"
        : "left"
    );

    setWeekStart(
      startOfWeek(
        nextDate
      )
    );

    selectDate(
      nextDate
    );
  };

  const handleMobileWeekPointerDown = (
    event:
      ReactPointerEvent<HTMLDivElement>
  ) => {
    if (
      event.pointerType ===
        "mouse"
    ) {
      return;
    }

    mobileWeekGestureRef.current =
      {
        pointerId:
          event.pointerId,
        startX:
          event.clientX,
        startY:
          event.clientY,
        currentX:
          event.clientX,
        currentY:
          event.clientY,
      };
  };

  const handleMobileWeekPointerMove = (
    event:
      ReactPointerEvent<HTMLDivElement>
  ) => {
    const gesture =
      mobileWeekGestureRef.current;

    if (
      !gesture ||
      gesture.pointerId !==
        event.pointerId
    ) {
      return;
    }

    gesture.currentX =
      event.clientX;
    gesture.currentY =
      event.clientY;

    const dx =
      gesture.currentX -
      gesture.startX;
    const dy =
      gesture.currentY -
      gesture.startY;

    if (
      Math.abs(dx) >
        12 &&
      Math.abs(dx) >
        Math.abs(dy) *
          1.2
    ) {
      event.preventDefault();
    }
  };

  const releaseMobileWeekGesture = (
    event:
      ReactPointerEvent<HTMLDivElement>,
    cancelled = false
  ) => {
    const gesture =
      mobileWeekGestureRef.current;

    mobileWeekGestureRef.current =
      null;

    if (
      cancelled ||
      !gesture ||
      gesture.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const dx =
      event.clientX -
      gesture.startX;
    const dy =
      event.clientY -
      gesture.startY;

    if (
      Math.abs(dx) <
        52 ||
      Math.abs(dx) <=
        Math.abs(dy) *
          1.25
    ) {
      return;
    }

    suppressMobileDateClickUntilRef.current =
      performance.now() +
      400;

    event.preventDefault();

    moveMobileWeek(
      dx < 0
        ? 1
        : -1
    );
  };

  /* ============================================================
   * ADD TASK
   * ============================================================
   */

  const addTask =
    () => {
      if (
        selectedDateIsPast
      ) {
        return;
      }

      const text =
        newTask.trim();

      if (
        !text
      ) {
        return;
      }

      const unfinished =
        tasks.filter(
          (
            task
          ) =>
            task.date ===
              selectedDateKey &&
            !task.completed
        );

      const highestOrder =
        unfinished.length >
        0
          ? Math.max(
              ...unfinished.map(
                (
                  task
                ) =>
                  task.order
              )
            )
          : -1;

      const task: Task =
        {
          id:
            Date.now(),

          text,

          completed:
            false,

          date:
            selectedDateKey,

          order:
            highestOrder +
            1,

          carryOver:
            newTaskCarryOver,
        };

      setTasks(
        (
          current
        ) => [
          ...current,
          task,
        ]
      );

      setNewTask(
        ""
      );

      setNewTaskCarryOver(
        true
      );

      setAddingTask(
        false
      );
    };

  /* ============================================================
   * ADD EVENT
   * ============================================================
   */

  const resetEventForm =
    () => {
      setAddingEvent(false);
      setNewEventTitle("");
      setNewEventTime("");
      setNewEventRepeatYearly(false);
    };

  const addEvent =
    () => {
      if (selectedDateIsPast) {
        return;
      }

      const title =
        newEventTitle.trim();

      if (!title) {
        return;
      }

      setEvents(
        (
          current
        ) => [
          ...current,
          {
            id: Date.now(),
            title,
            date:
              selectedDateKey,
            time:
              newEventTime ||
              undefined,
            repeatYearly:
              newEventRepeatYearly,
          },
        ]
      );

      resetEventForm();
    };

  const startEditingEvent =
    (
      event: AtlasEvent
    ) => {
      setEditingEventId(
        event.id
      );
      setEditEventTitle(
        event.title
      );
      setEditEventTime(
        event.time ?? ""
      );
      setEditEventRepeatYearly(
        event.repeatYearly
      );
    };

  const cancelEditingEvent =
    () => {
      setEditingEventId(null);
      setEditEventTitle("");
      setEditEventTime("");
      setEditEventRepeatYearly(false);
    };

  const saveEditingEvent =
    () => {
      const title =
        editEventTitle.trim();

      if (
        editingEventId === null ||
        !title
      ) {
        return;
      }

      setEvents(
        (
          current
        ) =>
          current.map(
            (
              event
            ) =>
              event.id ===
                editingEventId
                ? {
                    ...event,
                    title,
                    time:
                      editEventTime ||
                      undefined,
                    repeatYearly:
                      editEventRepeatYearly,
                  }
                : event
          )
      );

      cancelEditingEvent();
    };

  const deleteEvent =
    (
      id: number
    ) => {
      if (selectedDateIsPast) {
        return;
      }

      setEvents(
        (
          current
        ) =>
          current.filter(
            (
              event
            ) =>
              event.id !== id
          )
      );

      if (
        editingEventId === id
      ) {
        cancelEditingEvent();
      }
    };

  /* ============================================================
   * ADD HABIT
   * ============================================================
   */

  const addHabit =
    () => {
      if (
        selectedDateIsPast
      ) {
        return;
      }

      const name =
        newHabit.trim();

      if (
        !name
      ) {
        return;
      }

      const highestOrder =
        habits.length >
        0
          ? Math.max(
              ...habits.map(
                (
                  habit
                ) =>
                  habit.order
              )
            )
          : -1;

      const habit: Habit =
        {
          id:
            Date.now(),

          name,

          order:
            highestOrder +
            1,

          createdAt:
            selectedDateKey,

          completedDates:
            [],
        };

      setHabits(
        (
          current
        ) => [
          ...current,
          habit,
        ]
      );

      setNewHabit(
        ""
      );

      setAddingHabit(
        false
      );
    };

  /* ============================================================
   * TOGGLE HABIT
   * ============================================================
   */

  const toggleHabit =
    (
      id: number
    ) => {
      if (
        selectedDateIsPast ||
        habitReorderMode
      ) {
        return;
      }

      setHabits(
        (
          current
        ) =>
          current.map(
            (
              habit
            ) => {
              if (
                habit.id !==
                id
              ) {
                return habit;
              }

              const completed =
                habit.completedDates.includes(
                  selectedDateKey
                );

              return {
                ...habit,

                completedDates:
                  completed
                    ? habit.completedDates.filter(
                        (
                          date
                        ) =>
                          date !==
                          selectedDateKey
                      )
                    : [
                        ...habit.completedDates,
                        selectedDateKey,
                      ],
              };
            }
          )
      );
    };

  /* ============================================================
   * EDIT HABIT
   * ============================================================
   */

  const startEditingHabit =
    (
      habit: Habit
    ) => {
      if (
        selectedDateIsPast ||
        habitReorderMode ||
        deletingHabits.includes(
          habit.id
        )
      ) {
        return;
      }

      setConfirmDeleteHabitId(
        null
      );

      habitEditCancelledRef.current =
        false;

      setEditingHabitId(
        habit.id
      );

      setEditHabitName(
        habit.name
      );
    };

  const saveEditingHabit =
    () => {
      if (
        editingHabitId ===
        null
      ) {
        return;
      }

      const trimmed =
        editHabitName.trim();

      if (
        trimmed
      ) {
        setHabits(
          (
            current
          ) =>
            current.map(
              (
                habit
              ) =>
                habit.id ===
                editingHabitId
                  ? {
                      ...habit,

                      name:
                        trimmed,
                    }
                  : habit
            )
        );
      }

      setEditingHabitId(
        null
      );

      setEditHabitName(
        ""
      );
    };

  const cancelEditingHabit =
    () => {
      habitEditCancelledRef.current =
        true;

      setEditingHabitId(
        null
      );

      setEditHabitName(
        ""
      );
    };

  /* ============================================================
   * DELETE HABIT CONFIRMATION
   * ============================================================
   */

  const askToDeleteHabit =
    (
      id: number
    ) => {
      if (
        selectedDateIsPast ||
        habitReorderMode
      ) {
        return;
      }

      if (
        editingHabitId !==
        null
      ) {
        closeHabitEditing();
      }

      setConfirmDeleteHabitId(
        id
      );
    };

  const cancelDeleteHabit =
    () => {
      setConfirmDeleteHabitId(
        null
      );
    };

  const deleteHabit =
    (
      id: number
    ) => {
      setConfirmDeleteHabitId(
        null
      );

      const existingTimer =
        habitDeleteTimersRef.current.get(
          id
        );

      if (
        existingTimer !==
        undefined
      ) {
        window.clearTimeout(
          existingTimer
        );
      }

      setDeletingHabits(
        (
          current
        ) =>
          current.includes(
            id
          )
            ? current
            : [
                ...current,
                id,
              ]
      );

      const timer =
        window.setTimeout(
          () => {
            setHabits(
              (
                current
              ) =>
                current.filter(
                  (
                    habit
                  ) =>
                    habit.id !==
                    id
                )
            );

            setDeletingHabits(
              (
                current
              ) =>
                current.filter(
                  (
                    habitId
                  ) =>
                    habitId !==
                    id
                )
            );

            habitDeleteTimersRef.current.delete(
              id
            );
          },
          330
        );

      habitDeleteTimersRef.current.set(
        id,
        timer
      );
    };

  /* ============================================================
   * HABIT REORDER MODE
   * ============================================================
   */

  const toggleHabitReorderMode =
    () => {
      if (
        selectedDateIsPast ||
        selectedHabits.length <
          2
      ) {
        return;
      }

      closeHabitControls();

      setAddingHabit(
        false
      );

      setNewHabit(
        ""
      );

      setHabitReorderMode(
        (
          current
        ) =>
          !current
      );
    };

  /* ============================================================
   * GENERIC TASK LIST FLIP
   * ============================================================
   */

  const animateListChange = (
    update: () => void,
    duration: number
  ) => {
    const first =
      new Map<
        number,
        DOMRect
      >();

    taskRefs.current.forEach(
      (
        element,
        id
      ) => {
        first.set(
          id,
          element.getBoundingClientRect()
        );
      }
    );

    update();

    requestAnimationFrame(
      () => {
        taskRefs.current.forEach(
          (
            element,
            id
          ) => {
            const firstRect =
              first.get(
                id
              );

            if (
              !firstRect
            ) {
              return;
            }

            const lastRect =
              element.getBoundingClientRect();

            const dx =
              firstRect.left -
              lastRect.left;

            const dy =
              firstRect.top -
              lastRect.top;

            if (
              Math.abs(
                dx
              ) <
                1 &&
              Math.abs(
                dy
              ) <
                1
            ) {
              return;
            }

            element.animate(
              [
                {
                  transform:
                    `translate3d(${dx}px, ${dy}px, 0)`,
                },

                {
                  transform:
                    "translate3d(0, 0, 0)",
                },
              ],
              {
                duration,

                easing:
                  "cubic-bezier(0.22, 0.8, 0.25, 1)",

                fill:
                  "both",
              }
            );
          }
        );
      }
    );
  };

  /* ============================================================
   * TASK CARRY-OVER
   * ============================================================
   */

  const toggleTaskCarryOver = (
    id: number
  ) => {
    if (
      selectedDateIsPast
    ) {
      return;
    }

    setTasks(
      (
        current
      ) =>
        current.map(
          (
            task
          ) =>
            task.id ===
            id
              ? {
                  ...task,

                  carryOver:
                    task.carryOver ===
                    false,
                }
              : task
        )
    );
  };

  /* ============================================================
   * COMPLETE / UNCOMPLETE TASK
   * ============================================================
   */

  const toggleTask = (
    id: number
  ) => {
    if (
      selectedDateIsPast
    ) {
      return;
    }
    const task =
      tasks.find(
        (
          item
        ) =>
          item.id ===
          id
      );

    if (
      !task
    ) {
      return;
    }

    if (
      editingTaskId ===
      id
    ) {
      closeEditing();
    }

    const existingTimers =
      completionTimersRef.current.get(
        id
      );

    if (
      existingTimers
    ) {
      if (
        existingTimers.completeTimer !==
        undefined
      ) {
        window.clearTimeout(
          existingTimers.completeTimer
        );
      }

      if (
        existingTimers.cleanupTimer !==
        undefined
      ) {
        window.clearTimeout(
          existingTimers.cleanupTimer
        );
      }

      completionTimersRef.current.delete(
        id
      );
    }

    if (
      !task.completed
    ) {
      setVisualCompleted(
        (
          current
        ) =>
          current.includes(
            id
          )
            ? current
            : [
                ...current,
                id,
              ]
      );

      const completeTimer =
        window.setTimeout(
          () => {
            animateListChange(
              () => {
                setTasks(
                  (
                    current
                  ) =>
                    current.map(
                      (
                        item
                      ) =>
                        item.id ===
                        id
                          ? {
                              ...item,

                              completed:
                                true,
                            }
                          : item
                    )
                );
              },
              1050
            );
          },
          420
        );

      const cleanupTimer =
        window.setTimeout(
          () => {
            setVisualCompleted(
              (
                current
              ) =>
                current.filter(
                  (
                    taskId
                  ) =>
                    taskId !==
                    id
                )
            );

            completionTimersRef.current.delete(
              id
            );
          },
          1250
        );

      completionTimersRef.current.set(
        id,
        {
          completeTimer,
          cleanupTimer,
        }
      );

      return;
    }

    setVisualCompleted(
      (
        current
      ) =>
        current.filter(
          (
            taskId
          ) =>
            taskId !==
            id
        )
    );

    animateListChange(
      () => {
        setTasks(
          (
            current
          ) => {
            const unfinished =
              current.filter(
                (
                  item
                ) =>
                  item.date ===
                    selectedDateKey &&
                  !item.completed
              );

            const smallestOrder =
              unfinished.length >
              0
                ? Math.min(
                    ...unfinished.map(
                      (
                        item
                      ) =>
                        item.order
                    )
                  )
                : 0;

            return current.map(
              (
                item
              ) =>
                item.id ===
                id
                  ? {
                      ...item,

                      completed:
                        false,

                      order:
                        smallestOrder -
                        1,
                    }
                  : item
            );
          }
        );
      },
      850
    );
  };

  /* ============================================================
   * EDIT TASK
   * ============================================================
   */

  const startEditingTask = (
    task: Task
  ) => {
    if (
      selectedDateIsPast ||
      deletingTasks.includes(
        task.id
      ) ||
      dragRef.current
    ) {
      return;
    }

    editCancelledRef.current =
      false;

    setEditingTaskId(
      task.id
    );

    setEditTaskText(
      task.text
    );
  };

  const saveEditingTask =
    () => {
      if (
        editingTaskId ===
        null
      ) {
        return;
      }

      const trimmed =
        editTaskText.trim();

      if (
        trimmed
      ) {
        setTasks(
          (
            current
          ) =>
            current.map(
              (
                task
              ) =>
                task.id ===
                editingTaskId
                  ? {
                      ...task,

                      text:
                        trimmed,
                    }
                  : task
            )
        );
      }

      setEditingTaskId(
        null
      );

      setEditTaskText(
        ""
      );
    };

  const cancelEditingTask =
    () => {
      editCancelledRef.current =
        true;

      setEditingTaskId(
        null
      );

      setEditTaskText(
        ""
      );
    };

  /* ============================================================
   * DELETE TASK
   * ============================================================
   */

  const deleteTask = (
    id: number
  ) => {
    if (
      selectedDateIsPast
    ) {
      return;
    }

    if (
      editingTaskId ===
      id
    ) {
      cancelEditingTask();
    }

    const existingDeleteTimer =
      deleteTimersRef.current.get(
        id
      );

    if (
      existingDeleteTimer !==
      undefined
    ) {
      window.clearTimeout(
        existingDeleteTimer
      );
    }

    const completionTimers =
      completionTimersRef.current.get(
        id
      );

    if (
      completionTimers
    ) {
      if (
        completionTimers.completeTimer !==
        undefined
      ) {
        window.clearTimeout(
          completionTimers.completeTimer
        );
      }

      if (
        completionTimers.cleanupTimer !==
        undefined
      ) {
        window.clearTimeout(
          completionTimers.cleanupTimer
        );
      }

      completionTimersRef.current.delete(
        id
      );
    }

    setVisualCompleted(
      (
        current
      ) =>
        current.filter(
          (
            taskId
          ) =>
            taskId !==
            id
        )
    );

    setDeletingTasks(
      (
        current
      ) =>
        current.includes(
          id
        )
          ? current
          : [
              ...current,
              id,
            ]
    );

    const deleteTimer =
      window.setTimeout(
        () => {
          setTasks(
            (
              current
            ) =>
              current.filter(
                (
                  task
                ) =>
                  task.id !==
                  id
              )
          );

          setDeletingTasks(
            (
              current
            ) =>
              current.filter(
                (
                  taskId
                ) =>
                  taskId !==
                  id
              )
          );

          deleteTimersRef.current.delete(
            id
          );
        },
        330
      );

    deleteTimersRef.current.set(
      id,
      deleteTimer
    );
  };

  /* ============================================================
   * TASK DRAG HELPERS
   * ============================================================
   */

  const cancelRowAnimations =
    () => {
      rowAnimationsRef.current.forEach(
        (
          animation
        ) =>
          animation.cancel()
      );

      rowAnimationsRef.current.clear();
    };

  const buildPreviewIds = (
    current: DragState,
    targetIndex: number
  ) => {
    const next =
      current.originalIds.filter(
        (
          id
        ) =>
          id !==
          current.id
      );

    const safeIndex =
      Math.max(
        0,
        Math.min(
          targetIndex,
          next.length
        )
      );

    next.splice(
      safeIndex,
      0,
      current.id
    );

    return next;
  };

  const animatePreviewChange = (
    current: DragState,
    targetIndex: number
  ) => {
    const nextPreviewIds =
      buildPreviewIds(
        current,
        targetIndex
      );

    const firstRects =
      new Map<
        number,
        DOMRect
      >();

    current.previewIds.forEach(
      (
        id
      ) => {
        if (
          id ===
          current.id
        ) {
          return;
        }

        const element =
          taskRefs.current.get(
            id
          );

        if (
          element
        ) {
          firstRects.set(
            id,
            element.getBoundingClientRect()
          );
        }
      }
    );

    cancelRowAnimations();

    const next: DragState = {
      ...current,

      targetIndex,

      previewIds:
        nextPreviewIds,
    };

    dragRef.current =
      next;

    flushSync(
      () => {
        setDrag(
          next
        );
      }
    );

    nextPreviewIds.forEach(
      (
        id
      ) => {
        if (
          id ===
          current.id
        ) {
          return;
        }

        const element =
          taskRefs.current.get(
            id
          );

        const firstRect =
          firstRects.get(
            id
          );

        if (
          !element ||
          !firstRect
        ) {
          return;
        }

        const lastRect =
          element.getBoundingClientRect();

        const dx =
          firstRect.left -
          lastRect.left;

        const dy =
          firstRect.top -
          lastRect.top;

        if (
          Math.abs(
            dx
          ) <
            0.5 &&
          Math.abs(
            dy
          ) <
            0.5
        ) {
          return;
        }

        const animation =
          element.animate(
            [
              {
                transform:
                  `translate3d(${dx}px, ${dy}px, 0)`,
              },

              {
                transform:
                  "translate3d(0, 0, 0)",
              },
            ],
            {
              duration:
                260,

              easing:
                "cubic-bezier(0.22, 0.8, 0.25, 1)",

              fill:
                "both",
            }
          );

        rowAnimationsRef.current.set(
          id,
          animation
        );

        animation.onfinish =
          () => {
            if (
              rowAnimationsRef.current.get(
                id
              ) ===
              animation
            ) {
              rowAnimationsRef.current.delete(
                id
              );
            }
          };

        animation.oncancel =
          () => {
            if (
              rowAnimationsRef.current.get(
                id
              ) ===
              animation
            ) {
              rowAnimationsRef.current.delete(
                id
              );
            }
          };
      }
    );
  };

  const updateDragTarget = (
    clientY: number
  ) => {
    const current =
      dragRef.current;

    if (
      !current ||
      current.phase !==
        "dragging"
    ) {
      return;
    }

    current.currentY =
      clientY;

    const offset =
      clientY -
      current.startY;

    const draggedCenter =
      current.top +
      offset +
      current.height /
        2;

    let bestIndex =
      current.originalIndex;

    let bestDistance =
      Infinity;

    current.slotCenters.forEach(
      (
        center,
        index
      ) => {
        const distance =
          Math.abs(
            draggedCenter -
              center
          );

        if (
          distance <
          bestDistance
        ) {
          bestDistance =
            distance;

          bestIndex =
            index;
        }
      }
    );

    if (
      bestIndex ===
      current.targetIndex
    ) {
      return;
    }

    animatePreviewChange(
      current,
      bestIndex
    );
  };

  const handlePointerMove = (
    event: PointerEvent
  ) => {
    const current =
      dragRef.current;

    if (
      !current ||
      current.phase !==
        "dragging"
    ) {
      return;
    }

    event.preventDefault();

    current.currentY =
      event.clientY;

    const offset =
      event.clientY -
      current.startY;

    if (
      dragOverlayRef.current
    ) {
      dragOverlayRef.current.style.transition =
        "none";

      dragOverlayRef.current.style.transform =
        `translate3d(0, ${offset}px, 0) scale(1.012)`;
    }

    if (
      animationFrameRef.current !==
      null
    ) {
      return;
    }

    animationFrameRef.current =
      requestAnimationFrame(
        () => {
          animationFrameRef.current =
            null;

          const latest =
            dragRef.current;

          if (
            !latest ||
            latest.phase !==
              "dragging"
          ) {
            return;
          }

          updateDragTarget(
            latest.currentY
          );
        }
      );
  };

  const commitPreviewOrder = (
    previewIds: number[]
  ) => {
    const orderMap =
      new Map<
        number,
        number
      >();

    previewIds.forEach(
      (
        id,
        index
      ) => {
        orderMap.set(
          id,
          index
        );
      }
    );

    setTasks(
      (
        existing
      ) =>
        existing.map(
          (
            task
          ) => {
            if (
              task.date !==
                selectedDateKey ||
              task.completed
            ) {
              return task;
            }

            const order =
              orderMap.get(
                task.id
              );

            if (
              order ===
              undefined
            ) {
              return task;
            }

            return {
              ...task,
              order,
            };
          }
        )
    );
  };

  const finishDrag =
    () => {
      const current =
        dragRef.current;

      if (
        !current
      ) {
        return;
      }

      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current =
          null;
      }

      const overlay =
        dragOverlayRef.current;

      const destinationElement =
        taskRefs.current.get(
          current.id
        );

      if (
        !overlay ||
        !destinationElement
      ) {
        cancelRowAnimations();

        dragRef.current =
          null;

        setDrag(
          null
        );

        return;
      }

      const destinationRect =
        destinationElement.getBoundingClientRect();

      const finalOffset =
        destinationRect.top -
        current.top;

      const currentOffset =
        current.currentY -
        current.startY;

      const distanceLeft =
        Math.abs(
          finalOffset -
            currentOffset
        );

      const settleDuration =
        Math.max(
          240,
          Math.min(
            340,
            210 +
              distanceLeft *
                0.65
          )
        );

      const settling: DragState = {
        ...current,

        phase:
          "settling",
      };

      dragRef.current =
        settling;

      setDrag(
        settling
      );

      overlay.style.transition =
        `transform ${settleDuration}ms cubic-bezier(0.22, 0.8, 0.25, 1)`;

      overlay.style.transform =
        `translate3d(0, ${finalOffset}px, 0) scale(1)`;

      window.setTimeout(
        () => {
          const latest =
            dragRef.current;

          if (
            !latest
          ) {
            return;
          }

          flushSync(
            () => {
              commitPreviewOrder(
                latest.previewIds
              );
            }
          );

          requestAnimationFrame(
            () => {
              dragRef.current =
                null;

              setDrag(
                null
              );
            }
          );
        },
        settleDuration
      );
    };

  const handlePointerUp =
    () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp
      );

      window.removeEventListener(
        "pointercancel",
        handlePointerUp
      );

      finishDrag();
    };

  const beginActualDrag = (
    pending: PendingDragState,
    currentClientY: number
  ) => {
    const {
      task,
      index,
      startY,
    } = pending;

    const element =
      taskRefs.current.get(
        task.id
      );

    if (
      !element
    ) {
      return;
    }

    cancelRowAnimations();

    suppressDoubleClickUntilRef.current =
      performance.now() +
      500;

    const rect =
      element.getBoundingClientRect();

    const originalIds =
      unfinishedTasks.map(
        (
          item
        ) =>
          item.id
      );

    const slotCenters =
      unfinishedTasks.map(
        (
          item
        ) => {
          const row =
            taskRefs.current.get(
              item.id
            );

          if (
            !row
          ) {
            return (
              rect.top +
              rect.height /
                2
            );
          }

          const rowRect =
            row.getBoundingClientRect();

          return (
            rowRect.top +
            rowRect.height /
              2
          );
        }
      );

    const initial: DragState = {
      id:
        task.id,

      originalIndex:
        index,

      targetIndex:
        index,

      startY,

      currentY:
        currentClientY,

      top:
        rect.top,

      left:
        rect.left,

      width:
        rect.width,

      height:
        rect.height,

      text:
        task.text,

      phase:
        "dragging",

      originalIds,

      previewIds: [
        ...originalIds,
      ],

      slotCenters,
    };

    dragRef.current =
      initial;

    flushSync(
      () => {
        setDrag(
          initial
        );
      }
    );

    const initialOffset =
      currentClientY -
      startY;

    if (
      dragOverlayRef.current
    ) {
      dragOverlayRef.current.style.transition =
        "none";

      dragOverlayRef.current.style.transform =
        `translate3d(0, ${initialOffset}px, 0) scale(1.012)`;
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      {
        passive:
          false,
      }
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp
    );

    window.addEventListener(
      "pointercancel",
      handlePointerUp
    );
  };

  const clearTaskLongPress =
    () => {
      if (
        taskLongPressTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          taskLongPressTimerRef.current
        );

        taskLongPressTimerRef.current =
          null;
      }

      pendingDragRef.current =
        null;
    };

  const handleTaskMenuPointerDown = (
    event:
      ReactPointerEvent<HTMLButtonElement>,
    task:
      Task,
    index:
      number
  ) => {
    event.stopPropagation();

    if (
      event.pointerType ===
        "mouse" ||
      task.completed ||
      selectedDateIsPast ||
      editingTaskId !==
        null ||
      index <
        0
    ) {
      return;
    }

    clearTaskLongPress();

    const trigger =
      event.currentTarget;

    const pending:
      PendingDragState =
      {
        task,
        index,
        pointerId:
          event.pointerId,
        startX:
          event.clientX,
        startY:
          event.clientY,
        currentY:
          event.clientY,
      };

    pendingDragRef.current =
      pending;

    try {
      trigger.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Safe fallback.
    }

    taskLongPressTimerRef.current =
      window.setTimeout(
        () => {
          taskLongPressTimerRef.current =
            null;

          const latest =
            pendingDragRef.current;

          if (
            !latest ||
            latest.pointerId !==
              pending.pointerId ||
            latest.task.id !==
              task.id
          ) {
            return;
          }

          pendingDragRef.current =
            null;

          setOpenTaskMenuId(
            null
          );

          setOpenHabitMenuId(
            null
          );

          suppressTaskMenuClickUntilRef.current =
            performance.now() +
            700;

          try {
            trigger.releasePointerCapture(
              pending.pointerId
            );
          } catch {
            // Safe fallback.
          }

          beginActualDrag(
            latest,
            latest.currentY
          );
        },
        360
      );
  };

  const handleTaskMenuPointerMove = (
    event:
      ReactPointerEvent<HTMLButtonElement>,
    task:
      Task
  ) => {
    const pending =
      pendingDragRef.current;

    if (
      !pending ||
      pending.pointerId !==
        event.pointerId ||
      pending.task.id !==
        task.id
    ) {
      return;
    }

    event.stopPropagation();

    pending.currentY =
      event.clientY;

    const distance =
      Math.hypot(
        event.clientX -
          pending.startX,
        event.clientY -
          pending.startY
      );

    if (distance <= 10) {
      return;
    }

    suppressTaskMenuClickUntilRef.current =
      performance.now() +
      350;

    clearTaskLongPress();

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      // Safe fallback.
    }
  };

  const handleTaskMenuPointerUp = (
    event:
      ReactPointerEvent<HTMLButtonElement>,
    task:
      Task
  ) => {
    const pending =
      pendingDragRef.current;

    if (
      !pending ||
      pending.pointerId !==
        event.pointerId ||
      pending.task.id !==
        task.id
    ) {
      return;
    }

    event.stopPropagation();

    clearTaskLongPress();

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      // Safe fallback.
    }
  };

  const handleTaskPointerDown = (
    event:
      ReactPointerEvent<HTMLDivElement>,
    task:
      Task,
    index:
      number
  ) => {
    if (
      event.pointerType !==
        "mouse"
    ) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button"
      ) ||
      target.closest(
        "input"
      )
    ) {
      return;
    }

    if (
      editingTaskId !==
      null
    ) {
      return;
    }

    if (
      task.completed ||
      selectedDateIsPast ||
      index <
        0
    ) {
      return;
    }

    setOpenTaskMenuId(
      null
    );

    pendingDragRef.current =
      {
        task,
        index,

        pointerId:
          event.pointerId,

        startX:
          event.clientX,

        startY:
          event.clientY,

        currentY:
          event.clientY,
      };

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Safe fallback.
    }
  };

  const handleTaskPointerMove = (
    event:
      ReactPointerEvent<HTMLDivElement>,
    task:
      Task
  ) => {
    const pending =
      pendingDragRef.current;

    if (
      !pending ||
      pending.pointerId !==
        event.pointerId ||
      pending.task.id !==
        task.id
    ) {
      return;
    }

    pending.currentY =
      event.clientY;

    const dx =
      event.clientX -
      pending.startX;

    const dy =
      event.clientY -
      pending.startY;

    const distance =
      Math.hypot(
        dx,
        dy
      );

    if (
      distance <
      6
    ) {
      return;
    }

    pendingDragRef.current =
      null;

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      // Safe fallback.
    }

    event.preventDefault();
    event.stopPropagation();

    beginActualDrag(
      pending,
      event.clientY
    );
  };

  const handleTaskPointerUp = (
    event:
      ReactPointerEvent<HTMLDivElement>,
    task:
      Task
  ) => {
    const pending =
      pendingDragRef.current;

    if (
      !pending ||
      pending.pointerId !==
        event.pointerId ||
      pending.task.id !==
        task.id
    ) {
      return;
    }

    pendingDragRef.current =
      null;

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      // Safe fallback.
    }
  };

  const handleTaskDoubleClick = (
    event:
      ReactMouseEvent<HTMLDivElement>,
    task:
      Task
  ) => {
    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button"
      ) ||
      target.closest(
        "input"
      )
    ) {
      return;
    }

    if (
      performance.now() <
      suppressDoubleClickUntilRef.current
    ) {
      return;
    }

    if (
      selectedDateIsPast ||
      dragRef.current
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    pendingDragRef.current =
      null;

    startEditingTask(
      task
    );
  };

  /* ============================================================
   * HABIT DRAG HELPERS
   * ============================================================
   */

  const cancelHabitRowAnimations =
    () => {
      habitRowAnimationsRef.current.forEach(
        (
          animation
        ) =>
          animation.cancel()
      );

      habitRowAnimationsRef.current.clear();
    };

  const buildHabitPreviewIds = (
    current:
      HabitDragState,
    targetIndex:
      number
  ) => {
    const next =
      current.originalIds.filter(
        (
          id
        ) =>
          id !==
          current.id
      );

    const safeIndex =
      Math.max(
        0,
        Math.min(
          targetIndex,
          next.length
        )
      );

    next.splice(
      safeIndex,
      0,
      current.id
    );

    return next;
  };

  const animateHabitPreviewChange = (
    current:
      HabitDragState,
    targetIndex:
      number
  ) => {
    const nextPreviewIds =
      buildHabitPreviewIds(
        current,
        targetIndex
      );

    const firstRects =
      new Map<
        number,
        DOMRect
      >();

    current.previewIds.forEach(
      (
        id
      ) => {
        if (
          id ===
          current.id
        ) {
          return;
        }

        const element =
          habitRefs.current.get(
            id
          );

        if (
          element
        ) {
          firstRects.set(
            id,
            element.getBoundingClientRect()
          );
        }
      }
    );

    cancelHabitRowAnimations();

    const next:
      HabitDragState =
        {
          ...current,

          targetIndex,

          previewIds:
            nextPreviewIds,
        };

    habitDragRef.current =
      next;

    flushSync(
      () => {
        setHabitDrag(
          next
        );
      }
    );

    nextPreviewIds.forEach(
      (
        id
      ) => {
        if (
          id ===
          current.id
        ) {
          return;
        }

        const element =
          habitRefs.current.get(
            id
          );

        const firstRect =
          firstRects.get(
            id
          );

        if (
          !element ||
          !firstRect
        ) {
          return;
        }

        const lastRect =
          element.getBoundingClientRect();

        const dx =
          firstRect.left -
          lastRect.left;

        const dy =
          firstRect.top -
          lastRect.top;

        if (
          Math.abs(
            dx
          ) <
            0.5 &&
          Math.abs(
            dy
          ) <
            0.5
        ) {
          return;
        }

        const animation =
          element.animate(
            [
              {
                transform:
                  `translate3d(${dx}px, ${dy}px, 0)`,
              },

              {
                transform:
                  "translate3d(0, 0, 0)",
              },
            ],
            {
              duration:
                260,

              easing:
                "cubic-bezier(0.22, 0.8, 0.25, 1)",

              fill:
                "both",
            }
          );

        habitRowAnimationsRef.current.set(
          id,
          animation
        );

        animation.onfinish =
          () => {
            if (
              habitRowAnimationsRef.current.get(
                id
              ) ===
              animation
            ) {
              habitRowAnimationsRef.current.delete(
                id
              );
            }
          };

        animation.oncancel =
          () => {
            if (
              habitRowAnimationsRef.current.get(
                id
              ) ===
              animation
            ) {
              habitRowAnimationsRef.current.delete(
                id
              );
            }
          };
      }
    );
  };

  const updateHabitDragTarget =
    (
      clientY:
        number
    ) => {
      const current =
        habitDragRef.current;

      if (
        !current ||
        current.phase !==
          "dragging"
      ) {
        return;
      }

      current.currentY =
        clientY;

      const offset =
        clientY -
        current.startY;

      const draggedCenter =
        current.top +
        offset +
        current.height /
          2;

      let bestIndex =
        current.originalIndex;

      let bestDistance =
        Infinity;

      current.slotCenters.forEach(
        (
          center,
          index
        ) => {
          const distance =
            Math.abs(
              draggedCenter -
                center
            );

          if (
            distance <
            bestDistance
          ) {
            bestDistance =
              distance;

            bestIndex =
              index;
          }
        }
      );

      if (
        bestIndex ===
        current.targetIndex
      ) {
        return;
      }

      animateHabitPreviewChange(
        current,
        bestIndex
      );
    };

  const handleHabitWindowPointerMove =
    (
      event:
        PointerEvent
    ) => {
      const current =
        habitDragRef.current;

      if (
        !current ||
        current.phase !==
          "dragging"
      ) {
        return;
      }

      event.preventDefault();

      current.currentY =
        event.clientY;

      const offset =
        event.clientY -
        current.startY;

      if (
        habitDragOverlayRef.current
      ) {
        habitDragOverlayRef.current.style.transition =
          "none";

        habitDragOverlayRef.current.style.transform =
          `translate3d(0, ${offset}px, 0) scale(1.012)`;
      }

      if (
        habitAnimationFrameRef.current !==
        null
      ) {
        return;
      }

      habitAnimationFrameRef.current =
        requestAnimationFrame(
          () => {
            habitAnimationFrameRef.current =
              null;

            const latest =
              habitDragRef.current;

            if (
              !latest ||
              latest.phase !==
                "dragging"
            ) {
              return;
            }

            updateHabitDragTarget(
              latest.currentY
            );
          }
        );
    };

  const commitHabitPreviewOrder =
    (
      previewIds:
        number[]
    ) => {
      const orderMap =
        new Map<
          number,
          number
        >();

      previewIds.forEach(
        (
          id,
          index
        ) => {
          orderMap.set(
            id,
            index
          );
        }
      );

      setHabits(
        (
          existing
        ) =>
          existing.map(
            (
              habit
            ) => {
              const order =
                orderMap.get(
                  habit.id
                );

              if (
                order ===
                undefined
              ) {
                return habit;
              }

              return {
                ...habit,
                order,
              };
            }
          )
      );
    };

  const finishHabitDrag =
    () => {
      const current =
        habitDragRef.current;

      if (
        !current
      ) {
        return;
      }

      if (
        habitAnimationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          habitAnimationFrameRef.current
        );

        habitAnimationFrameRef.current =
          null;
      }

      const overlay =
        habitDragOverlayRef.current;

      const destinationElement =
        habitRefs.current.get(
          current.id
        );

      if (
        !overlay ||
        !destinationElement
      ) {
        cancelHabitRowAnimations();

        habitDragRef.current =
          null;

        setHabitDrag(
          null
        );

        return;
      }

      const destinationRect =
        destinationElement.getBoundingClientRect();

      const finalOffset =
        destinationRect.top -
        current.top;

      const currentOffset =
        current.currentY -
        current.startY;

      const distanceLeft =
        Math.abs(
          finalOffset -
            currentOffset
        );

      const settleDuration =
        Math.max(
          220,
          Math.min(
            330,
            200 +
              distanceLeft *
                0.6
          )
        );

      const settling:
        HabitDragState =
          {
            ...current,

            phase:
              "settling",
          };

      habitDragRef.current =
        settling;

      setHabitDrag(
        settling
      );

      overlay.style.transition =
        `transform ${settleDuration}ms cubic-bezier(0.22, 0.8, 0.25, 1)`;

      overlay.style.transform =
        `translate3d(0, ${finalOffset}px, 0) scale(1)`;

      window.setTimeout(
        () => {
          const latest =
            habitDragRef.current;

          if (
            !latest
          ) {
            return;
          }

          flushSync(
            () => {
              commitHabitPreviewOrder(
                latest.previewIds
              );
            }
          );

          requestAnimationFrame(
            () => {
              habitDragRef.current =
                null;

              setHabitDrag(
                null
              );
            }
          );
        },
        settleDuration
      );
    };

  const handleHabitWindowPointerUp =
    () => {
      window.removeEventListener(
        "pointermove",
        handleHabitWindowPointerMove
      );

      window.removeEventListener(
        "pointerup",
        handleHabitWindowPointerUp
      );

      window.removeEventListener(
        "pointercancel",
        handleHabitWindowPointerUp
      );

      finishHabitDrag();
    };

  const beginActualHabitDrag =
    (
      pending:
        PendingHabitDragState,
      currentClientY:
        number
    ) => {
      const {
        habit,
        index,
        startY,
      } =
        pending;

      const element =
        habitRefs.current.get(
          habit.id
        );

      if (
        !element
      ) {
        return;
      }

      cancelHabitRowAnimations();

      const rect =
        element.getBoundingClientRect();

      const originalIds =
        selectedHabits.map(
          (
            item
          ) =>
            item.id
        );

      const slotCenters =
        selectedHabits.map(
          (
            item
          ) => {
            const row =
              habitRefs.current.get(
                item.id
              );

            if (
              !row
            ) {
              return (
                rect.top +
                rect.height /
                  2
              );
            }

            const rowRect =
              row.getBoundingClientRect();

            return (
              rowRect.top +
              rowRect.height /
                2
            );
          }
        );

      const initial:
        HabitDragState =
          {
            id:
              habit.id,

            originalIndex:
              index,

            targetIndex:
              index,

            startY,

            currentY:
              currentClientY,

            top:
              rect.top,

            left:
              rect.left,

            width:
              rect.width,

            height:
              rect.height,

            name:
              habit.name,

            phase:
              "dragging",

            originalIds,

            previewIds:
              [
                ...originalIds,
              ],

            slotCenters,
          };

      habitDragRef.current =
        initial;

      flushSync(
        () => {
          setHabitDrag(
            initial
          );
        }
      );

      const initialOffset =
        currentClientY -
        startY;

      if (
        habitDragOverlayRef.current
      ) {
        habitDragOverlayRef.current.style.transition =
          "none";

        habitDragOverlayRef.current.style.transform =
          `translate3d(0, ${initialOffset}px, 0) scale(1.012)`;
      }

      window.addEventListener(
        "pointermove",
        handleHabitWindowPointerMove,
        {
          passive:
            false,
        }
      );

      window.addEventListener(
        "pointerup",
        handleHabitWindowPointerUp
      );

      window.addEventListener(
        "pointercancel",
        handleHabitWindowPointerUp
      );
    };

  const handleHabitPointerDown =
    (
      event:
        ReactPointerEvent<HTMLDivElement>,
      habit:
        Habit,
      index:
        number
    ) => {
      if (
        !habitReorderMode ||
        selectedDateIsPast ||
        index <
          0
      ) {
        return;
      }

      const target =
        event.target as HTMLElement;

      const mobileDragHandle =
        target.closest(
          "[data-mobile-habit-drag-handle]"
        );

      if (
        event.pointerType !==
          "mouse" &&
        !mobileDragHandle
      ) {
        return;
      }

      if (
        (
          target.closest(
            "button"
          ) &&
          !mobileDragHandle
        ) ||
        target.closest(
          "input"
        )
      ) {
        return;
      }

      setOpenHabitMenuId(
        null
      );

      pendingHabitDragRef.current =
        {
          habit,
          index,

          pointerId:
            event.pointerId,

          startX:
            event.clientX,

          startY:
            event.clientY,
        };

      try {
        event.currentTarget.setPointerCapture(
          event.pointerId
        );
      } catch {
        // Safe fallback.
      }
    };

  const handleHabitPointerMove =
    (
      event:
        ReactPointerEvent<HTMLDivElement>,
      habit:
        Habit
    ) => {
      const pending =
        pendingHabitDragRef.current;

      if (
        !pending ||
        pending.pointerId !==
          event.pointerId ||
        pending.habit.id !==
          habit.id
      ) {
        return;
      }

      const dx =
        event.clientX -
        pending.startX;

      const dy =
        event.clientY -
        pending.startY;

      const distance =
        Math.hypot(
          dx,
          dy
        );

      if (
        distance <
        5
      ) {
        return;
      }

      pendingHabitDragRef.current =
        null;

      try {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        );
      } catch {
        // Safe fallback.
      }

      event.preventDefault();
      event.stopPropagation();

      beginActualHabitDrag(
        pending,
        event.clientY
      );
    };

  const handleHabitPointerUp =
    (
      event:
        ReactPointerEvent<HTMLDivElement>,
      habit:
        Habit
    ) => {
      const pending =
        pendingHabitDragRef.current;

      if (
        !pending ||
        pending.pointerId !==
          event.pointerId ||
        pending.habit.id !==
          habit.id
      ) {
        return;
      }

      pendingHabitDragRef.current =
        null;

      try {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        );
      } catch {
        // Safe fallback.
      }
    };

  /* ============================================================
   * CLEANUP
   * ============================================================
   */

  useEffect(
    () => {
      return () => {
        pendingDragRef.current =
          null;

        pendingHabitDragRef.current =
          null;

        mobileWeekGestureRef.current =
          null;

        if (
          taskLongPressTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            taskLongPressTimerRef.current
          );
        }

        if (
          inputVisibilityTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            inputVisibilityTimerRef.current
          );
        }

        window.removeEventListener(
          "pointermove",
          handlePointerMove
        );

        window.removeEventListener(
          "pointerup",
          handlePointerUp
        );

        window.removeEventListener(
          "pointercancel",
          handlePointerUp
        );

        window.removeEventListener(
          "pointermove",
          handleHabitWindowPointerMove
        );

        window.removeEventListener(
          "pointerup",
          handleHabitWindowPointerUp
        );

        window.removeEventListener(
          "pointercancel",
          handleHabitWindowPointerUp
        );

        if (
          animationFrameRef.current !==
          null
        ) {
          cancelAnimationFrame(
            animationFrameRef.current
          );
        }

        if (
          habitAnimationFrameRef.current !==
          null
        ) {
          cancelAnimationFrame(
            habitAnimationFrameRef.current
          );
        }

        rowAnimationsRef.current.forEach(
          (
            animation
          ) =>
            animation.cancel()
        );

        rowAnimationsRef.current.clear();

        habitRowAnimationsRef.current.forEach(
          (
            animation
          ) =>
            animation.cancel()
        );

        habitRowAnimationsRef.current.clear();

        completionTimersRef.current.forEach(
          (
            timers
          ) => {
            if (
              timers.completeTimer !==
              undefined
            ) {
              window.clearTimeout(
                timers.completeTimer
              );
            }

            if (
              timers.cleanupTimer !==
              undefined
            ) {
              window.clearTimeout(
                timers.cleanupTimer
              );
            }
          }
        );

        completionTimersRef.current.clear();

        deleteTimersRef.current.forEach(
          (
            timer
          ) => {
            window.clearTimeout(
              timer
            );
          }
        );

        deleteTimersRef.current.clear();

        habitDeleteTimersRef.current.forEach(
          (
            timer
          ) => {
            window.clearTimeout(
              timer
            );
          }
        );

        habitDeleteTimersRef.current.clear();
      };
    },
    []
  );

  /* ============================================================
   * UI
   * ============================================================
   */

  return (
    <div
      className="w-full"
      onPointerDownCapture={(event) => {
        const target =
          event.target as HTMLElement;

        if (
          target.closest(
            "[data-planning-context-menu]"
          )
        ) {
          return;
        }

        clearTaskLongPress();

        setOpenTaskMenuId(
          null
        );

        setOpenHabitMenuId(
          null
        );
      }}
    >
      <style jsx>{`
        @keyframes weekRight {
          from {
            opacity: 0.96;
            transform: translateX(7px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes weekLeft {
          from {
            opacity: 0.96;
            transform: translateX(-7px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .week-right {
          animation:
            weekRight
            600ms
            cubic-bezier(
              0.25,
              0.8,
              0.25,
              1
            );
        }

        .week-left {
          animation:
            weekLeft
            600ms
            cubic-bezier(
              0.25,
              0.8,
              0.25,
              1
            );
        }

        .mobile-week.week-right,
        .mobile-week.week-left {
          animation-duration:
            260ms;
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-week.week-right,
          .mobile-week.week-left {
            animation: none;
          }
        }

        @keyframes taskDelete {
          from {
            opacity: 1;
            transform:
              translate3d(
                0,
                0,
                0
              );
          }

          to {
            opacity: 0;
            transform:
              translate3d(
                8px,
                0,
                0
              );
          }
        }

        .task-delete {
          animation:
            taskDelete
            330ms
            cubic-bezier(
              0.4,
              0,
              0.2,
              1
            )
            forwards;
        }

        @keyframes habitDelete {
          from {
            opacity: 1;
            transform:
              translate3d(
                0,
                0,
                0
              );
          }

          to {
            opacity: 0;
            transform:
              translate3d(
                8px,
                0,
                0
              );
          }
        }

        .habit-delete {
          animation:
            habitDelete
            330ms
            cubic-bezier(
              0.4,
              0,
              0.2,
              1
            )
            forwards;
        }

        @keyframes completionGlow {
          0% {
            text-shadow:
              0 0 0
              rgba(
                91,
                124,
                255,
                0
              );
            transform:
              scale(1);
          }

          35% {
            text-shadow:
              0 0 12px
              rgba(
                91,
                124,
                255,
                0.75
              );
            transform:
              scale(1.035);
          }

          70% {
            text-shadow:
              0 0 7px
              rgba(
                91,
                124,
                255,
                0.38
              );
            transform:
              scale(1.01);
          }

          100% {
            text-shadow:
              0 0 4px
              rgba(
                91,
                124,
                255,
                0.18
              );
            transform:
              scale(1);
          }
        }

        .completion-glow {
          animation:
            completionGlow
            850ms
            cubic-bezier(
              0.22,
              0.8,
              0.25,
              1
            );
        }

        @keyframes habitDotCelebrate {
          0% {
            transform:
              scale(1);
            box-shadow:
              0 0 0
              rgba(
                91,
                124,
                255,
                0
              );
          }

          35% {
            transform:
              scale(2);
            box-shadow:
              0 0 10px
              rgba(
                91,
                124,
                255,
                0.75
              );
          }

          65% {
            transform:
              scale(0.85);
          }

          100% {
            transform:
              scale(1);
            box-shadow:
              0 0 3px
              rgba(
                91,
                124,
                255,
                0.25
              );
          }
        }

        .habit-dot-complete {
          animation:
            habitDotCelebrate
            700ms
            cubic-bezier(
              0.22,
              0.8,
              0.25,
              1
            )
            both;
        }

        .up-next-clamp {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      `}</style>

      {/* ======================================================
          FULL-WIDTH TOP AREA
          ====================================================== */}

      {/* HEADER */}

      <div className="flex items-end justify-between gap-3 md:items-center">
        <div className="min-w-0">
          <p className="text-xs text-white/40 md:text-sm">
            Planning
          </p>

          <label className="relative mt-1 block w-fit max-w-full cursor-pointer text-xl font-semibold leading-tight text-white transition focus-within:text-[#A8B5F0] active:text-white/75 md:hidden">
            <span className="block truncate">
              {selectedDate.toLocaleDateString(
                "en-US",
                {
                  month:
                    "long",
                  year:
                    "numeric",
                }
              )}
            </span>

            <input
              type="date"
              value={
                selectedDateKey
              }
              onChange={(event) =>
                jumpToDate(
                  event.target.value
                )
              }
              aria-label="Jump to another date"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>

          <h2 className="mt-1 hidden truncate text-3xl font-semibold md:block">
            {weekStart.toLocaleDateString(
              "en-US",
              {
                month:
                  "long",
                year:
                  "numeric",
              }
            )}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1 md:hidden">
          {!isSameDay(
            selectedDate,
            today
          ) && (
            <button
              type="button"
              onClick={
                goToToday
              }
              className="h-11 shrink-0 cursor-pointer rounded-xl border border-white/10 px-2.5 text-xs text-white/55 transition active:bg-white/[0.07] active:text-white"
            >
              Today
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              moveMobileWeek(-1)
            }
            aria-label="Previous week"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/[0.08] text-lg text-white/40 transition active:bg-white/[0.07] active:text-white/70"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={() =>
              moveMobileWeek(1)
            }
            aria-label="Next week"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/[0.08] text-lg text-white/40 transition active:bg-white/[0.07] active:text-white/70"
          >
            ›
          </button>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {!isSameDay(
            selectedDate,
            today
          ) && (
            <button
              onClick={
                goToToday
              }
              className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 transition-all duration-300 hover:bg-white/5 hover:text-white"
            >
              Today
            </button>
          )}

          <button
            onClick={() =>
              moveWeek(-1)
            }
            className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-white/60 transition-all duration-300 hover:bg-white/5 hover:text-white"
            aria-label="Previous week"
          >
            ←
          </button>

          <button
            onClick={() =>
              moveWeek(1)
            }
            className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-white/60 transition-all duration-300 hover:bg-white/5 hover:text-white"
            aria-label="Next week"
          >
            →
          </button>
        </div>
      </div>

      {/* MOBILE WEEK */}

      <div
        key={`mobile-${mobileWeekStart.toISOString()}`}
        onPointerDown={
          handleMobileWeekPointerDown
        }
        onPointerMove={
          handleMobileWeekPointerMove
        }
        onPointerUp={(event) =>
          releaseMobileWeekGesture(
            event
          )
        }
        onPointerCancel={(event) =>
          releaseMobileWeekGesture(
            event,
            true
          )
        }
        className={`mobile-week mt-5 touch-pan-y md:hidden ${weekDirection === "right" ? "week-right" : "week-left"}`}
      >
        <div className="grid w-full grid-cols-7 gap-1">
          {mobileWeekDays.map(
            (
              date
            ) => {
              const selected =
                isSameDay(
                  date,
                  selectedDate
                );

              const current =
                isSameDay(
                  date,
                  today
                );

              const dateKey =
                formatDateKey(
                  date
                );

              const hasEvent =
                events.some(
                  (
                    event
                  ) =>
                    event.date ===
                      dateKey ||
                    (
                      event.repeatYearly &&
                      event.date.slice(5) ===
                        dateKey.slice(5)
                    )
                );

              return (
                <button
                  key={
                    date.toISOString()
                  }
                  type="button"
                  onClick={() => {
                    if (
                      performance.now() <
                      suppressMobileDateClickUntilRef.current
                    ) {
                      return;
                    }

                    selectDate(
                      date
                    );
                  }}
                  aria-label={`${formatDate(date)}${current ? ", Today" : ""}${hasEvent ? ", event planned" : ""}`}
                  className={`relative min-h-14 min-w-0 cursor-pointer rounded-xl border px-0.5 py-2 text-center transition active:bg-white/[0.06] ${selected ? "border-[#5B7CFF]/65 bg-[#5B7CFF]/[0.12]" : current ? "border-white/20 bg-white/[0.025]" : "border-transparent bg-white/[0.015]"}`}
                >
                  <span className="block text-[9px] font-medium uppercase tracking-[0.04em] text-white/35">
                    {date.toLocaleDateString(
                      "en-US",
                      {
                        weekday:
                          "narrow",
                      }
                    )}
                  </span>

                  <span className={`mt-1 block text-sm font-semibold ${selected ? "text-[#8295E8]" : "text-white/70"}`}>
                    {date.getDate()}
                  </span>

                  {(hasEvent ||
                    (
                      current &&
                      !selected
                    )) && (
                    <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5">
                      {hasEvent && (
                        <span className="h-1 w-1 rounded-full bg-[#5B7CFF]" />
                      )}

                      {current &&
                        !selected && (
                          <span className="h-1 w-1 rounded-full bg-white/35" />
                        )}
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* WEEK */}

      <div
        key={
          weekStart.toISOString()
        }
        className={`mt-6 hidden grid-cols-7 gap-2 md:grid ${
          weekDirection ===
          "right"
            ? "week-right"
            : "week-left"
        }`}
      >
        {weekDays.map(
          (
            date
          ) => {
            const selected =
              isSameDay(
                date,
                selectedDate
              );

            const current =
              isSameDay(
                date,
                today
              );

            const dateKey =
              formatDateKey(
                date
              );

            const hasEvent =
              events.some(
                (
                  event
                ) =>
                  event.date ===
                    dateKey ||
                  (
                    event.repeatYearly &&
                    event.date.slice(5) ===
                      dateKey.slice(5)
                  )
              );

            return (
              <button
                key={
                  date.toISOString()
                }
                onClick={() =>
                  selectDate(
                    date
                  )
                }
                className={`cursor-pointer rounded-2xl border p-4 text-center transition-all duration-300 ease-out ${
                  selected
                    ? "scale-105 border-[#5B7CFF] bg-[#5B7CFF]/15 shadow-lg shadow-[#5B7CFF]/10"
                    : "border-white/10 bg-white/[0.03] hover:scale-[1.02] hover:bg-white/[0.06]"
                }`}
              >
                <p className="text-xs text-white/40">
                  {date.toLocaleDateString(
                    "en-US",
                    {
                      weekday:
                        "short",
                    }
                  )}
                </p>

                <p
                  className={`mt-2 text-2xl font-semibold transition-all duration-300 ${
                    selected
                      ? "text-[#5B7CFF]"
                      : "text-white"
                  }`}
                >
                  {date.getDate()}
                </p>

                {hasEvent && (
                  <span
                    aria-label="Event planned"
                    className="mx-auto mt-2 block h-1.5 w-1.5 rounded-full bg-[#5B7CFF]"
                  />
                )}

                {current && (
                  <p
                    className={`mt-1 text-xs ${
                      selected
                        ? "text-[#5B7CFF]"
                        : "text-white/30"
                    }`}
                  >
                    Today
                  </p>
                )}
              </button>
            );
          }
        )}
      </div>

      {/* ======================================================
          TWO-COLUMN CONTENT AREA
          ====================================================== */}

      <div className="mt-7 grid grid-cols-1 gap-8 md:mt-10 md:gap-10 xl:grid-cols-[minmax(0,2.05fr)_minmax(280px,0.95fr)]">

        {/* ====================================================
            LEFT COLUMN
            ==================================================== */}

        <div className="min-w-0">

          {/* DAY HEADER */}

          <div className="flex items-start justify-between gap-3 md:items-end md:gap-4">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold md:hidden">
                {isSameDay(
                  selectedDate,
                  today
                )
                  ? "Today"
                  : selectedDate.toLocaleDateString(
                      "en-US",
                      {
                        weekday:
                          "short",
                        month:
                          "short",
                        day:
                          "numeric",
                      }
                    )}

                {!isSameDay(
                  selectedDate,
                  today
                ) && (
                  <span className="ml-2 text-xs font-normal text-white/30">
                    {selectedDate < today
                      ? "Past"
                      : "Upcoming"}
                  </span>
                )}
              </h3>

              <p className="hidden text-sm text-white/40 md:block">
                {formatDate(selectedDate)}
              </p>

              <h3 className="mt-1 hidden text-2xl font-semibold md:block">
                {isSameDay(selectedDate, today)
                  ? "Today"
                  : selectedDate < today
                    ? "Past day"
                    : "Upcoming"}
              </h3>
            </div>

            {!selectedDateIsPast && (
              <div className="flex shrink-0 gap-1.5 md:gap-2">
                {!addingEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingTask(false);
                      setNewTask("");
                      setAddingHabit(false);
                      setAddingEvent(true);
                    }}
                    className="min-h-11 cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white active:bg-white/[0.08] active:text-white md:px-3 md:text-sm"
                  >
                    + Event
                  </button>
                )}

                {!addingTask && (
                  <button
                    type="button"
                    onClick={() => {
                      resetEventForm();
                      setNewTaskCarryOver(true);
                      setAddingTask(true);
                    }}
                    className="min-h-11 cursor-pointer rounded-lg bg-[#5B7CFF] px-2.5 py-2 text-xs font-medium transition hover:opacity-90 active:opacity-80 md:px-3 md:text-sm"
                  >
                    + Task
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ADD TASK */}

          {addingTask &&
            !selectedDateIsPast && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:mt-5 md:p-5">
                <input
                  autoFocus
                  enterKeyHint="done"
                  onFocus={(event) =>
                    keepMobileInputVisible(
                      event.currentTarget
                    )
                  }
                  value={newTask}
                  onChange={(event) =>
                    setNewTask(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTask();
                    }

                    if (event.key === "Escape") {
                      setAddingTask(false);
                      setNewTask("");
                    }
                  }}
                  placeholder="What needs to get done?"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#5B7CFF]/50"
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setNewTaskCarryOver(
                        (current) => !current
                      )
                    }
                    aria-pressed={newTaskCarryOver}
                    title={
                      newTaskCarryOver
                        ? "Unfinished task will move to the next day"
                        : "Task stays only on this date"
                    }
                    className="w-fit cursor-pointer py-1 text-xs text-white/30 transition hover:text-white/55"
                  >
                    Carry over
                    <span
                      className={
                        newTaskCarryOver
                          ? "text-[#8295E8]/75"
                          : "text-white/25"
                      }
                    >
                      {" · "}
                      {newTaskCarryOver
                        ? "On"
                        : "Off"}
                    </span>
                  </button>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingTask(false);
                        setNewTask("");
                        setNewTaskCarryOver(true);
                      }}
                      className="min-h-11 cursor-pointer rounded-lg px-4 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white sm:min-h-0"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={addTask}
                      className="min-h-11 cursor-pointer rounded-lg bg-[#5B7CFF] px-4 py-2 text-sm font-medium transition hover:opacity-90 sm:min-h-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

          {addingEvent &&
            !selectedDateIsPast && (
              <div className="mt-4 rounded-2xl border border-[#5B7CFF]/20 bg-[#5B7CFF]/[0.04] p-4 md:mt-5 md:p-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <input
                    autoFocus
                    enterKeyHint="done"
                    onFocus={(event) =>
                      keepMobileInputVisible(
                        event.currentTarget
                      )
                    }
                    value={newEventTitle}
                    onChange={(event) =>
                      setNewEventTitle(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addEvent();
                      }

                      if (event.key === "Escape") {
                        resetEventForm();
                      }
                    }}
                    placeholder="Birthday, first day of school..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#5B7CFF]/50"
                  />

                  <div className="flex min-w-0 gap-2 sm:hidden">
                    <label className="relative flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-3.5">
                      <span className="min-w-0">
                        <span className="block text-[10px] uppercase tracking-[0.12em] text-white/25">
                          Time
                        </span>

                        <span className="mt-0.5 block truncate text-sm text-white/70">
                          {newEventTime ||
                            "Optional"}
                        </span>
                      </span>

                      <svg
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-white/30"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <circle
                          cx="10"
                          cy="10"
                          r="6.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <path
                          d="M10 6.5V10L12.5 11.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>

                      <input
                        type="time"
                        onFocus={(event) =>
                          keepMobileInputVisible(
                            event.currentTarget
                          )
                        }
                        value={
                          newEventTime
                        }
                        onChange={(event) =>
                          setNewEventTime(
                            event.target.value
                          )
                        }
                        aria-label="Optional event time"
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </label>

                    {newEventTime && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewEventTime(
                            ""
                          )
                        }
                        aria-label="Clear event time"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-lg text-white/35 transition active:bg-white/[0.06] active:text-white/70"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <input
                    type="time"
                    onFocus={(event) =>
                      keepMobileInputVisible(
                        event.currentTarget
                      )
                    }
                    value={newEventTime}
                    onChange={(event) =>
                      setNewEventTime(event.target.value)
                    }
                    aria-label="Optional event time"
                    className="hidden w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white/70 outline-none focus:border-[#5B7CFF]/50 sm:block"
                  />
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setNewEventRepeatYearly(
                        (current) => !current
                      )
                    }
                    aria-pressed={newEventRepeatYearly}
                    className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-xs text-white/55 transition active:text-white/75 md:min-h-0 md:active:text-white/55"
                  >
                    <span>Repeat yearly</span>
                    <span
                      aria-hidden="true"
                      className={`relative h-5 w-9 shrink-0 overflow-hidden rounded-full transition-colors ${newEventRepeatYearly ? "bg-[#5B7CFF]" : "bg-white/15"}`}
                    >
                      <span
                        className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${newEventRepeatYearly ? "translate-x-[18px]" : "translate-x-0.5"}`}
                      />
                    </span>
                  </button>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetEventForm}
                      className="min-h-11 cursor-pointer rounded-lg px-4 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white active:bg-white/[0.06] md:min-h-0"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={addEvent}
                      className="min-h-11 cursor-pointer rounded-lg bg-[#5B7CFF] px-4 py-2 text-sm font-medium transition hover:opacity-90 active:opacity-80 md:min-h-0"
                    >
                      Add event
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* TASK LIST */}

          <div className="mt-5 md:mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/60">
                Tasks
              </p>

              {selectedTasks.length >
                0 && (
                <p
                  className={`text-xs transition-all duration-500 ${
                    allTasksComplete
                      ? "completion-glow font-medium text-[#5B7CFF]"
                      : "text-white/30"
                  }`}
                >
                  {
                    visualTaskCompletedCount
                  }
                  /
                  {
                    selectedTasks.length
                  }{" "}
                  complete
                </p>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {selectedTasks.length ===
              0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-white/40">
                    {selectedDateIsPast
                      ? "No tasks recorded."
                      : "Nothing planned yet."}
                  </p>
                </div>
              ) : (
                displayedTasks.map(
                  (
                    task
                  ) => {
                    const isDragged =
                      drag?.id ===
                      task.id;

                    const visuallyCompleted =
                      task.completed ||
                      visualCompleted.includes(
                        task.id
                      );

                    const unfinishedIndex =
                      unfinishedTasks.findIndex(
                        (
                          item
                        ) =>
                          item.id ===
                          task.id
                      );

                    const taskCarryOverActive =
                      task.carryOver !==
                        false &&
                      !task.completed;

                    return (
                      <div
                        key={
                          task.id
                        }

                        ref={(
                          element
                        ) => {
                          if (
                            element
                          ) {
                            taskRefs.current.set(
                              task.id,
                              element
                            );
                          } else {
                            taskRefs.current.delete(
                              task.id
                            );
                          }
                        }}

                        onPointerDown={(
                          event
                        ) =>
                          handleTaskPointerDown(
                            event,
                            task,
                            unfinishedIndex
                          )
                        }

                        onPointerMove={(
                          event
                        ) =>
                          handleTaskPointerMove(
                            event,
                            task
                          )
                        }

                        onPointerUp={(
                          event
                        ) =>
                          handleTaskPointerUp(
                            event,
                            task
                          )
                        }

                        onPointerCancel={(
                          event
                        ) =>
                          handleTaskPointerUp(
                            event,
                            task
                          )
                        }

                        onDoubleClick={(
                          event
                        ) =>
                          handleTaskDoubleClick(
                            event,
                            task
                          )
                        }

                        className={`group relative flex w-full min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-2xl border p-3.5 touch-pan-y md:flex-nowrap md:gap-4 md:p-4 ${
                          task.carriedFrom &&
                          !visuallyCompleted
                            ? "border-[#5B7CFF]/15 bg-[#5B7CFF]/[0.025]"
                            : "border-white/10 bg-white/[0.03]"
                        } ${
                          !task.completed &&
                          !selectedDateIsPast &&
                          editingTaskId !==
                            task.id
                            ? "md:cursor-grab md:active:cursor-grabbing"
                            : ""
                        } ${
                          isDragged
                            ? "invisible"
                            : ""
                        } ${
                          deletingTasks.includes(
                            task.id
                          )
                            ? "task-delete"
                            : ""
                        }`}

                        style={{
                          transition:
                            "background-color 300ms ease, opacity 300ms ease",

                          userSelect:
                            editingTaskId ===
                            task.id
                              ? "text"
                              : "none",
                        }}
                      >
                        {/* CHECKBOX */}

                        <button
                          onPointerDown={(
                            event
                          ) =>
                            event.stopPropagation()
                          }

                          onDoubleClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }

                          onClick={() =>
                            toggleTask(
                              task.id
                            )
                          }

                          disabled={
                            selectedDateIsPast
                          }

                          className={`relative z-20 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition active:bg-white/[0.04] md:h-5 md:w-5 md:rounded-none md:active:bg-transparent ${
                            selectedDateIsPast
                              ? "cursor-default"
                              : "cursor-pointer"
                          }`}

                          aria-label={
                            task.completed
                              ? "Mark task incomplete"
                              : "Mark task complete"
                          }
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-500 ease-out ${
                              visuallyCompleted
                                ? "border-[#5B7CFF] bg-[#5B7CFF]"
                                : "border-white/20 hover:border-white/40"
                            }`}
                          >
                            <span
                              className={`text-xs text-white transition-all duration-500 ${
                                visuallyCompleted
                                  ? "scale-100 opacity-100"
                                  : "scale-50 opacity-0"
                              }`}
                            >
                              ✓
                            </span>
                          </span>
                        </button>

                        {/* TEXT / EDITOR */}

                        <span className="flex min-w-0 flex-1 overflow-hidden">
                          {editingTaskId ===
                          task.id ? (
                            <input
                              autoFocus
                              enterKeyHint="done"
                              onFocus={(event) =>
                                keepMobileInputVisible(
                                  event.currentTarget
                                )
                              }
                              value={
                                editTaskText
                              }
                              onPointerDown={(
                                event
                              ) =>
                                event.stopPropagation()
                              }
                              onDoubleClick={(
                                event
                              ) =>
                                event.stopPropagation()
                              }
                              onChange={(
                                event
                              ) =>
                                setEditTaskText(
                                  event.target.value
                                )
                              }
                              onKeyDown={(
                                event
                              ) => {
                                if (
                                  event.key ===
                                  "Enter"
                                ) {
                                  event.preventDefault();

                                  editCancelledRef.current =
                                    false;

                                  event.currentTarget.blur();
                                }

                                if (
                                  event.key ===
                                  "Escape"
                                ) {
                                  event.preventDefault();

                                  cancelEditingTask();
                                }
                              }}
                              onBlur={() => {
                                if (
                                  editCancelledRef.current
                                ) {
                                  return;
                                }

                                saveEditingTask();
                              }}
                              className="min-w-0 w-full border-0 border-b border-[#5B7CFF]/45 bg-transparent pb-[2px] text-white/90 outline-none transition-all duration-200 focus:border-[#5B7CFF] focus:shadow-[0_3px_8px_-5px_rgba(91,124,255,0.8)]"
                            />
                          ) : (
                            <span
                              onClick={(event) => {
                                if (
                                  window.matchMedia(
                                    "(max-width: 767px)"
                                  ).matches
                                ) {
                                  event.stopPropagation();
                                  startEditingTask(
                                    task
                                  );
                                }
                              }}
                              className={`relative block min-w-0 max-w-full whitespace-normal break-words leading-5 [overflow-wrap:anywhere] transition-colors duration-300 md:cursor-default ${
                                visuallyCompleted
                                  ? "text-white/30"
                                  : "text-white/80"
                              }`}
                            >
                              {
                                task.text
                              }

                              <span
                                className={`pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-white/30 transition-all duration-[650ms] ease-out ${
                                  visuallyCompleted
                                    ? "scale-x-100 opacity-100"
                                    : "scale-x-0 opacity-0"
                                }`}
                                style={{
                                  transformOrigin:
                                    "left center",
                                }}
                              />
                            </span>
                          )}
                        </span>

                        {/* CARRY-OVER */}

                        <button
                          type="button"
                          onPointerDown={(event) =>
                            event.stopPropagation()
                          }
                          onDoubleClick={(event) =>
                            event.stopPropagation()
                          }
                          onClick={() =>
                            toggleTaskCarryOver(task.id)
                          }
                          disabled={
                            selectedDateIsPast ||
                            task.completed
                          }
                          title={
                            task.carryOver === false
                              ? "Enable carry-over"
                              : task.carriedFrom
                                ? "Carried from an earlier day"
                                : "Disable carry-over"
                          }
                          aria-label={
                            task.carryOver === false
                              ? "Enable task carry-over"
                              : "Disable task carry-over"
                          }
                          aria-pressed={
                            task.carryOver !== false
                          }
                          className={`relative z-30 hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg transition md:flex ${selectedDateIsPast || task.completed ? "pointer-events-none opacity-0" : task.carryOver !== false ? "cursor-pointer text-[#8295E8]/55 opacity-100 hover:bg-white/[0.03] hover:text-[#9EACEC]/80" : "cursor-pointer text-white/25 opacity-0 hover:bg-white/[0.03] hover:text-white/50 group-hover:opacity-100"}`}
                        >
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            viewBox="0 0 20 20"
                            fill="none"
                          >
                            <path
                              d="M15.5 9A5.75 5.75 0 1 0 14 13"
                              stroke="currentColor"
                              strokeWidth="1.45"
                              strokeLinecap="round"
                            />
                            <path
                              d="M15.5 4.75V9h-4.25"
                              stroke="currentColor"
                              strokeWidth="1.45"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        {/* DELETE */}

                        <button
                          onPointerDown={(
                            event
                          ) =>
                            event.stopPropagation()
                          }

                          onDoubleClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }

                          onClick={() =>
                            deleteTask(
                              task.id
                            )
                          }

                          disabled={
                            selectedDateIsPast
                          }

                          className={`relative z-30 hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 md:flex ${
                            selectedDateIsPast
                              ? "pointer-events-none text-white/10 opacity-0"
                              : "cursor-pointer text-white/30 opacity-0 hover:bg-white/5 hover:text-white/80 group-hover:opacity-100"
                          }`}

                          aria-label="Delete task"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <path
                              d="M4.25 4.25L11.75 11.75"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                            />

                            <path
                              d="M11.75 4.25L4.25 11.75"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                        {!selectedDateIsPast && (
                          <button
                            data-planning-context-menu
                            type="button"
                            onPointerDown={(event) =>
                              handleTaskMenuPointerDown(
                                event,
                                task,
                                unfinishedIndex
                              )
                            }
                            onPointerMove={(event) =>
                              handleTaskMenuPointerMove(
                                event,
                                task
                              )
                            }
                            onPointerUp={(event) =>
                              handleTaskMenuPointerUp(
                                event,
                                task
                              )
                            }
                            onPointerCancel={(event) =>
                              handleTaskMenuPointerUp(
                                event,
                                task
                              )
                            }
                            onContextMenu={(event) => {
                              if (
                                window.matchMedia(
                                  "(max-width: 767px)"
                                ).matches
                              ) {
                                event.preventDefault();
                              }
                            }}
                            onClick={(event) => {
                              event.stopPropagation();

                              if (
                                performance.now() <
                                suppressTaskMenuClickUntilRef.current
                              ) {
                                return;
                              }

                              setOpenTaskMenuId(
                                (current) =>
                                  current === task.id
                                    ? null
                                    : task.id
                              );

                              setOpenHabitMenuId(
                                null
                              );
                            }}
                            aria-label={`Task options for ${task.text}${taskCarryOverActive ? ", carry-over on" : ""}${!task.completed ? ", hold and drag to reorder" : ""}`}
                            aria-expanded={
                              openTaskMenuId ===
                              task.id
                            }
                            className={`relative z-30 flex h-11 w-11 shrink-0 touch-none cursor-pointer items-center justify-center rounded-xl transition active:bg-white/[0.06] md:hidden ${taskCarryOverActive ? "text-[#8295E8]/70" : "text-white/35"} ${openTaskMenuId === task.id ? taskCarryOverActive ? "bg-white/[0.05] text-[#9EACEC]/85" : "bg-white/[0.05] text-white/65" : ""}`}
                          >
                            <span className="text-lg leading-none">
                              ⋯
                            </span>
                          </button>
                        )}

                        {openTaskMenuId ===
                          task.id &&
                          !selectedDateIsPast && (
                            <div
                              data-planning-context-menu
                              className="flex basis-full items-center gap-1 border-t border-white/[0.06] pt-2 md:hidden"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  toggleTaskCarryOver(
                                    task.id
                                  )
                                }
                                disabled={
                                  task.completed
                                }
                                aria-pressed={
                                  task.carryOver !==
                                  false
                                }
                                className={`min-h-11 flex-1 rounded-lg px-2 text-xs transition ${task.completed ? "text-white/15" : task.carryOver !== false ? "bg-[#5B7CFF]/[0.08] text-[#8295E8]" : "text-white/45 active:bg-white/[0.05]"}`}
                              >
                                Carry {task.carryOver !== false ? "on" : "off"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteTask(
                                    task.id
                                  )
                                }
                                aria-label="Delete task"
                                className="flex h-11 w-11 items-center justify-center rounded-lg text-white/35 active:bg-white/[0.05] active:text-white/70"
                              >
                                ×
                              </button>
                            </div>
                          )}
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>

          {/* HABITS */}

          <div className="mt-10">
            <div className="group flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">
                  Habits
                </p>

                <p className="mt-1 text-xs text-white/30">
                  <span className="md:hidden">
                    {habitReorderMode
                      ? "Drag with the grip"
                      : "Daily"}
                  </span>
                  <span className="hidden md:inline">
                    {habitReorderMode
                      ? "Drag to reorder"
                      : "Daily"}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedHabits.length >
                  0 &&
                  !habitReorderMode && (
                    <p
                      className={`mr-1 text-xs transition-all duration-500 ${
                        allHabitsComplete
                          ? "completion-glow font-medium text-[#5B7CFF]"
                          : "text-white/30"
                      }`}
                    >
                      {
                        completedHabitsCount
                      }
                      /
                      {
                        selectedHabits.length
                      }{" "}
                      complete
                    </p>
                  )}

                {!selectedDateIsPast &&
                  selectedHabits.length >
                    1 && (
                    <button
                      onClick={
                        toggleHabitReorderMode
                      }
                      title={
                        habitReorderMode
                          ? "Finish reordering"
                          : "Reorder habits"
                      }
                      aria-label={
                        habitReorderMode
                          ? "Finish reordering habits"
                          : "Reorder habits"
                      }
                      className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border transition-all duration-200 md:h-8 md:w-8 ${
                        habitReorderMode
                          ? "border-[#5B7CFF]/40 bg-[#5B7CFF]/10 text-[#5B7CFF] opacity-100"
                          : "border-transparent text-white/35 opacity-60 hover:border-white/10 hover:bg-white/5 hover:text-white/70 md:opacity-0 md:group-hover:opacity-100"
                      }`}
                    >
                      {habitReorderMode ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M3.5 8.2L6.4 11L12.5 5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M5 2.75V13.25"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                          />

                          <path
                            d="M2.9 4.8L5 2.7L7.1 4.8"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          <path
                            d="M11 13.25V2.75"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                          />

                          <path
                            d="M8.9 11.2L11 13.3L13.1 11.2"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  )}

                {!selectedDateIsPast &&
                  !addingHabit &&
                  !habitReorderMode && (
                    <button
                      onClick={() =>
                        setAddingHabit(
                          true
                        )
                      }
                      className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 transition-all duration-200 hover:border-[#5B7CFF]/30 hover:bg-[#5B7CFF]/5 hover:text-white"
                    >
                      + Add habit
                    </button>
                  )}
              </div>
            </div>

            {/* ADD HABIT */}

            {addingHabit &&
              !selectedDateIsPast &&
              !habitReorderMode && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <input
                    autoFocus
                    enterKeyHint="done"
                    onFocus={(event) =>
                      keepMobileInputVisible(
                        event.currentTarget
                      )
                    }
                    value={
                      newHabit
                    }
                    onChange={(
                      event
                    ) =>
                      setNewHabit(
                        event.target.value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        addHabit();
                      }

                      if (
                        event.key ===
                        "Escape"
                      ) {
                        setAddingHabit(
                          false
                        );

                        setNewHabit(
                          ""
                        );
                      }
                    }}
                    placeholder="Add a daily habit"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#5B7CFF]/50"
                  />

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setAddingHabit(
                          false
                        );

                        setNewHabit(
                          ""
                        );
                      }}
                      className="cursor-pointer rounded-lg px-4 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={
                        addHabit
                      }
                      className="cursor-pointer rounded-lg bg-[#5B7CFF] px-4 py-2 text-sm font-medium transition hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

            {/* HABIT LIST */}

            <div className="mt-3 space-y-2">
              {selectedHabits.length ===
              0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-white/40">
                    {selectedDateIsPast
                      ? "No habits tracked."
                      : "No habits yet."}
                  </p>
                </div>
              ) : (
                displayedHabits.map(
                  (
                    habit,
                    habitDisplayIndex
                  ) => {
                    const completed =
                      habit.completedDates.includes(
                        selectedDateKey
                      );

                    const isEditing =
                      editingHabitId ===
                      habit.id;

                    const confirmingDelete =
                      confirmDeleteHabitId ===
                      habit.id;

                    const isDragged =
                      habitDrag?.id ===
                      habit.id;

                    const habitIndex =
                      selectedHabits.findIndex(
                        (
                          item
                        ) =>
                          item.id ===
                          habit.id
                      );

                    return (
                      <div
                        key={
                          habit.id
                        }

                        ref={(
                          element
                        ) => {
                          if (
                            element
                          ) {
                            habitRefs.current.set(
                              habit.id,
                              element
                            );
                          } else {
                            habitRefs.current.delete(
                              habit.id
                            );
                          }
                        }}

                        onPointerDown={(
                          event
                        ) =>
                          handleHabitPointerDown(
                            event,
                            habit,
                            habitIndex
                          )
                        }

                        onPointerMove={(
                          event
                        ) =>
                          handleHabitPointerMove(
                            event,
                            habit
                          )
                        }

                        onPointerUp={(
                          event
                        ) =>
                          handleHabitPointerUp(
                            event,
                            habit
                          )
                        }

                        onPointerCancel={(
                          event
                        ) =>
                          handleHabitPointerUp(
                            event,
                            habit
                          )
                        }

                        onDoubleClick={(
                          event
                        ) => {
                          if (
                            habitReorderMode
                          ) {
                            return;
                          }

                          const target =
                            event.target as HTMLElement;

                          if (
                            target.closest(
                              "button"
                            ) ||
                            target.closest(
                              "input"
                            )
                          ) {
                            return;
                          }

                          if (
                            selectedDateIsPast
                          ) {
                            return;
                          }

                          event.preventDefault();
                          event.stopPropagation();

                          startEditingHabit(
                            habit
                          );
                        }}

                        className={`group relative flex w-full min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-2xl border bg-white/[0.03] p-3.5 touch-pan-y transition-colors duration-300 md:flex-nowrap md:gap-4 md:p-4 ${
                          habitReorderMode
                            ? "border-[#5B7CFF]/15 bg-[#5B7CFF]/[0.035] md:cursor-grab md:active:cursor-grabbing"
                            : "border-white/10"
                        } ${
                          isEditing
                            ? "border-[#5B7CFF]/25 bg-white/[0.04]"
                            : ""
                        } ${
                          isDragged
                            ? "invisible"
                            : ""
                        } ${
                          deletingHabits.includes(
                            habit.id
                          )
                            ? "habit-delete"
                            : ""
                        }`}

                        style={{
                          userSelect:
                            isEditing
                              ? "text"
                              : "none",
                        }}
                      >
                        {confirmingDelete ? (
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white/80">
                                Delete this habit?
                              </p>

                              <p className="mt-0.5 text-xs text-white/35">
                                Its saved history will be removed.
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                onPointerDown={(
                                  event
                                ) =>
                                  event.stopPropagation()
                                }

                                onDoubleClick={(
                                  event
                                ) =>
                                  event.stopPropagation()
                                }

                                onClick={
                                  cancelDeleteHabit
                                }

                                className="cursor-pointer rounded-lg px-3 py-2 text-xs text-white/45 transition hover:bg-white/5 hover:text-white/80"
                              >
                                Cancel
                              </button>

                              <button
                                onPointerDown={(
                                  event
                                ) =>
                                  event.stopPropagation()
                                }

                                onDoubleClick={(
                                  event
                                ) =>
                                  event.stopPropagation()
                                }

                                onClick={() =>
                                  deleteHabit(
                                    habit.id
                                  )
                                }

                                className="cursor-pointer rounded-lg border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-xs text-red-300/80 transition hover:border-red-400/25 hover:bg-red-400/10 hover:text-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* HABIT CHECK */}

                            <button
                              onPointerDown={(
                                event
                              ) =>
                                event.stopPropagation()
                              }

                              onDoubleClick={(
                                event
                              ) =>
                                event.stopPropagation()
                              }

                              onClick={() =>
                                toggleHabit(
                                  habit.id
                                )
                              }

                              disabled={
                                selectedDateIsPast ||
                                habitReorderMode
                              }

                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition active:bg-white/[0.04] md:h-5 md:w-5 md:rounded-none md:active:bg-transparent ${
                                selectedDateIsPast ||
                                habitReorderMode
                                  ? "cursor-default"
                                  : "cursor-pointer"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-300 ease-out ${
                                  completed
                                    ? "border-[#5B7CFF] bg-[#5B7CFF]"
                                    : "border-white/20 hover:border-white/40"
                                }`}
                              >
                                <span
                                  className={`text-xs text-white transition-all duration-300 ${
                                    completed
                                      ? "scale-100 opacity-100"
                                      : "scale-50 opacity-0"
                                  }`}
                                >
                                  ✓
                                </span>
                              </span>
                            </button>

                            {/* HABIT NAME */}

                            <div className="min-w-0 flex-1 overflow-hidden">
                              {isEditing ? (
                                <input
                                  autoFocus
                                  enterKeyHint="done"
                                  onFocus={(event) =>
                                    keepMobileInputVisible(
                                      event.currentTarget
                                    )
                                  }
                                  value={
                                    editHabitName
                                  }
                                  onPointerDown={(
                                    event
                                  ) =>
                                    event.stopPropagation()
                                  }
                                  onDoubleClick={(
                                    event
                                  ) =>
                                    event.stopPropagation()
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setEditHabitName(
                                      event.target.value
                                    )
                                  }
                                  onKeyDown={(
                                    event
                                  ) => {
                                    if (
                                      event.key ===
                                      "Enter"
                                    ) {
                                      event.preventDefault();

                                      habitEditCancelledRef.current =
                                        false;

                                      event.currentTarget.blur();
                                    }

                                    if (
                                      event.key ===
                                      "Escape"
                                    ) {
                                      event.preventDefault();

                                      cancelEditingHabit();
                                    }
                                  }}
                                  onBlur={() => {
                                    if (
                                      habitEditCancelledRef.current
                                    ) {
                                      return;
                                    }

                                    saveEditingHabit();
                                  }}
                                  className="min-w-0 w-full border-0 border-b border-[#5B7CFF]/45 bg-transparent pb-[2px] text-white/90 outline-none transition-all duration-200 focus:border-[#5B7CFF] focus:shadow-[0_3px_8px_-5px_rgba(91,124,255,0.8)]"
                                />
                              ) : (
                                <span
                                  onClick={(event) => {
                                    if (
                                      window.matchMedia(
                                        "(max-width: 767px)"
                                      ).matches
                                    ) {
                                      event.stopPropagation();
                                      startEditingHabit(
                                        habit
                                      );
                                    }
                                  }}
                                  className={`block min-w-0 max-w-full whitespace-normal break-words leading-5 [overflow-wrap:anywhere] transition-colors duration-300 md:cursor-default ${
                                    completed
                                      ? "text-white/50"
                                      : "text-white/80"
                                  }`}
                                >
                                  {
                                    habit.name
                                  }
                                </span>
                              )}
                            </div>

                            {/* STATUS DOT */}

                            {!habitReorderMode && (
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300 ${
                                  completed
                                    ? "bg-[#5B7CFF] opacity-100"
                                    : "scale-75 bg-white/20 opacity-60"
                                } ${
                                  allHabitsComplete
                                    ? "habit-dot-complete"
                                    : completed
                                      ? "scale-100"
                                      : ""
                                }`}
                                style={
                                  allHabitsComplete
                                    ? {
                                        animationDelay:
                                          `${habitDisplayIndex * 85}ms`,
                                      }
                                    : undefined
                                }
                              />
                            )}

                            {/* REORDER INDICATOR */}

                            {habitReorderMode && (
                              <>
                                <div className="hidden w-7 shrink-0 items-center justify-center text-white/25 md:flex">
                                  <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 15 15"
                                    fill="none"
                                  >
                                    <circle cx="5" cy="4" r="0.8" fill="currentColor" />
                                    <circle cx="10" cy="4" r="0.8" fill="currentColor" />
                                    <circle cx="5" cy="7.5" r="0.8" fill="currentColor" />
                                    <circle cx="10" cy="7.5" r="0.8" fill="currentColor" />
                                    <circle cx="5" cy="11" r="0.8" fill="currentColor" />
                                    <circle cx="10" cy="11" r="0.8" fill="currentColor" />
                                  </svg>
                                </div>

                                <span
                                  data-mobile-habit-drag-handle
                                  aria-hidden="true"
                                  className="flex h-11 w-9 shrink-0 touch-none select-none items-center justify-center rounded-xl text-[#8295E8]/60 active:bg-[#5B7CFF]/[0.08] active:text-[#8295E8] md:hidden"
                                >
                                  <svg
                                    className="h-4 w-3"
                                    viewBox="0 0 12 16"
                                    fill="none"
                                  >
                                    <circle cx="3" cy="3" r="1" fill="currentColor" />
                                    <circle cx="9" cy="3" r="1" fill="currentColor" />
                                    <circle cx="3" cy="8" r="1" fill="currentColor" />
                                    <circle cx="9" cy="8" r="1" fill="currentColor" />
                                    <circle cx="3" cy="13" r="1" fill="currentColor" />
                                    <circle cx="9" cy="13" r="1" fill="currentColor" />
                                  </svg>
                                </span>
                              </>
                            )}

                            {/* DELETE */}

                            {!habitReorderMode && (
                              <button
                                onPointerDown={(
                                  event
                                ) =>
                                  event.stopPropagation()
                                }

                                onDoubleClick={(
                                  event
                                ) =>
                                  event.stopPropagation()
                                }

                                onClick={() =>
                                  askToDeleteHabit(
                                    habit.id
                                  )
                                }

                                disabled={
                                  selectedDateIsPast
                                }

                                className={`relative hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/30 transition-all duration-200 md:flex ${
                                  selectedDateIsPast
                                    ? "cursor-default opacity-0"
                                    : "cursor-pointer opacity-0 hover:bg-white/5 hover:text-white/80 group-hover:opacity-100"
                                }`}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                >
                                  <path
                                    d="M4.25 4.25L11.75 11.75"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                  />

                                  <path
                                    d="M11.75 4.25L4.25 11.75"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                            {!habitReorderMode &&
                              !selectedDateIsPast && (
                                <button
                                  data-planning-context-menu
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenHabitMenuId(
                                      (current) =>
                                        current === habit.id
                                          ? null
                                          : habit.id
                                    );
                                    setOpenTaskMenuId(
                                      null
                                    );
                                  }}
                                  aria-label={`Habit options for ${habit.name}`}
                                  aria-expanded={
                                    openHabitMenuId ===
                                    habit.id
                                  }
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg leading-none text-white/35 transition active:bg-white/[0.06] md:hidden ${openHabitMenuId === habit.id ? "bg-white/[0.05] text-white/65" : ""}`}
                                >
                                  ⋯
                                </button>
                              )}

                            {openHabitMenuId ===
                              habit.id &&
                              !habitReorderMode &&
                              !selectedDateIsPast && (
                                <div
                                  data-planning-context-menu
                                  className="flex basis-full justify-end border-t border-white/[0.06] pt-2 md:hidden"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      askToDeleteHabit(
                                        habit.id
                                      )
                                    }
                                    className="min-h-11 rounded-lg px-3 text-xs text-white/40 active:bg-white/[0.05] active:text-white/70"
                                  >
                                    Delete habit
                                  </button>
                                </div>
                              )}
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>

          {/* MOBILE / TABLET EVENTS */}

          <div className="mt-10 xl:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">
                  Events
                </p>

                <p className="mt-1 text-xs text-white/30">
                  Important dates ahead
                </p>
              </div>

              {upcomingEvents.length > 0 && (
                <span className="text-xs text-white/25">
                  Next {upcomingEvents.length}
                </span>
              )}
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-white/35">
                  No upcoming events.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {upcomingEvents.map(
                  (
                    occurrence
                  ) => {
                    const eventDate =
                      new Date(
                        `${occurrence.date}T12:00:00`
                      );

                    const editing =
                      editingEventId ===
                      occurrence.event.id;

                    return (
                      <div
                        key={`mobile-${occurrence.event.id}-${occurrence.date}`}
                        className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5"
                      >
                        <div className="flex w-11 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-[#5B7CFF]/20 bg-[#5B7CFF]/[0.06]">
                          <span className="w-full bg-[#5B7CFF]/12 py-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8295E8]">
                            {eventDate.toLocaleDateString(
                              "en-US",
                              {
                                month:
                                  "short",
                              }
                            )}
                          </span>

                          <span className="py-1.5 text-base font-semibold leading-none text-white/80">
                            {eventDate.getDate()}
                          </span>
                        </div>

                        {editing ? (
                          <div className="min-w-0 flex-1">
                            <input
                              autoFocus
                              enterKeyHint="done"
                              onFocus={(event) =>
                                keepMobileInputVisible(
                                  event.currentTarget
                                )
                              }
                              value={
                                editEventTitle
                              }
                              onChange={(event) =>
                                setEditEventTitle(
                                  event.target.value
                                )
                              }
                              onKeyDown={(event) => {
                                if (
                                  event.key ===
                                  "Enter"
                                ) {
                                  saveEditingEvent();
                                }

                                if (
                                  event.key ===
                                  "Escape"
                                ) {
                                  cancelEditingEvent();
                                }
                              }}
                              aria-label="Event title"
                              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-[#5B7CFF]/50"
                            />

                            <div className="mt-2">
                              <div className="flex min-w-0 gap-2">
                                <label className="relative flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] px-3">
                                  <span className="min-w-0">
                                    <span className="block text-[9px] uppercase tracking-[0.1em] text-white/25">
                                      Time
                                    </span>

                                    <span className="mt-0.5 block truncate text-xs text-white/65">
                                      {editEventTime ||
                                        "Optional"}
                                    </span>
                                  </span>

                                  <svg
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5 shrink-0 text-white/30"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                  >
                                    <circle
                                      cx="10"
                                      cy="10"
                                      r="6.5"
                                      stroke="currentColor"
                                      strokeWidth="1.4"
                                    />
                                    <path
                                      d="M10 6.5V10L12.5 11.5"
                                      stroke="currentColor"
                                      strokeWidth="1.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>

                                  <input
                                    type="time"
                                    onFocus={(event) =>
                                      keepMobileInputVisible(
                                        event.currentTarget
                                      )
                                    }
                                    value={
                                      editEventTime
                                    }
                                    onChange={(event) =>
                                      setEditEventTime(
                                        event.target.value
                                      )
                                    }
                                    aria-label="Event time"
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  />
                                </label>

                                {editEventTime && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditEventTime(
                                        ""
                                      )
                                    }
                                    aria-label="Clear event time"
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-lg text-white/35 transition active:bg-white/[0.06] active:text-white/70"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditEventRepeatYearly(
                                    (current) =>
                                      !current
                                  )
                                }
                                aria-pressed={
                                  editEventRepeatYearly
                                }
                                className={`mt-2 min-h-11 w-full rounded-lg border px-3 text-xs transition ${editEventRepeatYearly ? "border-[#5B7CFF]/25 bg-[#5B7CFF]/[0.08] text-[#8295E8]" : "border-white/[0.08] text-white/40"}`}
                              >
                                Yearly {editEventRepeatYearly ? "on" : "off"}
                              </button>
                            </div>

                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={
                                  cancelEditingEvent
                                }
                                className="min-h-11 rounded-lg px-3 text-xs text-white/40"
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                onClick={
                                  saveEditingEvent
                                }
                                className="min-h-11 rounded-lg bg-[#5B7CFF] px-3 text-xs font-medium"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                startEditingEvent(
                                  occurrence.event
                                )
                              }
                              disabled={
                                selectedDateIsPast
                              }
                              className="min-h-11 min-w-0 flex-1 text-left"
                            >
                              <span className="block truncate text-sm font-medium text-white/75">
                                {occurrence.event.title}
                              </span>

                              <span className="mt-1 block text-xs text-white/30">
                                {occurrence.event.time
                                  ? occurrence.event.time
                                  : "All day"}
                                {occurrence.event.repeatYearly
                                  ? " · Yearly"
                                  : ""}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteEvent(
                                  occurrence.event.id
                                )
                              }
                              disabled={
                                selectedDateIsPast
                              }
                              aria-label={`Delete ${occurrence.event.title}`}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white/30 transition active:bg-white/[0.06] active:text-white/70 disabled:text-white/10"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>

        {/* ====================================================
            RIGHT COLUMN
            ==================================================== */}

        <div className="hidden min-w-0 space-y-4 xl:block">

          {/* ==================================================
              DAY OVERVIEW
              ================================================== */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">

            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">
              Day Overview
            </p>

            {/* DAILY SCORE */}

            <div className="mt-4">
              <p className="text-sm text-white/40">
                Daily Score
              </p>

              <div className="mt-1.5 flex items-end gap-2">
                <span className="text-5xl font-semibold tracking-tight text-white">
                  {dailyScore ?? "—"}
                </span>

                <span className="mb-1.5 text-xs text-white/25">
                  Daily Score
                </span>
              </div>
            </div>

            <div className="my-5 h-px bg-white/[0.07]" />

            {/* TASK PROGRESS */}

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/55">
                  Tasks
                </span>

                <span
                  className={`text-sm transition-colors duration-500 ${
                    allTasksComplete
                      ? "text-[#5B7CFF]"
                      : "text-white/40"
                  }`}
                >
                  {visualTaskCompletedCount}
                  {" / "}
                  {selectedTasks.length}
                </span>
              </div>

              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-[#5B7CFF] transition-[width] duration-500 ease-out"
                  style={{
                    width:
                      selectedTasks.length >
                      0
                        ? `${Math.min(
                            100,
                            (visualTaskCompletedCount /
                              selectedTasks.length) *
                              100
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            {/* HABIT PROGRESS */}

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/55">
                  Habits
                </span>

                <span
                  className={`text-sm transition-colors duration-500 ${
                    allHabitsComplete
                      ? "text-[#5B7CFF]"
                      : "text-white/40"
                  }`}
                >
                  {completedHabitsCount}
                  {" / "}
                  {selectedHabits.length}
                </span>
              </div>

              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-[#5B7CFF] transition-[width] duration-500 ease-out"
                  style={{
                    width:
                      selectedHabits.length >
                      0
                        ? `${Math.min(
                            100,
                            (completedHabitsCount /
                              selectedHabits.length) *
                              100
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            {/* REMAINING */}

            <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5">
              {selectedTasks.length ===
                0 &&
              selectedHabits.length ===
                0 ? (
                <p className="text-sm text-white/35">
                  Nothing planned for this day.
                </p>
              ) : allTasksComplete &&
                allHabitsComplete ? (
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5B7CFF]/15 text-xs text-[#5B7CFF]">
                    ✓
                  </span>

                  <p className="text-sm font-medium text-[#5B7CFF]">
                    Day complete
                  </p>
                </div>
              ) : (
                <p className="text-sm text-white/40">
                  {Math.max(
                    0,
                    selectedTasks.length -
                      visualTaskCompletedCount
                  )}{" "}
                  {selectedTasks.length -
                    visualTaskCompletedCount ===
                  1
                    ? "task"
                    : "tasks"}
                  {" · "}
                  {Math.max(
                    0,
                    selectedHabits.length -
                      completedHabitsCount
                  )}{" "}
                  {selectedHabits.length -
                    completedHabitsCount ===
                  1
                    ? "habit"
                    : "habits"}{" "}
                  remaining
                </p>
              )}
            </div>
          </div>

          {/* ==================================================
              UPCOMING EVENTS
              ================================================== */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">
                  Upcoming Events
                </p>

                <p className="mt-1 text-xs text-white/20">
                  Important dates ahead
                </p>
              </div>

              {upcomingEvents.length > 0 && (
                <span className="text-[11px] text-white/20">
                  Next {upcomingEvents.length}
                </span>
              )}
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="mt-5">
                <p className="text-sm text-white/35">
                  No upcoming events.
                </p>

                <p className="mt-1 text-xs text-white/20">
                  Add birthdays, school dates, or anything important.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {upcomingEvents.map(
                  (
                    occurrence
                  ) => {
                    const eventDate =
                      new Date(
                        `${occurrence.date}T12:00:00`
                      );

                    const editing =
                      editingEventId ===
                      occurrence.event.id;

                    return (
                      <div
                        key={`${occurrence.event.id}-${occurrence.date}`}
                        className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        <div className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-[#5B7CFF]/25 bg-[#5B7CFF]/[0.07]">
                          <span className="w-full bg-[#5B7CFF]/15 py-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8EA3FF]">
                            {eventDate.toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                              }
                            )}
                          </span>

                          <span className="py-1 text-lg font-semibold leading-none text-white/85">
                            {eventDate.getDate()}
                          </span>
                        </div>

                        {editing ? (
                          <div className="min-w-0 flex-1">
                            <input
                              autoFocus
                              enterKeyHint="done"
                              onFocus={(event) =>
                                keepMobileInputVisible(
                                  event.currentTarget
                                )
                              }
                              value={editEventTitle}
                              onChange={(event) =>
                                setEditEventTitle(
                                  event.target.value
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  saveEditingEvent();
                                }

                                if (event.key === "Escape") {
                                  cancelEditingEvent();
                                }
                              }}
                              aria-label="Event title"
                              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-[#5B7CFF]/50"
                            />

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="time"
                                onFocus={(event) =>
                                  keepMobileInputVisible(
                                    event.currentTarget
                                  )
                                }
                                value={editEventTime}
                                onChange={(event) =>
                                  setEditEventTime(
                                    event.target.value
                                  )
                                }
                                aria-label="Event time"
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white/65 outline-none focus:border-[#5B7CFF]/50"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  setEditEventRepeatYearly(
                                    (current) =>
                                      !current
                                  )
                                }
                                aria-pressed={
                                  editEventRepeatYearly
                                }
                                className="flex cursor-pointer items-center gap-2 text-[11px] text-white/45"
                              >
                                Yearly

                                <span
                                  aria-hidden="true"
                                  className={`relative h-4 w-7 shrink-0 overflow-hidden rounded-full ${editEventRepeatYearly ? "bg-[#5B7CFF]" : "bg-white/15"}`}
                                >
                                  <span
                                    className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${editEventRepeatYearly ? "translate-x-[14px]" : "translate-x-0.5"}`}
                                  />
                                </span>
                              </button>

                              <div className="ml-auto flex gap-1">
                                <button
                                  type="button"
                                  onClick={cancelEditingEvent}
                                  className="cursor-pointer rounded-md px-2 py-1 text-[11px] text-white/35 hover:bg-white/5 hover:text-white/60"
                                >
                                  Cancel
                                </button>

                                <button
                                  type="button"
                                  onClick={saveEditingEvent}
                                  className="cursor-pointer rounded-md bg-[#5B7CFF] px-2 py-1 text-[11px] font-medium"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                startEditingEvent(
                                  occurrence.event
                                )
                              }
                              className="min-w-0 flex-1 cursor-pointer text-left"
                            >
                              <p className="truncate text-sm font-medium text-white/75">
                                {occurrence.event.title}
                              </p>

                              <p className="mt-1 text-[11px] text-white/30">
                                {occurrence.event.time
                                  ? occurrence.event.time
                                  : "All day"}
                                {occurrence.event.repeatYearly
                                  ? " · Yearly"
                                  : ""}
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteEvent(
                                  occurrence.event.id
                                )
                              }
                              aria-label={`Delete ${occurrence.event.title}`}
                              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/30 opacity-0 transition hover:bg-white/5 hover:text-white/70 group-hover:opacity-100"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TASK DRAG OVERLAY */}

      {drag && (
        <div
          ref={
            dragOverlayRef
          }

          className="pointer-events-none fixed z-[9999] overflow-hidden rounded-2xl border border-white/15 bg-[#171a24] p-3.5 shadow-2xl shadow-black/40 md:p-4"

          style={{
            top:
              drag.top,

            left:
              drag.left,

            width:
              drag.width,

            minHeight:
              drag.height,

            transform:
              "translate3d(0, 0, 0) scale(1.012)",

            willChange:
              "transform",
          }}
        >
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center md:h-5 md:w-5">
              <span className="h-5 w-5 rounded-full border border-white/20" />
            </span>

            <span className="min-w-0 flex-1 overflow-hidden whitespace-normal break-words leading-5 text-white/80 [overflow-wrap:anywhere]">
              {
                drag.text
              }
            </span>

            <span className="hidden h-7 w-7 shrink-0 md:block" />
            <span className="h-11 w-11 shrink-0 md:h-7 md:w-7" />
          </div>
        </div>
      )}

      {/* HABIT DRAG OVERLAY */}

      {habitDrag && (
        <div
          ref={
            habitDragOverlayRef
          }

          className="pointer-events-none fixed z-[9999] overflow-hidden rounded-2xl border border-[#5B7CFF]/20 bg-[#171a24] p-4 shadow-2xl shadow-black/40"

          style={{
            top:
              habitDrag.top,

            left:
              habitDrag.left,

            width:
              habitDrag.width,

            minHeight:
              habitDrag.height,

            transform:
              "translate3d(0, 0, 0) scale(1.012)",

            willChange:
              "transform",
          }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-5 w-5 shrink-0 rounded-full border border-white/20" />

            <span className="min-w-0 flex-1 whitespace-normal break-words leading-5 text-white/80 [overflow-wrap:anywhere]">
              {
                habitDrag.name
              }
            </span>

            <div className="flex w-7 shrink-0 items-center justify-center text-white/25">
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
              >
                <circle cx="5" cy="4" r="0.8" fill="currentColor" />
                <circle cx="10" cy="4" r="0.8" fill="currentColor" />
                <circle cx="5" cy="7.5" r="0.8" fill="currentColor" />
                <circle cx="10" cy="7.5" r="0.8" fill="currentColor" />
                <circle cx="5" cy="11" r="0.8" fill="currentColor" />
                <circle cx="10" cy="11" r="0.8" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}