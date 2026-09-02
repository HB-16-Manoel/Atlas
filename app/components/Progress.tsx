"use client";

import {
  useRef,
  useState,
  type WheelEvent,
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

type ProgressPeriod =
  | "Week"
  | "Month"
  | "3 Months"
  | "Year";

type TrendPoint = {
  key: string;
  label: string;
  fullLabel: string;
  score: number | null;
  showLabel: boolean;
};

type ConsistencyState =
  | "strong"
  | "partial"
  | "missed"
  | "empty"
  | "future";

type ConsistencyDay = {
  day: string;
  shortDay: string;
  dateKey: string;

  state: ConsistencyState;

  tasksCompleted: number;
  tasksTotal: number;

  habitsCompleted: number;
  habitsTotal: number;

  completionPercent: number | null;

  dailyScore: number | null;
};

type DailyBalance = {
  day: string;
  dateKey: string;

  tasks: number | null;
  habits: number | null;

  tasksCompleted: number;
  tasksTotal: number;

  habitsCompleted: number;
  habitsTotal: number;

  future: boolean;
};

type PatternDayResult = {
  name: string;
  average: number;
};

type HabitReliabilityResult = {
  name: string;
  completionRate: number;
  completed: number;
  expected: number;
};

type ImprovementCategory =
  | "Tasks"
  | "Habits"
  | "Neither";

type ImprovementResult = {
  category: ImprovementCategory;
  difference: number;
};

type HistoricalConsistencyDay = {
  dateKey: string;
  state:
    | "strong"
    | "partial"
    | "missed"
    | "empty";
  completionPercent: number | null;
};

type AtlasInsight = {
  title: string;
  body: string;
  period: string;
};

type ProgressProps = {
  tasks?: Task[];
  habits?: Habit[];
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

function startOfWeek(
  date: Date
) {
  const next =
    startOfDay(
      date
    );

  next.setDate(
    next.getDate() -
      next.getDay()
  );

  return next;
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

function addMonths(
  date: Date,
  amount: number
) {
  const next =
    new Date(date);

  next.setMonth(
    next.getMonth() +
      amount
  );

  return startOfDay(
    next
  );
}

function startOfMonth(
  date: Date
) {
  const next =
    startOfDay(
      date
    );

  next.setDate(
    1
  );

  return next;
}

function endOfMonth(
  date: Date
) {
  const next =
    startOfMonth(
      addMonths(
        date,
        1
      )
    );

  next.setDate(
    next.getDate() -
      1
  );

  return startOfDay(
    next
  );
}

/* ============================================================
 * GENERIC HELPERS
 * ============================================================
 */

function averageNumbers(
  values: number[]
) {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  return Math.round(
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

function clampPercent(
  value: number
) {
  return Math.max(
    0,
    Math.min(
      100,
      value
    )
  );
}

/* ============================================================
 * DAILY SCORE HELPERS
 * ============================================================
 */

function getDailyScoreForDate(
  date: Date,
  tasks: Task[],
  habits: Habit[]
) {
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

  const tasksCompleted =
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
        dateKey
    );

  const habitsCompleted =
    activeHabits.filter(
      (
        habit
      ) =>
        habit.completedDates.includes(
          dateKey
        )
    ).length;

  return calculateDailyScore(
    tasksCompleted,
    dayTasks.length,
    habitsCompleted,
    activeHabits.length
  );
}

function getScoresBetween(
  start: Date,
  end: Date,
  tasks: Task[],
  habits: Habit[]
) {
  const scores:
    number[] =
    [];

  let cursor =
    startOfDay(
      start
    );

  const finalDay =
    startOfDay(
      end
    );

  while (
    cursor <=
    finalDay
  ) {
    const score =
      getDailyScoreForDate(
        cursor,
        tasks,
        habits
      );

    if (
      score !==
      null
    ) {
      scores.push(
        score
      );
    }

    cursor =
      addDays(
        cursor,
        1
      );
  }

  return scores;
}

/* ============================================================
 * TREND DATA
 * ============================================================
 */

function buildWeekTrend(
  today: Date,
  tasks: Task[],
  habits: Habit[]
): TrendPoint[] {
  return Array.from(
    {
      length: 7,
    },
    (
      _,
      index
    ) => {
      const date =
        addDays(
          today,
          index -
            6
        );

      const score =
        getDailyScoreForDate(
          date,
          tasks,
          habits
        );

      return {
        key:
          formatDateKey(
            date
          ),

        label:
          date.toLocaleDateString(
            "en-US",
            {
              weekday:
                "short",
            }
          ),

        fullLabel:
          date.toLocaleDateString(
            "en-US",
            {
              weekday:
                "long",
              month:
                "short",
              day:
                "numeric",
            }
          ),

        score,

        showLabel:
          true,
      };
    }
  );
}

function buildMonthTrend(
  today: Date,
  tasks: Task[],
  habits: Habit[]
): TrendPoint[] {
  return Array.from(
    {
      length: 30,
    },
    (
      _,
      index
    ) => {
      const date =
        addDays(
          today,
          index -
            29
        );

      const score =
        getDailyScoreForDate(
          date,
          tasks,
          habits
        );

      const showLabel =
        index ===
          0 ||
        index ===
          7 ||
        index ===
          14 ||
        index ===
          21 ||
        index ===
          29;

      return {
        key:
          formatDateKey(
            date
          ),

        label:
          date.toLocaleDateString(
            "en-US",
            {
              month:
                "short",
              day:
                "numeric",
            }
          ),

        fullLabel:
          date.toLocaleDateString(
            "en-US",
            {
              month:
                "long",
              day:
                "numeric",
              year:
                "numeric",
            }
          ),

        score,

        showLabel,
      };
    }
  );
}

function buildThreeMonthTrend(
  today: Date,
  tasks: Task[],
  habits: Habit[]
): TrendPoint[] {
  return Array.from(
    {
      length: 12,
    },
    (
      _,
      index
    ) => {
      const end =
        addDays(
          today,
          -(
            (
              11 -
              index
            ) *
            7
          )
        );

      const start =
        addDays(
          end,
          -6
        );

      const scores =
        getScoresBetween(
          start,
          end,
          tasks,
          habits
        );

      const score =
        averageNumbers(
          scores
        );

      return {
        key:
          `${formatDateKey(
            start
          )}-${formatDateKey(
            end
          )}`,

        label:
          end.toLocaleDateString(
            "en-US",
            {
              month:
                "short",
              day:
                "numeric",
            }
          ),

        fullLabel:
          `${start.toLocaleDateString(
            "en-US",
            {
              month:
                "short",
              day:
                "numeric",
            }
          )} – ${end.toLocaleDateString(
            "en-US",
            {
              month:
                "short",
              day:
                "numeric",
            }
          )}`,

        score,

        showLabel:
          index ===
            0 ||
          index ===
            2 ||
          index ===
            5 ||
          index ===
            8 ||
          index ===
            11,
      };
    }
  );
}

function buildYearTrend(
  today: Date,
  tasks: Task[],
  habits: Habit[]
): TrendPoint[] {
  const thisMonth =
    startOfMonth(
      today
    );

  return Array.from(
    {
      length: 12,
    },
    (
      _,
      index
    ) => {
      const monthStart =
        addMonths(
          thisMonth,
          index -
            11
        );

      const naturalMonthEnd =
        endOfMonth(
          monthStart
        );

      const monthEnd =
        naturalMonthEnd >
        today
          ? today
          : naturalMonthEnd;

      const scores =
        getScoresBetween(
          monthStart,
          monthEnd,
          tasks,
          habits
        );

      const score =
        averageNumbers(
          scores
        );

      return {
        key:
          formatDateKey(
            monthStart
          ),

        label:
          monthStart.toLocaleDateString(
            "en-US",
            {
              month:
                "short",
            }
          ),

        fullLabel:
          monthStart.toLocaleDateString(
            "en-US",
            {
              month:
                "long",
              year:
                "numeric",
            }
          ),

        score,

        showLabel:
          true,
      };
    }
  );
}

/* ============================================================
 * GRAPH HELPERS
 * ============================================================
 */

function getTrendPointPosition(
  point: TrendPoint,
  index: number,
  total: number
) {
  const width =
    100;

  const height =
    40;

  const x =
    total ===
    1
      ? width /
        2
      : (index /
          (total -
            1)) *
        width;

  if (
    point.score ===
    null
  ) {
    return {
      x,
      y:
        null,
    };
  }

  const y =
    height -
    (point.score /
      100) *
      height;

  return {
    x,
    y,
  };
}

function buildTrendPath(
  data: TrendPoint[]
) {
  const scoredPoints =
    data
      .map(
        (
          point,
          index
        ) => {
          const position =
            getTrendPointPosition(
              point,
              index,
              data.length
            );

          if (
            position.y ===
            null
          ) {
            return null;
          }

          return {
            x:
              position.x,
            y:
              position.y,
          };
        }
      )
      .filter(
        (
          point
        ): point is {
          x: number;
          y: number;
        } =>
          point !==
          null
      );

  if (
    scoredPoints.length ===
    0
  ) {
    return "";
  }

  if (
    scoredPoints.length ===
    1
  ) {
    return `M ${scoredPoints[0].x} ${scoredPoints[0].y}`;
  }

  return scoredPoints
    .map(
      (
        point,
        index
      ) =>
        `${
          index ===
          0
            ? "M"
            : "L"
        } ${point.x} ${point.y}`
    )
    .join(
      " "
    );
}

/* ============================================================
 * PATTERN HELPERS
 * ============================================================
 */

function getStrongestAndWeakestDay(
  today: Date,
  tasks: Task[],
  habits: Habit[]
) {
  const weekdayScores =
    new Map<
      number,
      number[]
    >();

  for (
    let index =
      27;
    index >=
    0;
    index -=
    1
  ) {
    const date =
      addDays(
        today,
        -index
      );

    const score =
      getDailyScoreForDate(
        date,
        tasks,
        habits
      );

    if (
      score ===
      null
    ) {
      continue;
    }

    const weekday =
      date.getDay();

    const existing =
      weekdayScores.get(
        weekday
      ) ??
      [];

    existing.push(
      score
    );

    weekdayScores.set(
      weekday,
      existing
    );
  }

  const results:
    PatternDayResult[] =
    [];

  weekdayScores.forEach(
    (
      scores,
      weekday
    ) => {
      const average =
        averageNumbers(
          scores
        );

      if (
        average ===
        null
      ) {
        return;
      }

      const referenceDate =
        new Date(
          2026,
          0,
          4 +
            weekday
        );

      results.push(
        {
          name:
            referenceDate.toLocaleDateString(
              "en-US",
              {
                weekday:
                  "long",
              }
            ),

          average,
        }
      );
    }
  );

  if (
    results.length ===
    0
  ) {
    return {
      strongest:
        null,

      weakest:
        null,
    };
  }

  const strongest =
    [...results].sort(
      (
        a,
        b
      ) =>
        b.average -
        a.average
    )[0];

  const weakest =
    [...results].sort(
      (
        a,
        b
      ) =>
        a.average -
        b.average
    )[0];

  return {
    strongest,
    weakest,
  };
}

function getMostReliableHabit(
  today: Date,
  habits: Habit[]
): HabitReliabilityResult | null {
  const windowStart =
    addDays(
      today,
      -27
    );

  const results =
    habits
      .map(
        (
          habit
        ) => {
          const habitStart =
            startOfDay(
              new Date(
                `${habit.createdAt}T12:00:00`
              )
            );

          const activeStart =
            habitStart >
            windowStart
              ? habitStart
              : windowStart;

          if (
            activeStart >
            today
          ) {
            return null;
          }

          let expected =
            0;

          let completed =
            0;

          let cursor =
            activeStart;

          while (
            cursor <=
            today
          ) {
            const dateKey =
              formatDateKey(
                cursor
              );

            expected +=
              1;

            if (
              habit.completedDates.includes(
                dateKey
              )
            ) {
              completed +=
                1;
            }

            cursor =
              addDays(
                cursor,
                1
              );
          }

          if (
            expected ===
            0
          ) {
            return null;
          }

          return {
            name:
              habit.name,

            completionRate:
              Math.round(
                (completed /
                  expected) *
                  100
              ),

            completed,

            expected,
          };
        }
      )
      .filter(
        (
          result
        ): result is HabitReliabilityResult =>
          result !==
          null
      );

  if (
    results.length ===
    0
  ) {
    return null;
  }

  return [...results].sort(
    (
      a,
      b
    ) => {
      if (
        b.completionRate !==
        a.completionRate
      ) {
        return (
          b.completionRate -
          a.completionRate
        );
      }

      if (
        b.completed !==
        a.completed
      ) {
        return (
          b.completed -
          a.completed
        );
      }

      return (
        b.expected -
        a.expected
      );
    }
  )[0];
}

function getCategoryCompletionForRange(
  start: Date,
  end: Date,
  tasks: Task[],
  habits: Habit[]
) {
  let taskCompleted =
    0;

  let taskTotal =
    0;

  let habitCompleted =
    0;

  let habitTotal =
    0;

  let cursor =
    startOfDay(
      start
    );

  const finalDay =
    startOfDay(
      end
    );

  while (
    cursor <=
    finalDay
  ) {
    const dateKey =
      formatDateKey(
        cursor
      );

    const dayTasks =
      tasks.filter(
        (
          task
        ) =>
          task.date ===
          dateKey
      );

    taskTotal +=
      dayTasks.length;

    taskCompleted +=
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
          dateKey
      );

    habitTotal +=
      activeHabits.length;

    habitCompleted +=
      activeHabits.filter(
        (
          habit
        ) =>
          habit.completedDates.includes(
            dateKey
          )
      ).length;

    cursor =
      addDays(
        cursor,
        1
      );
  }

  return {
    taskPercent:
      taskTotal >
      0
        ? Math.round(
            (taskCompleted /
              taskTotal) *
              100
          )
        : null,

    habitPercent:
      habitTotal >
      0
        ? Math.round(
            (habitCompleted /
              habitTotal) *
              100
          )
        : null,
  };
}

function getBiggestImprovement(
  today: Date,
  tasks: Task[],
  habits: Habit[]
): ImprovementResult {
  const recentStart =
    addDays(
      today,
      -13
    );

  const previousEnd =
    addDays(
      recentStart,
      -1
    );

  const previousStart =
    addDays(
      previousEnd,
      -13
    );

  const recent =
    getCategoryCompletionForRange(
      recentStart,
      today,
      tasks,
      habits
    );

  const previous =
    getCategoryCompletionForRange(
      previousStart,
      previousEnd,
      tasks,
      habits
    );

  const taskDifference =
    recent.taskPercent !==
      null &&
    previous.taskPercent !==
      null
      ? recent.taskPercent -
        previous.taskPercent
      : null;

  const habitDifference =
    recent.habitPercent !==
      null &&
    previous.habitPercent !==
      null
      ? recent.habitPercent -
        previous.habitPercent
      : null;

  if (
    taskDifference ===
      null &&
    habitDifference ===
      null
  ) {
    return {
      category:
        "Neither",

      difference:
        0,
    };
  }

  if (
    taskDifference !==
      null &&
    (
      habitDifference ===
        null ||
      taskDifference >=
        habitDifference
    )
  ) {
    if (
      taskDifference >
      0
    ) {
      return {
        category:
          "Tasks",

        difference:
          taskDifference,
      };
    }
  }

  if (
    habitDifference !==
      null &&
    habitDifference >
      0
  ) {
    return {
      category:
        "Habits",

      difference:
        habitDifference,
    };
  }

  return {
    category:
      "Neither",

    difference:
      Math.max(
        taskDifference ??
          0,
        habitDifference ??
          0
      ),
  };
}

/* ============================================================
 * CONSISTENCY HELPERS
 * ============================================================
 */

function getHistoricalConsistencyDay(
  date: Date,
  tasks: Task[],
  habits: Habit[]
): HistoricalConsistencyDay {
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

  const tasksCompleted =
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
        dateKey
    );

  const habitsCompleted =
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

  if (
    totalPlanned ===
    0
  ) {
    return {
      dateKey,
      state:
        "empty",
      completionPercent:
        null,
    };
  }

  const totalCompleted =
    tasksCompleted +
    habitsCompleted;

  const completionPercent =
    Math.round(
      (totalCompleted /
        totalPlanned) *
        100
    );

  let state:
    HistoricalConsistencyDay["state"];

  if (
    completionPercent >=
    80
  ) {
    state =
      "strong";
  } else if (
    completionPercent >=
    40
  ) {
    state =
      "partial";
  } else {
    state =
      "missed";
  }

  return {
    dateKey,
    state,
    completionPercent,
  };
}

function buildHistoricalConsistencyRange(
  start: Date,
  end: Date,
  tasks: Task[],
  habits: Habit[]
) {
  const result:
    HistoricalConsistencyDay[] =
    [];

  let cursor =
    startOfDay(
      start
    );

  const finalDay =
    startOfDay(
      end
    );

  while (
    cursor <=
    finalDay
  ) {
    result.push(
      getHistoricalConsistencyDay(
        cursor,
        tasks,
        habits
      )
    );

    cursor =
      addDays(
        cursor,
        1
      );
  }

  return result;
}

function getBestStrongStreak(
  days:
    HistoricalConsistencyDay[]
) {
  let best =
    0;

  let current =
    0;

  days.forEach(
    (
      day
    ) => {
      if (
        day.state ===
        "strong"
      ) {
        current +=
          1;

        best =
          Math.max(
            best,
            current
          );

        return;
      }

      current =
        0;
    }
  );

  return best;
}

function getCurrentStrongStreak(
  days:
    HistoricalConsistencyDay[]
) {
  let streak =
    0;

  for (
    let index =
      days.length -
      1;
    index >=
    0;
    index -=
    1
  ) {
    if (
      days[index].state !==
      "strong"
    ) {
      break;
    }

    streak +=
      1;
  }

  return streak;
}

/* ============================================================
 * ATLAS INSIGHT V1
 * ============================================================
 */

function getAtlasInsight(
  today: Date,
  tasks: Task[],
  habits: Habit[],
  strongestDay: PatternDayResult | null,
  weakestDay: PatternDayResult | null,
  mostReliableHabit: HabitReliabilityResult | null
): AtlasInsight {
  const recentStart =
    addDays(
      today,
      -6
    );

  const previousEnd =
    addDays(
      recentStart,
      -1
    );

  const previousStart =
    addDays(
      previousEnd,
      -6
    );

  const recentCompletion =
    getCategoryCompletionForRange(
      recentStart,
      today,
      tasks,
      habits
    );

  const previousCompletion =
    getCategoryCompletionForRange(
      previousStart,
      previousEnd,
      tasks,
      habits
    );

  const recentScores =
    getScoresBetween(
      recentStart,
      today,
      tasks,
      habits
    );

  const previousScores =
    getScoresBetween(
      previousStart,
      previousEnd,
      tasks,
      habits
    );

  const recentScoreAverage =
    averageNumbers(
      recentScores
    );

  const previousScoreAverage =
    averageNumbers(
      previousScores
    );

  const scoreDifference =
    recentScoreAverage !==
      null &&
    previousScoreAverage !==
      null
      ? recentScoreAverage -
        previousScoreAverage
      : null;

  const recentConsistency =
    buildHistoricalConsistencyRange(
      recentStart,
      today,
      tasks,
      habits
    );

  const recentPlannedDays =
    recentConsistency.filter(
      (
        day
      ) =>
        day.state !==
        "empty"
    );

  const recentOnTrackDays =
    recentPlannedDays.filter(
      (
        day
      ) =>
        day.state ===
        "strong"
    ).length;

  const hasEnoughData =
    recentScores.length >=
      3 ||
    recentPlannedDays.length >=
      3;

  if (
    !hasEnoughData
  ) {
    return {
      title:
        "Atlas is still learning your patterns.",

      body:
        "Keep planning tasks and checking off habits for a few more days. Once there is enough activity, Atlas will start highlighting meaningful changes in your performance.",

      period:
        "Building history",
    };
  }

  /* ------------------------------------------------------------
   * Strong improvement
   * ------------------------------------------------------------ */

  if (
    scoreDifference !==
      null &&
    scoreDifference >=
      8
  ) {
    return {
      title:
        "Your overall performance is improving.",

      body:
        `Your average Daily Score is up ${scoreDifference} points compared with the previous 7 days. Your recent trend is moving in the right direction.`,

      period:
        "Last 7 days",
    };
  }

  /* ------------------------------------------------------------
   * Strong decline
   * ------------------------------------------------------------ */

  if (
    scoreDifference !==
      null &&
    scoreDifference <=
      -8
  ) {
    const decline =
      Math.abs(
        scoreDifference
      );

    const taskDifference =
      recentCompletion.taskPercent !==
        null &&
      previousCompletion.taskPercent !==
        null
        ? recentCompletion.taskPercent -
          previousCompletion.taskPercent
        : null;

    const habitDifference =
      recentCompletion.habitPercent !==
        null &&
      previousCompletion.habitPercent !==
        null
        ? recentCompletion.habitPercent -
          previousCompletion.habitPercent
        : null;

    let reason =
      "Both tasks and habits contributed to the change.";

    if (
      taskDifference !==
        null &&
      habitDifference !==
        null
    ) {
      if (
        taskDifference <
        habitDifference
      ) {
        reason =
          "Task follow-through appears to be the main difference.";
      } else if (
        habitDifference <
        taskDifference
      ) {
        reason =
          "Habit completion appears to be the main difference.";
      }
    }

    return {
      title:
        "Your recent performance has dipped.",

      body:
        `Your average Daily Score is ${decline} points lower than the previous 7 days. ${reason}`,

      period:
        "Last 7 days",
    };
  }

  /* ------------------------------------------------------------
   * Habits clearly ahead
   * ------------------------------------------------------------ */

  if (
    recentCompletion.taskPercent !==
      null &&
    recentCompletion.habitPercent !==
      null &&
    recentCompletion.habitPercent -
      recentCompletion.taskPercent >=
      15
  ) {
    const difference =
      recentCompletion.habitPercent -
      recentCompletion.taskPercent;

    return {
      title:
        "Your habits are carrying your consistency.",

      body:
        `Habit completion is ${difference} points ahead of task completion over the last 7 days. Improving task follow-through would have the biggest effect on your overall performance.`,

      period:
        "Last 7 days",
    };
  }

  /* ------------------------------------------------------------
   * Tasks clearly ahead
   * ------------------------------------------------------------ */

  if (
    recentCompletion.taskPercent !==
      null &&
    recentCompletion.habitPercent !==
      null &&
    recentCompletion.taskPercent -
      recentCompletion.habitPercent >=
      15
  ) {
    const difference =
      recentCompletion.taskPercent -
      recentCompletion.habitPercent;

    return {
      title:
        "Your tasks are stronger than your habits right now.",

      body:
        `Task completion is ${difference} points ahead of habit completion over the last 7 days. Your biggest opportunity is making your daily habits more reliable.`,

      period:
        "Last 7 days",
    };
  }

  /* ------------------------------------------------------------
   * Strong consistency
   * ------------------------------------------------------------ */

  if (
    recentPlannedDays.length >=
      4 &&
    recentOnTrackDays /
      recentPlannedDays.length >=
      0.8
  ) {
    return {
      title:
        "You’ve been unusually consistent.",

      body:
        `You were on track ${recentOnTrackDays} of your last ${recentPlannedDays.length} planned days. Your recent performance is being driven by consistency rather than one unusually strong day.`,

      period:
        "Last 7 days",
    };
  }

  /* ------------------------------------------------------------
   * Reliable habit
   * ------------------------------------------------------------ */

  if (
    mostReliableHabit &&
    mostReliableHabit.expected >=
      5 &&
    mostReliableHabit.completionRate >=
      85
  ) {
    return {
      title:
        `${mostReliableHabit.name} is becoming one of your strongest routines.`,

      body:
        `You completed it ${mostReliableHabit.completed} of ${mostReliableHabit.expected} opportunities over the last 4 weeks, a ${mostReliableHabit.completionRate}% completion rate.`,

      period:
        "Last 4 weeks",
    };
  }

  /* ------------------------------------------------------------
   * Weekday pattern
   * ------------------------------------------------------------ */

  if (
    strongestDay &&
    weakestDay &&
    strongestDay.name !==
      weakestDay.name &&
    strongestDay.average -
      weakestDay.average >=
      12
  ) {
    const gap =
      strongestDay.average -
      weakestDay.average;

    return {
      title:
        `${strongestDay.name} tends to be your strongest day.`,

      body:
        `Your average Daily Score on ${strongestDay.name}s is ${strongestDay.average}, compared with ${weakestDay.average} on ${weakestDay.name}s. That ${gap}-point gap is one of your clearest recent patterns.`,

      period:
        "Last 4 weeks",
    };
  }

  /* ------------------------------------------------------------
   * Stable performance
   * ------------------------------------------------------------ */

  if (
    scoreDifference !==
      null &&
    Math.abs(
      scoreDifference
    ) <=
      5
  ) {
    const difference =
      Math.abs(
        scoreDifference
      );

    return {
      title:
        "Your performance has been fairly steady.",

      body:
        difference ===
        0
          ? "Your average Daily Score is unchanged from the previous 7 days. There is no major upward or downward shift right now."
          : `Your average Daily Score is within ${difference} points of the previous 7 days. There is no major upward or downward shift right now.`,

      period:
        "Last 7 days",
    };
  }

  return {
    title:
      "Your recent activity is starting to form a pattern.",

    body:
      "Atlas has enough data to track your performance, but there is not one clear trend dominating yet. Keep planning and completing tasks and habits to make the signal stronger.",

    period:
      "Recent activity",
  };
}

/* ============================================================
 * CONSISTENCY STYLE
 * ============================================================
 */

function getConsistencyStyle(
  state: ConsistencyState
) {
  if (
    state ===
    "strong"
  ) {
    return {
      outer:
        "border-[#5B7CFF]/45 bg-[#5B7CFF]/10",

      inner:
        "bg-[#6F8CFF]",

      label:
        "On track",

      text:
        "text-white/60",
    };
  }

  if (
    state ===
    "partial"
  ) {
    return {
      outer:
        "border-[#5B7CFF]/25 bg-[#5B7CFF]/[0.045]",

      inner:
        "bg-[#5B7CFF]/40",

      label:
        "Partial",

      text:
        "text-white/40",
    };
  }

  if (
    state ===
    "missed"
  ) {
    return {
      outer:
        "border-white/[0.1] bg-white/[0.025]",

      inner:
        "bg-white/15",

      label:
        "Missed",

      text:
        "text-white/30",
    };
  }

  if (
    state ===
    "empty"
  ) {
    return {
      outer:
        "border-white/[0.07] bg-white/[0.015]",

      inner:
        "bg-white/15",

      label:
        "No plan",

      text:
        "text-white/20",
    };
  }

  return {
    outer:
      "border-white/[0.06] bg-transparent",

    inner:
      "border border-white/10 bg-transparent",

    label:
      "Upcoming",

    text:
      "text-white/20",
  };
}

/* ============================================================
 * PROGRESS
 * ============================================================
 */

export default function Progress({
  tasks = [],
  habits = [],
}: ProgressProps) {
  const [
    activePeriod,
    setActivePeriod,
  ] =
    useState<ProgressPeriod>(
      "Week"
    );

  const [
    hoveredDay,
    setHoveredDay,
  ] =
    useState<ConsistencyDay | null>(
      null
    );

  const [
    hoveredTrendKey,
    setHoveredTrendKey,
  ] =
    useState<string | null>(
      null
    );

  const scrollRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const overviewRef =
    useRef<HTMLElement | null>(
      null
    );

  const consistencyRef =
    useRef<HTMLElement | null>(
      null
    );

  const wheelLockRef =
    useRef(false);

  const scrollAnimationRef =
    useRef<number | null>(
      null
    );

  /* ============================================================
   * TODAY / CURRENT CALENDAR WEEK
   * ============================================================
   */

  const today =
    startOfDay(
      new Date()
    );

  const todayKey =
    formatDateKey(
      today
    );

  const currentWeekStart =
    startOfWeek(
      today
    );

  const currentWeekStartKey =
    formatDateKey(
      currentWeekStart
    );

  const fullWeekDays =
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
            currentWeekStart
          );

        date.setDate(
          currentWeekStart.getDate() +
            index
        );

        return startOfDay(
          date
        );
      }
    );

  const elapsedWeekDays =
    fullWeekDays
      .filter(
        (
          date
        ) =>
          date <=
          today
      )
      .map(
        (
          date
        ) =>
          formatDateKey(
            date
          )
      );

  /* ============================================================
   * REAL OVERALL PROGRESS
   * ============================================================
   */

  let trendData:
    TrendPoint[];

  if (
    activePeriod ===
    "Week"
  ) {
    trendData =
      buildWeekTrend(
        today,
        tasks,
        habits
      );
  } else if (
    activePeriod ===
    "Month"
  ) {
    trendData =
      buildMonthTrend(
        today,
        tasks,
        habits
      );
  } else if (
    activePeriod ===
    "3 Months"
  ) {
    trendData =
      buildThreeMonthTrend(
        today,
        tasks,
        habits
      );
  } else {
    trendData =
      buildYearTrend(
        today,
        tasks,
        habits
      );
  }

  const trendPath =
    buildTrendPath(
      trendData
    );

  const scoredTrendPoints =
    trendData.filter(
      (
        point
      ) =>
        point.score !==
        null
    );

  const periodAverage =
    averageNumbers(
      scoredTrendPoints.map(
        (
          point
        ) =>
          point.score as number
      )
    );

  const todayScore =
    getDailyScoreForDate(
      today,
      tasks,
      habits
    );

  const overallScore =
    activePeriod ===
    "Week"
      ? todayScore
      : periodAverage;

  let overallScoreLabel =
    "Today";

  let overallPeriodLabel =
    "Last 7 days";

  if (
    activePeriod ===
    "Month"
  ) {
    overallScoreLabel =
      "30-day avg";

    overallPeriodLabel =
      "Last 30 days";
  }

  if (
    activePeriod ===
    "3 Months"
  ) {
    overallScoreLabel =
      "12-week avg";

    overallPeriodLabel =
      "Last 12 weeks";
  }

  if (
    activePeriod ===
    "Year"
  ) {
    overallScoreLabel =
      "12-month avg";

    overallPeriodLabel =
      "Last 12 months";
  }

  /* ============================================================
   * REAL PATTERNS
   * ============================================================
   */

  const {
    strongest:
      strongestDay,
    weakest:
      weakestDay,
  } =
    getStrongestAndWeakestDay(
      today,
      tasks,
      habits
    );

  const mostReliableHabit =
    getMostReliableHabit(
      today,
      habits
    );

  const biggestImprovement =
    getBiggestImprovement(
      today,
      tasks,
      habits
    );

  /* ============================================================
   * REAL ATLAS INSIGHT V1
   * ============================================================
   */

  const atlasInsight =
    getAtlasInsight(
      today,
      tasks,
      habits,
      strongestDay,
      weakestDay,
      mostReliableHabit
    );

  /* ============================================================
   * REAL WEEKLY TASK COMPLETION
   * ============================================================
   */

  const currentWeekTasks =
    tasks.filter(
      (
        task
      ) =>
        task.date >=
          currentWeekStartKey &&
        task.date <=
          todayKey
    );

  const completedWeekTasks =
    currentWeekTasks.filter(
      (
        task
      ) =>
        task.completed
    ).length;

  const totalWeekTasks =
    currentWeekTasks.length;

  const taskCompletionPercent =
    totalWeekTasks >
    0
      ? Math.round(
          (completedWeekTasks /
            totalWeekTasks) *
            100
        )
      : 0;

  /* ============================================================
   * REAL WEEKLY HABIT COMPLETION
   * ============================================================
   */

  let totalHabitCheckIns =
    0;

  let completedHabitCheckIns =
    0;

  habits.forEach(
    (
      habit
    ) => {
      elapsedWeekDays.forEach(
        (
          dateKey
        ) => {
          if (
            habit.createdAt >
            dateKey
          ) {
            return;
          }

          totalHabitCheckIns +=
            1;

          if (
            habit.completedDates.includes(
              dateKey
            )
          ) {
            completedHabitCheckIns +=
              1;
          }
        }
      );
    }
  );

  const habitCompletionPercent =
    totalHabitCheckIns >
    0
      ? Math.round(
          (completedHabitCheckIns /
            totalHabitCheckIns) *
            100
        )
      : 0;

  /* ============================================================
   * REAL TASKS VS HABITS
   * ============================================================
   */

  const balanceData: DailyBalance[] =
    fullWeekDays.map(
      (
        date
      ) => {
        const dateKey =
          formatDateKey(
            date
          );

        const future =
          date >
          today;

        const dayTasks =
          tasks.filter(
            (
              task
            ) =>
              task.date ===
              dateKey
          );

        const dayCompletedTasks =
          dayTasks.filter(
            (
              task
            ) =>
              task.completed
          ).length;

        const taskPercent =
          future ||
          dayTasks.length ===
            0
            ? null
            : Math.round(
                (dayCompletedTasks /
                  dayTasks.length) *
                  100
              );

        const activeHabits =
          habits.filter(
            (
              habit
            ) =>
              habit.createdAt <=
              dateKey
          );

        const dayCompletedHabits =
          activeHabits.filter(
            (
              habit
            ) =>
              habit.completedDates.includes(
                dateKey
              )
          ).length;

        const habitPercent =
          future ||
          activeHabits.length ===
            0
            ? null
            : Math.round(
                (dayCompletedHabits /
                  activeHabits.length) *
                  100
              );

        return {
          day:
            date.toLocaleDateString(
              "en-US",
              {
                weekday:
                  "short",
              }
            ),

          dateKey,

          tasks:
            taskPercent,

          habits:
            habitPercent,

          tasksCompleted:
            dayCompletedTasks,

          tasksTotal:
            dayTasks.length,

          habitsCompleted:
            dayCompletedHabits,

          habitsTotal:
            activeHabits.length,

          future,
        };
      }
    );

  const taskDaysWithData =
    balanceData.filter(
      (
        day
      ) =>
        !day.future &&
        day.tasks !==
          null
    );

  const habitDaysWithData =
    balanceData.filter(
      (
        day
      ) =>
        !day.future &&
        day.habits !==
          null
    );

  const averageTaskCompletion =
    taskDaysWithData.length >
    0
      ? Math.round(
          taskDaysWithData.reduce(
            (
              total,
              day
            ) =>
              total +
              (day.tasks ??
                0),
            0
          ) /
            taskDaysWithData.length
        )
      : null;

  const averageHabitCompletion =
    habitDaysWithData.length >
    0
      ? Math.round(
          habitDaysWithData.reduce(
            (
              total,
              day
            ) =>
              total +
              (day.habits ??
                0),
            0
          ) /
            habitDaysWithData.length
        )
      : null;

  let balanceSummary =
    "No completion data yet this week.";

  if (
    averageTaskCompletion !==
      null &&
    averageHabitCompletion !==
      null
  ) {
    const difference =
      averageHabitCompletion -
      averageTaskCompletion;

    if (
      difference >=
      5
    ) {
      balanceSummary =
        `Habits are ahead of tasks this week by ${difference} points.`;
    } else if (
      difference <=
      -5
    ) {
      balanceSummary =
        `Tasks are ahead of habits this week by ${Math.abs(
          difference
        )} points.`;
    } else {
      balanceSummary =
        "Tasks and habits are moving at about the same pace this week.";
    }
  } else if (
    averageHabitCompletion !==
    null
  ) {
    balanceSummary =
      "Habit activity is being tracked this week.";
  } else if (
    averageTaskCompletion !==
    null
  ) {
    balanceSummary =
      "Task activity is being tracked this week.";
  }

  /* ============================================================
   * REAL DAYS ON TRACK
   * ============================================================
   */

  const consistencyData: ConsistencyDay[] =
    fullWeekDays.map(
      (
        date
      ) => {
        const dateKey =
          formatDateKey(
            date
          );

        const future =
          date >
          today;

        const dayTasks =
          tasks.filter(
            (
              task
            ) =>
              task.date ===
              dateKey
          );

        const tasksCompleted =
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
              dateKey
          );

        const habitsCompleted =
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
          tasksCompleted +
          habitsCompleted;

        let state: ConsistencyState =
          "future";

        let completionPercent:
          | number
          | null =
          null;

        let dailyScore:
          | number
          | null =
          null;

        if (
          future
        ) {
          state =
            "future";
        } else if (
          totalPlanned ===
          0
        ) {
          state =
            "empty";
        } else {
          completionPercent =
            Math.round(
              (totalCompleted /
                totalPlanned) *
                100
            );

          dailyScore =
            calculateDailyScore(
              tasksCompleted,
              dayTasks.length,
              habitsCompleted,
              activeHabits.length
            );

          if (
            completionPercent >=
            80
          ) {
            state =
              "strong";
          } else if (
            completionPercent >=
            40
          ) {
            state =
              "partial";
          } else {
            state =
              "missed";
          }
        }

        return {
          day:
            date.toLocaleDateString(
              "en-US",
              {
                weekday:
                  "long",
              }
            ),

          shortDay:
            date.toLocaleDateString(
              "en-US",
              {
                weekday:
                  "short",
              }
            ),

          dateKey,

          state,

          tasksCompleted,

          tasksTotal:
            dayTasks.length,

          habitsCompleted,

          habitsTotal:
            activeHabits.length,

          completionPercent,

          dailyScore,
        };
      }
    );

  const elapsedPlannedDays =
    consistencyData.filter(
      (
        day
      ) =>
        day.state !==
          "future" &&
        day.state !==
          "empty"
    );

  const onTrackDays =
    elapsedPlannedDays.filter(
      (
        day
      ) =>
        day.state ===
        "strong"
    ).length;

  const plannedDayCount =
    elapsedPlannedDays.length;

  /* ============================================================
   * REAL 4-WEEK CONSISTENCY
   * ============================================================
   */

  const last28Start =
    addDays(
      today,
      -27
    );

  const previous28End =
    addDays(
      last28Start,
      -1
    );

  const previous28Start =
    addDays(
      previous28End,
      -27
    );

  const last28Consistency =
    buildHistoricalConsistencyRange(
      last28Start,
      today,
      tasks,
      habits
    );

  const previous28Consistency =
    buildHistoricalConsistencyRange(
      previous28Start,
      previous28End,
      tasks,
      habits
    );

  const last28PlannedDays =
    last28Consistency.filter(
      (
        day
      ) =>
        day.state !==
        "empty"
    );

  const previous28PlannedDays =
    previous28Consistency.filter(
      (
        day
      ) =>
        day.state !==
        "empty"
    );

  const last28OnTrack =
    last28PlannedDays.filter(
      (
        day
      ) =>
        day.state ===
        "strong"
    ).length;

  const previous28OnTrack =
    previous28PlannedDays.filter(
      (
        day
      ) =>
        day.state ===
        "strong"
    ).length;

  const consistencyDifference =
    last28OnTrack -
    previous28OnTrack;

  const currentStreak =
    getCurrentStrongStreak(
      last28Consistency
    );

  const bestStreak =
    getBestStrongStreak(
      last28Consistency
    );

  /* ============================================================
   * SCROLLING
   * ============================================================
   */

  const animateScrollTo = (
    targetTop: number,
    duration =
      1150
  ) => {
    const container =
      scrollRef.current;

    if (
      !container
    ) {
      return;
    }

    if (
      scrollAnimationRef.current !==
      null
    ) {
      cancelAnimationFrame(
        scrollAnimationRef.current
      );
    }

    const startTop =
      container.scrollTop;

    const distance =
      targetTop -
      startTop;

    const startTime =
      performance.now();

    const easeInOutQuart = (
      progress: number
    ) => {
      if (
        progress <
        0.5
      ) {
        return (
          8 *
          progress *
          progress *
          progress *
          progress
        );
      }

      return (
        1 -
        Math.pow(
          -2 *
            progress +
            2,
          4
        ) /
          2
      );
    };

    const animate = (
      now: number
    ) => {
      const elapsed =
        now -
        startTime;

      const progress =
        Math.min(
          elapsed /
            duration,
          1
        );

      const eased =
        easeInOutQuart(
          progress
        );

      container.scrollTop =
        startTop +
        distance *
          eased;

      if (
        progress <
        1
      ) {
        scrollAnimationRef.current =
          requestAnimationFrame(
            animate
          );

        return;
      }

      scrollAnimationRef.current =
        null;
    };

    scrollAnimationRef.current =
      requestAnimationFrame(
        animate
      );
  };

  const scrollToSection = (
    section:
      | "overview"
      | "consistency"
  ) => {
    const target =
      section ===
      "overview"
        ? overviewRef.current
        : consistencyRef.current;

    if (
      !target
    ) {
      return;
    }

    animateScrollTo(
      target.offsetTop
    );
  };

  const handleWheel = (
    event:
      WheelEvent<HTMLDivElement>
  ) => {
    const container =
      scrollRef.current;

    if (
      !container
    ) {
      return;
    }

    if (
      Math.abs(
        event.deltaY
      ) <
      18
    ) {
      return;
    }

    if (
      wheelLockRef.current
    ) {
      event.preventDefault();

      return;
    }

    const viewportHeight =
      container.clientHeight;

    const currentPosition =
      container.scrollTop;

    const onOverview =
      currentPosition <
      viewportHeight *
        0.5;

    if (
      event.deltaY >
        0 &&
      onOverview
    ) {
      event.preventDefault();

      wheelLockRef.current =
        true;

      scrollToSection(
        "consistency"
      );

      window.setTimeout(
        () => {
          wheelLockRef.current =
            false;
        },
        1250
      );

      return;
    }

    if (
      event.deltaY <
        0 &&
      !onOverview
    ) {
      event.preventDefault();

      wheelLockRef.current =
        true;

      scrollToSection(
        "overview"
      );

      window.setTimeout(
        () => {
          wheelLockRef.current =
            false;
        },
        1250
      );
    }
  };

  /* ============================================================
   * UI
   * ============================================================
   */

  return (
    <div
      ref={
        scrollRef
      }

      onWheel={
        handleWheel
      }

      className="
        -m-10
        h-screen
        overflow-y-auto
        overscroll-contain
        [scrollbar-width:none]
        [&::-webkit-scrollbar]:hidden
      "
    >
      {/* ======================================================
       * PERFORMANCE
       * ====================================================== */}

      <section
        ref={
          overviewRef
        }

        className="
          flex
          min-h-screen
          flex-col
          px-10
          py-5
        "
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-white/35">
              Your performance over time
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-[-0.025em]">
              Progress
            </h2>
          </div>

          <div className="flex items-center rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
            {[
              "Week",
              "Month",
              "3 Months",
              "Year",
            ].map(
              (
                period
              ) => (
                <button
                  key={
                    period
                  }

                  onClick={() =>
                    setActivePeriod(
                      period as ProgressPeriod
                    )
                  }

                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    activePeriod ===
                    period
                      ? "bg-white/[0.09] text-white"
                      : "text-white/35 hover:text-white/60"
                  }`}
                >
                  {
                    period
                  }
                </button>
              )
            )}
          </div>
        </div>

        {/* OVERALL PROGRESS */}

        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-6 pb-4 pt-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
                Overall progress
              </p>

              <div className="mt-2.5 flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-[-0.045em]">
                  {
                    overallScore ??
                    "—"
                  }
                </span>

                <span className="mb-1.5 rounded-lg bg-[#5B7CFF]/10 px-2.5 py-1 text-xs font-medium text-[#8EA4FF]">
                  {
                    overallScoreLabel
                  }
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-white/30">
                Daily Score
              </p>

              <p className="mt-1 text-sm text-white/50">
                {
                  overallPeriodLabel
                }
              </p>
            </div>
          </div>

          <div className="relative mt-4 h-[180px]">
            <div className="absolute inset-0 flex flex-col justify-between">
              {[
                "100",
                "75",
                "50",
                "25",
                "0",
              ].map(
                (
                  label
                ) => (
                  <div
                    key={
                      label
                    }

                    className="flex items-center gap-4"
                  >
                    <span className="w-5 text-[10px] text-white/20">
                      {
                        label
                      }
                    </span>

                    <div className="h-px flex-1 bg-white/[0.045]" />
                  </div>
                )
              )}
            </div>

            <div className="absolute bottom-5 left-9 right-0 top-0">
              <svg
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                className="h-full w-full overflow-visible"
              >
                {trendPath && (
                  <path
                    d={
                      trendPath
                    }

                    fill="none"
                    stroke="#5B7CFF"
                    strokeWidth="0.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {trendData.map(
                  (
                    point,
                    index
                  ) => {
                    const position =
                      getTrendPointPosition(
                        point,
                        index,
                        trendData.length
                      );

                    if (
                      position.y ===
                      null
                    ) {
                      return null;
                    }

                    return (
                      <circle
                        key={
                          point.key
                        }

                        cx={
                          position.x
                        }

                        cy={
                          position.y
                        }

                        r={
                          hoveredTrendKey ===
                          point.key
                            ? "1.65"
                            : "1.05"
                        }

                        fill="#11131D"
                        stroke="#8199FF"
                        strokeWidth="0.55"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  }
                )}
              </svg>

              <div className="absolute inset-0 flex">
                {trendData.map(
                  (
                    point
                  ) => (
                    <div
                      key={
                        point.key
                      }

                      onMouseEnter={() =>
                        setHoveredTrendKey(
                          point.key
                        )
                      }

                      onMouseLeave={() =>
                        setHoveredTrendKey(
                          null
                        )
                      }

                      className="group relative flex-1"
                    >
                      {hoveredTrendKey ===
                        point.key &&
                        point.score !==
                          null && (
                          <div className="pointer-events-none absolute left-1/2 top-2 z-20 w-max -translate-x-1/2 rounded-lg border border-white/[0.1] bg-[#171A26] px-3 py-2 shadow-xl shadow-black/30">
                            <p className="text-[10px] text-white/30">
                              {
                                point.fullLabel
                              }
                            </p>

                            <p className="mt-0.5 text-sm font-semibold text-white">
                              {
                                point.score
                              }
                            </p>
                          </div>
                        )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div
            className="ml-9 mt-1 grid"
            style={{
              gridTemplateColumns:
                `repeat(${trendData.length}, minmax(0, 1fr))`,
            }}
          >
            {trendData.map(
              (
                point
              ) => (
                <div
                  key={
                    point.key
                  }

                  className="min-w-0 text-center"
                >
                  {point.showLabel ? (
                    <p className="truncate px-0.5 text-[10px] text-white/25">
                      {
                        point.label
                      }
                    </p>
                  ) : (
                    <span className="block h-[15px]" />
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {/* PATTERNS + COMPLETION */}

        <div className="mt-4 grid grid-cols-[1.12fr_0.88fr] gap-5">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/30">
                  Patterns
                </p>

                <h3 className="mt-1 text-xl font-medium">
                  What&apos;s shaping your week
                </h3>

                <p className="mt-1 text-xs text-white/25">
                  Based on the last 4 weeks
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#5B7CFF]/15 bg-[#5B7CFF]/[0.06] text-[#8199FF]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 15 15"
                  fill="none"
                >
                  <path
                    d="M2.5 10.8L5.3 7.8L7.5 9.4L12.4 4.2"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M9.6 4.2H12.4V7"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-sm text-white/35">
                  Strongest day
                </p>

                <p className="mt-2 text-2xl font-semibold text-white/90">
                  {
                    strongestDay?.name ??
                    "—"
                  }
                </p>

                <p className="mt-1.5 text-sm text-white/35">
                  {strongestDay
                    ? `Avg. Daily Score ${strongestDay.average}`
                    : "Not enough data yet"}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/35">
                  Most reliable habit
                </p>

                <p className="mt-2 truncate text-2xl font-semibold text-white/90">
                  {
                    mostReliableHabit?.name ??
                    "—"
                  }
                </p>

                <p className="mt-1.5 text-sm text-white/35">
                  {mostReliableHabit
                    ? `${mostReliableHabit.completed} of ${mostReliableHabit.expected} check-ins · ${mostReliableHabit.completionRate}%`
                    : "Not enough habit data yet"}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/35">
                  Biggest improvement
                </p>

                <p className="mt-2 text-2xl font-semibold text-white/90">
                  {biggestImprovement.category ===
                  "Neither"
                    ? "No clear gain"
                    : biggestImprovement.category}
                </p>

                <p
                  className={`mt-1.5 text-sm font-medium ${
                    biggestImprovement.difference >
                    0
                      ? "text-[#8199FF]"
                      : "text-white/35"
                  }`}
                >
                  {biggestImprovement.category ===
                    "Neither"
                    ? biggestImprovement.difference ===
                      0
                      ? "Not enough comparison data"
                      : "No improvement over prior 14 days"
                    : `↑ ${biggestImprovement.difference} points vs prior 14 days`}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/35">
                  Weakest day
                </p>

                <p className="mt-2 text-2xl font-semibold text-white/90">
                  {
                    weakestDay?.name ??
                    "—"
                  }
                </p>

                <p className="mt-1.5 text-sm text-white/35">
                  {weakestDay
                    ? `Avg. Daily Score ${weakestDay.average}`
                    : "Not enough data yet"}
                </p>
              </div>
            </div>
          </div>

          {/* COMPLETION */}

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
              Completion
            </p>

            <h3 className="mt-1 text-lg font-medium">
              This week
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/65">
                      Tasks
                    </p>

                    <p className="mt-1 text-xs text-white/30">
                      {completedWeekTasks} of{" "}
                      {totalWeekTasks} completed
                    </p>
                  </div>

                  <span className="text-xl font-semibold">
                    {
                      taskCompletionPercent
                    }
                    %
                  </span>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#5B7CFF] transition-[width] duration-500 ease-out"

                    style={{
                      width:
                        `${clampPercent(
                          taskCompletionPercent
                        )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/65">
                      Habits
                    </p>

                    <p className="mt-1 text-xs text-white/30">
                      {completedHabitCheckIns} of{" "}
                      {totalHabitCheckIns} check-ins
                    </p>
                  </div>

                  <span className="text-xl font-semibold">
                    {
                      habitCompletionPercent
                    }
                    %
                  </span>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#5B7CFF] transition-[width] duration-500 ease-out"

                    style={{
                      width:
                        `${clampPercent(
                          habitCompletionPercent
                        )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <p className="text-xs text-white/30">
                Current calendar week
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            scrollToSection(
              "consistency"
            )
          }

          className="mx-auto mt-4 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/25 transition hover:bg-white/[0.03] hover:text-white/45"
        >
          <span>
            Consistency
          </span>

          <svg
            width="11"
            height="11"
            viewBox="0 0 10 10"
            fill="none"
          >
            <path
              d="M2 3.5L5 6.5L8 3.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </section>

      {/* ======================================================
       * CONSISTENCY
       * ====================================================== */}

      <section
        ref={
          consistencyRef
        }

        className="
          flex
          h-screen
          shrink-0
          flex-col
          overflow-hidden
          px-10
          py-5
        "
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/35">
              How reliably you&apos;re showing up
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-[-0.025em]">
              Consistency
            </h2>
          </div>

          <button
            onClick={() =>
              scrollToSection(
                "overview"
              )
            }

            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/25 transition hover:bg-white/[0.03] hover:text-white/50"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path
                d="M2 6.5L5 3.5L8 6.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            Overview
          </button>
        </div>

        {/* DAYS ON TRACK */}

        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
                Days on track
              </p>

              <h3 className="mt-1 text-xl font-medium">
                This week
              </h3>

              <p className="mt-1.5 text-sm text-white/35">
                How consistently you followed through on what you planned.
              </p>
            </div>

            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-3xl font-semibold">
                  {
                    onTrackDays
                  }
                </span>

                <span className="text-sm text-white/30">
                  /{" "}
                  {
                    plannedDayCount
                  }{" "}
                  {plannedDayCount ===
                  1
                    ? "day"
                    : "days"}
                </span>
              </div>

              <p className="mt-1.5 text-xs text-white/25">
                Current week
              </p>
            </div>
          </div>

          <div className="relative mt-5">
            <div className="absolute left-[7%] right-[7%] top-[45px] h-px bg-white/[0.07]" />

            <div className="relative grid grid-cols-7">
              {consistencyData.map(
                (
                  item
                ) => {
                  const style =
                    getConsistencyStyle(
                      item.state
                    );

                  const isHovered =
                    hoveredDay?.dateKey ===
                    item.dateKey;

                  const canHover =
                    item.state !==
                      "future";

                  return (
                    <div
                      key={
                        item.dateKey
                      }

                      className="relative flex flex-col items-center"
                    >
                      <p className="text-xs font-medium text-white/35">
                        {
                          item.shortDay
                        }
                      </p>

                      <button
                        type="button"

                        onMouseEnter={() => {
                          if (
                            canHover
                          ) {
                            setHoveredDay(
                              item
                            );
                          }
                        }}

                        onMouseLeave={() =>
                          setHoveredDay(
                            null
                          )
                        }

                        className={`relative z-10 mt-3 flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 ${style.outer} ${
                          canHover
                            ? "cursor-default hover:scale-110 hover:border-[#5B7CFF]/60"
                            : "cursor-default"
                        }`}
                      >
                        <div
                          className={`rounded-full ${
                            item.state ===
                            "empty"
                              ? "h-1.5 w-1.5 bg-white/15"
                              : `h-3 w-3 ${style.inner}`
                          }`}
                        />
                      </button>

                      <p
                        className={`mt-3 text-xs ${style.text}`}
                      >
                        {
                          style.label
                        }
                      </p>

                      {isHovered &&
                        item.state !==
                          "future" && (
                          <div className="absolute bottom-[74px] left-1/2 z-30 w-[205px] -translate-x-1/2 rounded-xl border border-white/[0.1] bg-[#171A26] p-4 shadow-2xl shadow-black/40">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/25">
                                  {
                                    item.day
                                  }
                                </p>

                                <p className="mt-1 text-sm font-medium text-white/80">
                                  {
                                    style.label
                                  }
                                </p>
                              </div>

                              <div
                                className={`mt-1 rounded-full ${
                                  item.state ===
                                  "empty"
                                    ? "h-2 w-2 bg-white/15"
                                    : `h-2.5 w-2.5 ${style.inner}`
                                }`}
                              />
                            </div>

                            <div className="mt-4 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white/35">
                                  Tasks
                                </span>

                                <span className="text-xs font-medium text-white/70">
                                  {
                                    item.tasksTotal >
                                    0
                                      ? `${item.tasksCompleted} / ${item.tasksTotal}`
                                      : "—"
                                  }
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white/35">
                                  Habits
                                </span>

                                <span className="text-xs font-medium text-white/70">
                                  {
                                    item.habitsTotal >
                                    0
                                      ? `${item.habitsCompleted} / ${item.habitsTotal}`
                                      : "—"
                                  }
                                </span>
                              </div>

                              {item.completionPercent !==
                                null && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-white/35">
                                    Follow-through
                                  </span>

                                  <span className="text-xs font-medium text-white/70">
                                    {
                                      item.completionPercent
                                    }
                                    %
                                  </span>
                                </div>
                              )}

                              <div className="border-t border-white/[0.06] pt-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-white/35">
                                    Daily Score
                                  </span>

                                  <span
                                    className={`text-sm font-semibold ${
                                      item.dailyScore ===
                                      null
                                        ? "text-white/25"
                                        : "text-white"
                                    }`}
                                  >
                                    {
                                      item.dailyScore ??
                                      "—"
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/[0.08] bg-[#171A26]" />
                          </div>
                        )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* TASKS VS HABITS + 4-WEEK CONSISTENCY */}

        <div className="mt-4 grid grid-cols-[1.35fr_0.65fr] gap-5">
          {/* TASKS VS HABITS */}

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
                  Tasks vs habits
                </p>

                <h3 className="mt-1 text-lg font-medium">
                  What shaped each day
                </h3>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-[3px] bg-white/45" />

                  <span className="text-[10px] text-white/30">
                    Tasks
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-[3px] bg-[#5B7CFF]" />

                  <span className="text-[10px] text-white/30">
                    Habits
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mt-4 h-[140px]">
              <div className="absolute inset-0 flex flex-col justify-between pb-6">
                {[
                  "100",
                  "75",
                  "50",
                  "25",
                  "0",
                ].map(
                  (
                    value
                  ) => (
                    <div
                      key={
                        value
                      }

                      className="flex items-center gap-3"
                    >
                      <span className="w-6 text-[9px] text-white/15">
                        {
                          value
                        }
                      </span>

                      <div className="h-px flex-1 bg-white/[0.04]" />
                    </div>
                  )
                )}
              </div>

              <div className="absolute bottom-6 left-9 right-0 top-0 grid grid-cols-7 gap-4">
                {balanceData.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.dateKey
                      }

                      className="group relative flex min-w-0 flex-col items-center justify-end"
                    >
                      {!item.future &&
                        (item.tasks !==
                          null ||
                          item.habits !==
                            null) && (
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 hidden w-[160px] -translate-x-1/2 rounded-xl border border-white/[0.1] bg-[#171A26] p-3 shadow-xl shadow-black/30 group-hover:block">
                            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">
                              {
                                item.day
                              }
                            </p>

                            <div className="mt-2.5 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white/35">
                                  Tasks
                                </span>

                                <span className="text-xs font-medium text-white/70">
                                  {
                                    item.tasksTotal >
                                    0
                                      ? `${item.tasksCompleted} / ${item.tasksTotal}`
                                      : "—"
                                  }
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white/35">
                                  Habits
                                </span>

                                <span className="text-xs font-medium text-white/70">
                                  {
                                    item.habitsTotal >
                                    0
                                      ? `${item.habitsCompleted} / ${item.habitsTotal}`
                                      : "—"
                                  }
                                </span>
                              </div>
                            </div>

                            <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/[0.08] bg-[#171A26]" />
                          </div>
                        )}

                      <div className="flex h-full items-end justify-center gap-1.5">
                        {item.tasks !==
                        null ? (
                          <div
                            className="w-3 rounded-t-[4px] bg-white/45 transition-[height,opacity] duration-500 ease-out group-hover:bg-white/60"

                            style={{
                              height:
                                `${item.tasks}%`,
                            }}
                          />
                        ) : (
                          <div className="w-3" />
                        )}

                        {item.habits !==
                        null ? (
                          <div
                            className="w-3 rounded-t-[4px] bg-[#5B7CFF] transition-[height,opacity] duration-500 ease-out group-hover:bg-[#7894FF]"

                            style={{
                              height:
                                `${item.habits}%`,
                            }}
                          />
                        ) : (
                          <div className="w-3" />
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="absolute bottom-0 left-9 right-0 grid grid-cols-7 gap-4">
                {balanceData.map(
                  (
                    item
                  ) => (
                    <p
                      key={
                        item.dateKey
                      }

                      className={`text-center text-[10px] ${
                        item.future
                          ? "text-white/10"
                          : "text-white/25"
                      }`}
                    >
                      {
                        item.day
                      }
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="text-xs text-white/35">
                {
                  balanceSummary
                }
              </p>
            </div>
          </div>

          {/* 4 WEEK CONSISTENCY */}

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
              Consistency
            </p>

            <h3 className="mt-1 text-lg font-medium">
              Last 4 weeks
            </h3>

            <div className="mt-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold">
                  {
                    last28OnTrack
                  }
                </span>

                <span className="text-sm text-white/30">
                  /{" "}
                  {
                    last28PlannedDays.length
                  }
                </span>
              </div>

              <p className="mt-1.5 text-xs text-white/30">
                planned days on track
              </p>

              {previous28PlannedDays.length >
              0 ? (
                <p
                  className={`mt-2 text-xs font-medium ${
                    consistencyDifference >
                    0
                      ? "text-[#8199FF]"
                      : "text-white/35"
                  }`}
                >
                  {consistencyDifference >
                  0
                    ? `↑ ${consistencyDifference} vs previous 4 weeks`
                    : consistencyDifference <
                        0
                      ? `↓ ${Math.abs(
                          consistencyDifference
                        )} vs previous 4 weeks`
                      : "Same as previous 4 weeks"}
                </p>
              ) : (
                <p className="mt-2 text-xs text-white/25">
                  No earlier comparison yet
                </p>
              )}
            </div>

            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/50">
                    Current streak
                  </p>

                  <p className="mt-1 text-[10px] text-white/25">
                    Consecutive on-track days
                  </p>
                </div>

                <p className="text-lg font-semibold">
                  {
                    currentStreak
                  }{" "}
                  <span className="text-xs font-normal text-white/30">
                    {currentStreak ===
                    1
                      ? "day"
                      : "days"}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-white/[0.06] pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/50">
                    Best streak
                  </p>

                  <p className="mt-1 text-[10px] text-white/25">
                    Last 4 weeks
                  </p>
                </div>

                <p className="text-lg font-semibold">
                  {
                    bestStreak
                  }{" "}
                  <span className="text-xs font-normal text-white/30">
                    {bestStreak ===
                    1
                      ? "day"
                      : "days"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================
         * REAL ATLAS INSIGHT V1
         * ====================================================== */}

        <div className="mt-4 rounded-2xl border border-[#5B7CFF]/12 bg-[#5B7CFF]/[0.025] px-5 py-4">
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#5B7CFF]/15 bg-[#5B7CFF]/10 text-[#8EA4FF]">
              <svg
                width="16"
                height="16"
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

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8EA4FF]/70">
                  Atlas insight
                </p>

                <span className="text-[10px] text-white/20">
                  {
                    atlasInsight.period
                  }
                </span>
              </div>

              <p className="mt-2 text-sm font-medium text-white/80">
                {
                  atlasInsight.title
                }
              </p>

              <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-white/35">
                {
                  atlasInsight.body
                }
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}