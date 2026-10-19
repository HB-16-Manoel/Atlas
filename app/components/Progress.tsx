"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  Habit,
  Task,
} from "./Planning";

import { calculateDailyScore } from "../lib/dailyScore";
import Goals from "./Goals";

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

  const goalsRef =
    useRef<HTMLElement | null>(
      null
    );

  const [analyticsOverflows, setAnalyticsOverflows] = useState(true);

  useEffect(() => {
    const container = scrollRef.current;
    const analytics = overviewRef.current;
    if (!container || !analytics) return;
    const observer = new ResizeObserver(() => {
      // Native snapping can skip the tail of an oversized section. Use ordinary
      // scrolling whenever Analytics needs more than one available viewport.
      setAnalyticsOverflows(analytics.scrollHeight > container.clientHeight + 1);
    });
    observer.observe(container);
    observer.observe(analytics);
    return () => observer.disconnect();
  }, []);

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

  const selectedTrendPoint =
    hoveredTrendKey
      ? trendData.find(
          (
            point
          ) =>
            point.key ===
            hoveredTrendKey &&
            point.score !==
              null
        ) ?? null
      : null;

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

  const scrollToSection = (
    section:
      | "overview"
      | "goals"
  ) => {
    const container =
      scrollRef.current;

    const target =
      section ===
      "overview"
        ? overviewRef.current
        : goalsRef.current;

    if (
      !container ||
      !target
    ) {
      return;
    }

    if (
      window.matchMedia(
        "(max-width: 767px)"
      ).matches
    ) {
      target.scrollIntoView({
        behavior:
          "smooth",
        block:
          "start",
      });

      return;
    }

    container.scrollTo({
      top:
        target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop,

      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  /* ============================================================
   * UI
   * ============================================================
   */

  return (
    <div
      data-progress-scroll
      data-analytics-overflow={analyticsOverflows}
      role="region"
      aria-label="Progress sections"
      tabIndex={0}
      ref={
        scrollRef
      }

      className="
        min-w-0
        md:relative
        md:h-full
        md:min-h-0
        md:snap-y
        md:snap-proximity
        md:data-[analytics-overflow=true]:snap-none
        motion-reduce:scroll-auto
        md:scroll-smooth
        md:overflow-y-auto
        md:overscroll-contain
        md:scroll-py-5
        md:[scrollbar-gutter:stable]
        focus-visible:outline focus-visible:outline-[#5B7CFF]/50
      "
    >
      {/* ======================================================
       * PERFORMANCE
       * ====================================================== */}

      <section
        data-progress-section="analytics"
        ref={
          overviewRef
        }

        className="
          flex
          flex-col
          md:min-h-full
          md:snap-start
          md:px-10
          md:pt-5
          md:pb-8
        "
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-0">
          <div>
            <p className="text-sm text-white/35">
              Your performance over time
            </p>

            <h2 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.025em] md:text-3xl">
              Analytics
            </h2>
          </div>

          <nav aria-label="Progress sections" className="flex gap-2 md:hidden">
            <button type="button" onClick={() => scrollToSection("overview")} className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white/70">Analytics</button>
            <button type="button" onClick={() => scrollToSection("goals")} className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white/70">Goals</button>
          </nav>
          <div className="grid w-full grid-cols-4 items-center rounded-xl border border-white/[0.07] bg-white/[0.025] p-1 md:flex md:w-auto">
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
                    {
                      setActivePeriod(
                        period as ProgressPeriod
                      );
                      setHoveredTrendKey(
                        null
                      );
                    }
                  }

                  className={`min-h-10 rounded-lg px-1.5 py-2 text-[11px] font-medium transition-all duration-200 md:min-h-0 md:px-3.5 md:py-1.5 md:text-xs ${
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

        <div className="mt-4 min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 pb-4 pt-4 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
                Overall progress
              </p>

              <div className="mt-2.5 flex items-end gap-3">
                <span className="text-4xl font-semibold tracking-[-0.045em] md:text-5xl">
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

            <div className="shrink-0 text-right">
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

          <div className="relative mt-4 h-[165px] md:h-[180px]">
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
                    <button
                      type="button"
                      key={
                        point.key
                      }

                      aria-label={
                        point.score ===
                        null
                          ? `${point.fullLabel}: no score`
                          : `${point.fullLabel}: Daily Score ${point.score}`
                      }

                      onClick={() =>
                        point.score !==
                        null &&
                        setHoveredTrendKey(
                          hoveredTrendKey ===
                            point.key
                            ? null
                            : point.key
                        )
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

                      className="group relative flex-1 focus-visible:outline-none"
                    >
                      {hoveredTrendKey ===
                        point.key &&
                        point.score !==
                          null && (
                          <div className="pointer-events-none absolute left-1/2 top-2 z-20 hidden w-max -translate-x-1/2 rounded-lg border border-white/[0.1] bg-[#171A26] px-3 py-2 shadow-xl shadow-black/30 md:block">
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
                    </button>
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

          {selectedTrendPoint && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 md:hidden">
              <span className="text-xs text-white/40">
                {
                  selectedTrendPoint.fullLabel
                }
              </span>

              <span className="text-sm font-semibold text-white">
                Daily Score {selectedTrendPoint.score}
              </span>
            </div>
          )}
        </div>

        {/* PATTERNS + COMPLETION */}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/30">
                  Patterns
                </p>

                <h3 className="mt-1 text-lg font-medium md:text-xl">
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

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 md:gap-x-8 md:gap-y-4">
              <div>
                <p className="text-sm text-white/35">
                  Strongest day
                </p>

                <p className="mt-2 text-xl font-semibold text-white/90 md:text-2xl">
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

                <p className="mt-2 break-words text-xl font-semibold text-white/90 md:truncate md:text-2xl">
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

                <p className="mt-2 text-xl font-semibold text-white/90 md:text-2xl">
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

                <p className="mt-2 text-xl font-semibold text-white/90 md:text-2xl">
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

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30 md:text-white/45">
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

                    <p className="mt-1 text-xs text-white/30 md:text-white/45">
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

                    <p className="mt-1 text-xs text-white/30 md:text-white/45">
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
              <p className="text-xs text-white/30 md:text-white/45">
                Current calendar week
              </p>
            </div>
          </div>
          <div data-consistency-card className="hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 md:block md:col-span-2">
            <div className="flex items-start gap-6">
            <div className="w-36 shrink-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Consistency</p>
              <h3 className="mt-1 text-lg font-medium">Showing up</h3>
            </div>
            <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
              <div><dt className="text-xs text-white/55">On track · this week</dt><dd className="mt-2 text-xl font-semibold">{onTrackDays}<span className="ml-1 text-xs font-normal text-white/50">/ {plannedDayCount}</span></dd></div>
              <div><dt className="text-xs text-white/55">Last 4 weeks</dt><dd className="mt-2 text-xl font-semibold">{last28OnTrack}<span className="ml-1 text-xs font-normal text-white/50">/ {last28PlannedDays.length}</span></dd></div>
              <div><dt className="text-xs text-white/55">Current streak</dt><dd className="mt-2 text-xl font-semibold">{currentStreak}<span className="ml-1 text-xs font-normal text-white/50">days</span></dd></div>
              <div><dt className="text-xs text-white/55">Best · 4 weeks</dt><dd className="mt-2 text-xl font-semibold">{bestStreak}<span className="ml-1 text-xs font-normal text-white/50">days</span></dd></div>
            </dl>
            </div>
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-white/45">{previous28PlannedDays.length ? (consistencyDifference > 0 ? `↑ ${consistencyDifference} days vs previous 4 weeks` : consistencyDifference < 0 ? `↓ ${Math.abs(consistencyDifference)} days vs previous 4 weeks` : "Same as previous 4 weeks") : "No earlier comparison yet"}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:hidden gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm md:grid-cols-4 md:gap-4">
          <div><p className="text-xs text-white/35">Days on track · this week</p><p className="mt-1 text-lg font-semibold">{onTrackDays} <span className="text-xs font-normal text-white/35">/ {plannedDayCount}</span></p></div>
          <div><p className="text-xs text-white/35">Last 4 weeks</p><p className="mt-1 text-lg font-semibold">{last28OnTrack} <span className="text-xs font-normal text-white/35">/ {last28PlannedDays.length} planned</span></p></div>
          <div><p className="text-xs text-white/35">Current streak</p><p className="mt-1 text-lg font-semibold">{currentStreak} <span className="text-xs font-normal text-white/35">days</span></p></div>
          <div><p className="text-xs text-white/35">Best streak · 4 weeks</p><p className="mt-1 text-lg font-semibold">{bestStreak} <span className="text-xs font-normal text-white/35">days</span></p></div>
          <p className="col-span-2 text-xs text-white/30 md:col-span-4">{previous28PlannedDays.length ? (consistencyDifference > 0 ? `↑ ${consistencyDifference} days vs previous 4 weeks` : consistencyDifference < 0 ? `↓ ${Math.abs(consistencyDifference)} days vs previous 4 weeks` : "Same as previous 4 weeks") : "No earlier comparison yet"}</p>
        </div>
        {/* ======================================================
         * REAL ATLAS INSIGHT V1
         * ====================================================== */}

        <div data-atlas-insight className="mt-4 rounded-2xl border border-[#5B7CFF]/12 bg-[#5B7CFF]/[0.025] px-4 py-4 md:mt-4 md:px-5 md:py-4">
          <div className="flex items-start gap-3 md:gap-4">
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
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8EA4FF]/70">
                  Atlas insight
                </p>

                <span className="text-[10px] text-white/20 md:text-white/45">
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

              <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-white/35 md:text-white/50">
                {
                  atlasInsight.body
                }
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            scrollToSection(
              "goals"
            )
          }

          className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/35 transition hover:bg-white/[0.03] hover:text-white/45 md:mt-4 md:min-h-0 md:py-1.5 md:text-white/25"
        >
          <span>
            Goals
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

      <section data-progress-section="goals" ref={goalsRef} className="scroll-mt-4 pt-8 md:min-h-full md:snap-start md:px-10 md:py-6">
        <Goals tasks={tasks} habits={habits} onAnalytics={() => scrollToSection("overview")} />
      </section>
    </div>
  );
}
