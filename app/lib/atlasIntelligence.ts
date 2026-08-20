import type {
  Habit,
  Task,
} from "../components/Planning";

import type {
  JournalEntry,
} from "../components/Journal";

import {
  calculateDailyScore,
} from "./dailyScore";

/* ============================================================
 * TYPES
 * ============================================================
 */

export type TaskHistoryEventLike = {
  id: string;
  taskId: number;
  taskText: string;
  taskDate: string;
  type:
    | "created"
    | "completed"
    | "uncompleted"
    | "deleted";
  timestamp: string;
};

export type AtlasConfidence =
  | "low"
  | "medium"
  | "high";

export type AtlasInsightKind =
  | "learning"
  | "energy"
  | "mood"
  | "decline"
  | "improvement"
  | "tasks"
  | "habits"
  | "consistency"
  | "steady";

export type AtlasIntelligenceResult = {
  kind: AtlasInsightKind;
  title: string;
  observation: string;
  recommendation: string;
  confidence: AtlasConfidence;
  source: string;
};

type AtlasIntelligenceInput = {
  tasks: Task[];
  habits: Habit[];
  journalEntries: JournalEntry[];
  taskHistory?: TaskHistoryEventLike[];
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

function average(
  values: number[]
) {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    values.length
  );
}

/* ============================================================
 * DAY SNAPSHOT
 * ============================================================
 */

type DaySnapshot = {
  dateKey: string;

  score:
    | number
    | null;

  taskTotal: number;
  taskCompleted: number;

  habitTotal: number;
  habitCompleted: number;

  totalPlanned: number;
  totalCompleted: number;

  onTrack: boolean;
};

function getDaySnapshot(
  date: Date,
  tasks: Task[],
  habits: Habit[]
): DaySnapshot {
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

  const taskCompleted =
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
        habit.createdAt
          .slice(
            0,
            10
          ) <=
        dateKey
    );

  const habitCompleted =
    activeHabits.filter(
      (
        habit
      ) =>
        habit.completedDates.includes(
          dateKey
        )
    ).length;

  const totalPlanned =
    dayTasks.length +
    activeHabits.length;

  const totalCompleted =
    taskCompleted +
    habitCompleted;

  const followThrough =
    totalPlanned >
    0
      ? totalCompleted /
        totalPlanned
      : null;

  return {
    dateKey,

    score:
      calculateDailyScore(
        taskCompleted,
        dayTasks.length,
        habitCompleted,
        activeHabits.length
      ),

    taskTotal:
      dayTasks.length,

    taskCompleted,

    habitTotal:
      activeHabits.length,

    habitCompleted,

    totalPlanned,

    totalCompleted,

    onTrack:
      followThrough !==
        null &&
      followThrough >=
        0.8,
  };
}

/* ============================================================
 * PERIOD HELPERS
 * ============================================================
 */

function getSnapshots(
  endDate: Date,
  numberOfDays: number,
  tasks: Task[],
  habits: Habit[]
) {
  return Array.from(
    {
      length:
        numberOfDays,
    },
    (
      _,
      index
    ) => {
      const offset =
        index -
        (
          numberOfDays -
          1
        );

      return getDaySnapshot(
        addDays(
          endDate,
          offset
        ),
        tasks,
        habits
      );
    }
  );
}

function getAverageScore(
  days: DaySnapshot[]
) {
  const scores =
    days
      .map(
        (
          day
        ) =>
          day.score
      )
      .filter(
        (
          score
        ): score is number =>
          score !==
          null
      );

  return average(
    scores
  );
}

function getAggregateTaskRate(
  days: DaySnapshot[]
) {
  const total =
    days.reduce(
      (
        sum,
        day
      ) =>
        sum +
        day.taskTotal,
      0
    );

  if (
    total ===
    0
  ) {
    return null;
  }

  const completed =
    days.reduce(
      (
        sum,
        day
      ) =>
        sum +
        day.taskCompleted,
      0
    );

  return Math.round(
    (
      completed /
      total
    ) *
      100
  );
}

