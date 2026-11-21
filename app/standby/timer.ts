export type Mode = "countdown" | "stopwatch" | "pomodoro";

export type Timer = {
  mode: Mode;
  phase: "work" | "break";
  countdown: number;
  work: number;
  break: number;
  elapsed: number;
  started: number | null;
  finished: boolean;
};

export const initialTimer: Timer = {
  mode: "countdown",
  phase: "work",
  countdown: 25,
  work: 25,
  break: 5,
  elapsed: 0,
  started: null,
  finished: false,
};

export function elapsedAt(timer: Timer, now: number) {
  return timer.elapsed + (timer.started === null ? 0 : Math.max(0, now - timer.started));
}

export function duration(timer: Timer) {
  return 60_000 * (timer.mode === "pomodoro" ? timer[timer.phase] : timer.countdown);
}

// Finish once, even after hours away. A break or work session starts only on request.
export function recover(timer: Timer, now: number): Timer {
  if (timer.mode === "stopwatch" || timer.started === null || elapsedAt(timer, now) < duration(timer)) {
    return timer;
  }
  if (timer.mode === "pomodoro") {
    return { ...timer, phase: timer.phase === "work" ? "break" : "work", started: null, elapsed: 0, finished: true };
  }
  return { ...timer, elapsed: duration(timer), started: null, finished: true };
}

export function toggleTimer(timer: Timer, now: number): Timer {
  const current = recover(timer, now);
  if (current !== timer) return current;
  if (current.started !== null) {
    return { ...current, elapsed: elapsedAt(current, now), started: null };
  }
  return {
    ...current,
    started: now,
    finished: false,
    elapsed: current.finished ? 0 : current.elapsed,
  };
}
