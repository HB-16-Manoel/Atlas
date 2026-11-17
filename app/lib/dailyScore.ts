export function calculateDailyScore(
  taskCompleted: number,
  taskTotal: number,
  habitCompleted: number,
  habitTotal: number
): number | null {
  const planned = taskTotal + habitTotal;
  if (planned === 0) return null;

  const completed = Math.min(
    planned,
    Math.min(taskTotal, Math.max(0, taskCompleted)) +
      Math.min(habitTotal, Math.max(0, habitCompleted))
  );
  return completed === planned
    ? 100
    : Math.min(99, Math.round((completed / planned) * 100));
}