function getAggregateHabitRate(
  days: DaySnapshot[]
) {
  const total =
    days.reduce(
      (
        sum,
        day
      ) =>
        sum +
        day.habitTotal,
      0
    );

  if (
    total ===
    0
  ) {
    return null;
  }

  const completed =
    days.reduce(
      (
        sum,
        day
      ) =>
        sum +
        day.habitCompleted,
      0
    );

  return Math.round(
    (
      completed /
      total
    ) *
      100
  );
}

/* ============================================================
 * RECOMMENDATION HELPERS
 * ============================================================
 */

function getTodayFocus(
  tasks: Task[],
  habits: Habit[],
  todayKey: string
) {
  const firstTask =
    tasks
      .filter(
        (
          task
        ) =>
          task.date ===
            todayKey &&
          !task.completed
      )
      .sort(
        (
          a,
          b
        ) =>
          a.order -
          b.order
      )[0];

  if (
    firstTask
  ) {
    return {
      type:
        "task" as const,

      text:
        firstTask.text,
    };
  }

  const firstHabit =
    habits
      .filter(
        (
          habit
        ) =>
          habit.createdAt.slice(
            0,
            10
          ) <=
            todayKey &&
          !habit.completedDates.includes(
            todayKey
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          a.order -
          b.order
      )[0];

  if (
    firstHabit
  ) {
    return {
      type:
        "habit" as const,

      text:
        firstHabit.name,
    };
  }

  return null;
}

function focusRecommendation(
  focus:
    | {
        type:
          | "task"
          | "habit";

        text: string;
      }
    | null,
  fallback: string
) {
  if (
    !focus
  ) {
    return fallback;
  }

  if (
    focus.type ===
    "task"
  ) {
    return `Start with “${focus.text}” before adding anything else to today.`;
  }

  return `Your next clear action is “${focus.text}”. Finish that before adding more to your day.`;
}

/* ============================================================
 * MAIN INTELLIGENCE ENGINE
 * ============================================================
 */

export function getAtlasIntelligence({
  tasks,
  habits,
  journalEntries,
  taskHistory = [],
}: AtlasIntelligenceInput): AtlasIntelligenceResult {
  const today =
    startOfDay(
      new Date()
    );

  const todayKey =
    formatDateKey(
      today
    );

  /*
   * We intentionally analyze completed days
   * ending yesterday.
   *
   * Today's score is still moving and should
   * not distort a trend.
   */

  const yesterday =
    addDays(
      today,
      -1
    );

  const recent7 =
    getSnapshots(
      yesterday,
      7,
      tasks,
      habits
    );

  const previous7 =
    getSnapshots(
      addDays(
        yesterday,
        -7
      ),
      7,
      tasks,
      habits
    );

  const recent14 =
    getSnapshots(
      yesterday,
      14,
      tasks,
      habits
    );

  const recentAverage =
    getAverageScore(
      recent7
    );

  const previousAverage =
    getAverageScore(
      previous7
    );

  const taskRate =
    getAggregateTaskRate(
      recent7
    );

  const habitRate =
    getAggregateHabitRate(
      recent7
    );

  const recentPlannedDays =
    recent7.filter(
      (
        day
      ) =>
        day.totalPlanned >
        0
    );

  const onTrackDays =
    recentPlannedDays.filter(
      (
        day
      ) =>
        day.onTrack
    ).length;

  const focus =
    getTodayFocus(
      tasks,
      habits,
      todayKey
    );

  /*
   * Task history is already available to the
   * intelligence engine.
   *
   * We do not reconstruct deleted task state from
   * it yet, but it contributes to how much evidence
   * Atlas knows it has.
   */

  const fourteenDaysAgo =
    addDays(
      today,
      -14
    ).getTime();

  const recentHistoryEvents =
    taskHistory.filter(
      (
        event
      ) => {
        const timestamp =
          new Date(
            event.timestamp
          ).getTime();

        return (
          Number.isFinite(
            timestamp
          ) &&
          timestamp >=
            fourteenDaysAgo
        );
      }
    ).length;

  /* ============================================================
   * JOURNAL ↔ PERFORMANCE
   * ============================================================
   */

  const snapshotByDate =
    new Map(
      recent14.map(
        (
          day
        ) => [
          day.dateKey,
          day,
        ] as const
      )
    );

  const recentJournal =
    journalEntries.filter(
      (
        entry
      ) =>
        snapshotByDate.has(
          entry.date
        )
    );

  /*
   * LOW ENERGY
   *
   * We only make this claim if Atlas has at least
   * two low-energy days AND two good/high-energy
   * days with real Daily Scores.
   */

  const lowEnergyScores:
    number[] = [];

  const goodEnergyScores:
    number[] = [];

  recentJournal.forEach(
    (
      entry
    ) => {
      const score =
        snapshotByDate.get(
          entry.date
        )?.score;

      if (
        score ===
        null ||
        score ===
        undefined
      ) {
        return;
      }

      if (
        entry.energy ===
        "Low"
      ) {
        lowEnergyScores.push(
          score
        );
      }

      if (
        entry.energy ===
          "Good" ||
        entry.energy ===
          "High"
      ) {
        goodEnergyScores.push(
          score
        );
      }
    }
  );

  if (
    lowEnergyScores.length >=
      2 &&
    goodEnergyScores.length >=
      2
  ) {
    const lowAverage =
      average(
        lowEnergyScores
      )!;

    const goodAverage =
      average(
        goodEnergyScores
      )!;

    const difference =
      Math.round(
        goodAverage -
          lowAverage
      );

    if (
      difference >=
      12
    ) {
      return {
        kind:
          "energy",

        title:
          "Energy is affecting your follow-through",

        observation:
          `Over the last two weeks, your Daily Score has averaged about ${difference} points lower on days you logged low energy.`,

        recommendation:
          focusRecommendation(
            focus,
            "On low-energy days, reduce the size of the plan and protect the one or two things that matter most."
          ),

        confidence:
          lowEnergyScores.length +
            goodEnergyScores.length >=
          6
            ? "high"
            : "medium",

        source:
          "Journal + Daily Score",
      };
    }
  }

  /*
   * MOOD
   */

  const lowMoodScores:
    number[] = [];

  const positiveMoodScores:
    number[] = [];

  recentJournal.forEach(
    (
      entry
    ) => {
      const score =
        snapshotByDate.get(
          entry.date
        )?.score;

      if (
        score ===
        null ||
        score ===
        undefined
      ) {
        return;
      }

      if (
        entry.mood ===
          "Low" ||
        entry.mood ===
          "Rough"
      ) {
        lowMoodScores.push(
          score
        );
      }

      if (
        entry.mood ===
          "Good" ||
        entry.mood ===
          "Great"
      ) {
        positiveMoodScores.push(
          score
        );
      }
    }
  );

  if (
    lowMoodScores.length >=
      2 &&
    positiveMoodScores.length >=
      2
  ) {
    const lowAverage =
      average(
        lowMoodScores
      )!;

    const positiveAverage =
      average(
        positiveMoodScores
      )!;

    const difference =
      Math.round(
        positiveAverage -
          lowAverage
      );

    if (
      difference >=
      15
    ) {
      return {
        kind:
          "mood",

        title:
          "Your lower-mood days are also harder to execute",

        observation:
          `Days you marked Low or Rough have averaged about ${difference} fewer Daily Score points than your Good or Great days recently.`,

        recommendation:
          focusRecommendation(
            focus,
            "When the day feels off, make the plan smaller instead of abandoning it entirely."
          ),

        confidence:
          "medium",

        source:
          "Journal + Daily Score",
      };
    }
  }

  /* ============================================================
   * SCORE TREND
   * ============================================================
   */

  const recentScoredDays =
    recent7.filter(
      (
        day
      ) =>
        day.score !==
        null
    ).length;

  const previousScoredDays =
    previous7.filter(
      (
        day
      ) =>
        day.score !==
        null
    ).length;

  if (
    recentAverage !==
      null &&
    previousAverage !==
      null &&
    recentScoredDays >=
      3 &&
    previousScoredDays >=
      3
  ) {
    const change =
      Math.round(
        recentAverage -
          previousAverage
      );

    if (
      change <=
      -8
    ) {
      return {
        kind:
          "decline",

        title:
          "Your recent follow-through has slipped",

        observation:
          `Your average Daily Score is ${Math.abs(
            change
          )} points lower than the previous week.`,

        recommendation:
          focusRecommendation(
            focus,
            "Make today's plan smaller and finish the most important item before worrying about the rest."
          ),

        confidence:
          recentScoredDays >=
            5 &&
          previousScoredDays >=
            5
            ? "high"
            : "medium",

        source:
          "Recent Daily Scores",
      };
    }

    if (
      change >=
      8
    ) {
      return {
        kind:
          "improvement",

        title:
          "Your recent execution is improving",

        observation:
          `Your average Daily Score is ${change} points higher than the previous week.`,

        recommendation:
          focusRecommendation(
            focus,
            "Keep the current structure stable instead of adding more just because this week is going well."
          ),

        confidence:
          recentScoredDays >=
            5 &&
          previousScoredDays >=
            5
            ? "high"
            : "medium",

        source:
          "Recent Daily Scores",
      };
    }
  }

  /* ============================================================
   * TASKS VS HABITS
   * ============================================================
   */

  if (
    taskRate !==
      null &&
    habitRate !==
      null
  ) {
    const gap =
      habitRate -
      taskRate;

    if (
      gap >=
      15
    ) {
      return {
        kind:
          "tasks",

        title:
          "Your habits are stronger than your tasks",

        observation:
          `Over the last 7 days, habits are at ${habitRate}% completion while tasks are at ${taskRate}%.`,

        recommendation:
          focusRecommendation(
            focus,
            "Your routine is holding up. Put more attention into completing the tasks that actually move the day forward."
          ),

        confidence:
          recentPlannedDays.length >=
          5
            ? "high"
            : "medium",

        source:
          "Tasks + habits",
      };
    }

    if (
      gap <=
      -15
    ) {
      return {
        kind:
          "habits",

        title:
          "Your tasks are stronger than your habits",

        observation:
          `Over the last 7 days, tasks are at ${taskRate}% completion while habits are at ${habitRate}%.`,

        recommendation:
          focusRecommendation(
            focus,
            "Your task execution is working. Protect the few habits that matter instead of trying to make every habit perfect."
          ),

        confidence:
          recentPlannedDays.length >=
          5
            ? "high"
            : "medium",

        source:
          "Tasks + habits",
      };
    }
  }

  /* ============================================================
   * CONSISTENCY
   * ============================================================
   */

  if (
    recentPlannedDays.length >=
      4
  ) {
    const consistencyRate =
      Math.round(
        (
          onTrackDays /
          recentPlannedDays.length
        ) *
          100
      );

    if (
      consistencyRate >=
      80
    ) {
      return {
        kind:
          "consistency",

        title:
          "Your consistency is strong",

        observation:
          `${onTrackDays} of your ${recentPlannedDays.length} planned days were on track over the last week.`,

        recommendation:
          focusRecommendation(
            focus,
            "Keep the plan stable. Consistency is more valuable right now than making Atlas more complicated."
          ),

        confidence:
          recentPlannedDays.length >=
          6
            ? "high"
            : "medium",

        source:
          "Recent consistency",
      };
    }
  }

  /* ============================================================
   * LOW DATA
   * ============================================================
   */

  if (
    recentScoredDays <
      3
  ) {
    return {
      kind:
        "learning",

      title:
        "Atlas is still learning your patterns",

      observation:
        recentHistoryEvents >
        0
          ? "There is some activity recorded, but not enough completed-day data yet for Atlas to call a real pattern."
          : "There are not enough completed days yet for Atlas to make a reliable pattern claim.",

      recommendation:
        focusRecommendation(
          focus,
          "Keep using Planning and Journal normally. Atlas will become more useful as the history builds."
        ),

      confidence:
        "low",

      source:
        "Limited data",
    };
  }

  /* ============================================================
   * STEADY / FALLBACK
   * ============================================================
   */

  return {
    kind:
      "steady",

    title:
      "No major problem stands out right now",

    observation:
      "Your recent data does not show a strong enough shift for Atlas to make a bigger claim.",

    recommendation:
      focusRecommendation(
        focus,
        "Keep the current plan simple and finish the next meaningful item."
      ),

    confidence:
      recentScoredDays >=
      5
        ? "medium"
        : "low",

    source:
      "Recent Atlas data",
  };
}