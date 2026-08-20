export function calculateDailyScore(
  taskCompleted: number,
  taskTotal: number,
  habitCompleted: number,
  habitTotal: number
): number | null {
  const hasTasks =
    taskTotal > 0;

  const hasHabits =
    habitTotal > 0;

  if (
    !hasTasks &&
    !hasHabits
  ) {
    return null;
  }

  const taskPercent =
    hasTasks
      ? taskCompleted /
        taskTotal
      : null;

  const habitPercent =
    hasHabits
      ? habitCompleted /
        habitTotal
      : null;

  if (
    hasTasks &&
    hasHabits
  ) {
    return Math.round(
      (
        taskPercent! *
          0.6 +
        habitPercent! *
          0.4
      ) *
        100
    );
  }

  if (
    hasTasks
  ) {
    return Math.round(
      taskPercent! *
        100
    );
  }

  return Math.round(
    habitPercent! *
      100
  );
}