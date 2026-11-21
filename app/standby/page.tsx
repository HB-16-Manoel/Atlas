"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import Settings from "../components/Settings";
import type { Task } from "../components/Planning";
import { useAtlasData } from "../hooks/useAtlasData";
import { calculateDailyScore } from "../lib/dailyScore";
import { getUpcomingEvents, localDateKey } from "../lib/upcomingEvents";
import { duration, elapsedAt, initialTimer, recover, toggleTimer, type Mode, type Timer } from "./timer";
import styles from "./standby.module.css";

type Section = "Dashboard" | "Focus" | "Developer" | "Settings";
type View = "Standard" | "Immersive" | "Workspace";

function readLocal<T,>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function Digital({ timer }: { timer: Timer }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (timer.started === null) return;
    const tick = () => setNow(Math.floor(Date.now() / 1000) * 1000);
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timer.started]);

  const elapsed = elapsedAt(timer, Math.max(now, timer.started ?? 0));
  const seconds = timer.mode === "stopwatch"
    ? Math.floor(elapsed / 1000)
    : Math.ceil(Math.max(0, duration(timer) - elapsed) / 1000);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  return <div role="timer" aria-live="off" className={styles.digital}>
    {minutes}:{String(seconds % 60).padStart(2, "0")}
  </div>;
}

// Every face receives the same timer state. Digital is the only V1 face.
const faces = { digital: Digital };
const TimerFace = faces.digital;

function Minutes({ label, value, disabled, onChange }: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return <label className={styles.field}>
    {label}
    <input type="number" min={1} max={180} key={value} defaultValue={value} disabled={disabled}
      onBlur={(event) => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isInteger(next) && next >= 1 && next <= 180) {
          if (next !== value) onChange(next);
        }
        else event.currentTarget.value = String(value);
      }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
  </label>;
}

function Focus({ timer, save, tasks, linked, link, notes, saveNotes }: {
  timer: Timer;
  save: (timer: Timer) => void;
  tasks: Task[];
  linked: string;
  link: (id: string) => void;
  notes: string;
  saveNotes: (value: string) => void;
}) {
  const [view, setView] = useState<View>("Standard");
  const [revealed, setRevealed] = useState(false);
  const running = timer.started !== null;
  const reset = { ...timer, started: null, elapsed: 0, phase: "work" as const, finished: false };
  const immersive = view === "Immersive";
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (immersive) dialog.current?.showModal();
  }, [immersive]);
  const taskOptions = tasks.filter((task) => task.cloudId === linked || !task.completed);
  const linkedTask = tasks.find((task) => task.cloudId === linked);

  const content = <>
    {immersive ? <div className={styles.actions}>
      <button onClick={() => setView("Standard")}>Exit immersive</button>
      <button aria-expanded={revealed} aria-controls="standby-timer-controls"
        onClick={() => setRevealed(!revealed)}>{revealed ? "Hide controls" : "Show controls"}</button>
    </div> : <div className={styles.actions} aria-label="Timer view">
      {(["Standard", "Immersive", "Workspace"] as const).map((option) =>
        <button key={option} aria-pressed={view === option} onClick={() => {
          setView(option);
          setRevealed(false);
        }}>{option}</button>)}
    </div>}
    <div className={styles.focusGrid}>
      <div className={styles.panel}>
        <p className={styles.eyebrow}>
          {timer.mode === "pomodoro" ? `Pomodoro · ${timer.phase === "work" ? "Work" : "Break"}` : timer.mode}
        </p>
        <TimerFace timer={timer} />
        <p role="status" className={styles.muted}>
          {timer.finished
            ? timer.mode === "pomodoro" ? "Previous phase finished. Start when ready." : "Countdown finished."
            : running ? "Running" : timer.elapsed ? "Paused" : "Ready"}
        </p>
        {linkedTask && <p className={styles.linked}>{linkedTask.text}</p>}
        <div id="standby-timer-controls" hidden={immersive && !revealed}>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={() => save(toggleTimer(timer, Date.now()))}>
              {running ? "Pause" : timer.elapsed && !timer.finished ? "Resume" : "Start"}
            </button>
            <button onClick={() => save(reset)}>Reset</button>
          </div>
          {!immersive && <>
            <div className={styles.actions} aria-label="Timer mode">
              {(["countdown", "stopwatch", "pomodoro"] as const).map((mode: Mode) =>
                <button key={mode} aria-pressed={timer.mode === mode}
                  onClick={() => { if (mode !== timer.mode) save({ ...reset, mode }); }}>
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>)}
            </div>
            {timer.mode === "countdown" && <div className={styles.actions}>
              <Minutes label="Minutes" value={timer.countdown} disabled={running}
                onChange={(countdown) => save({ ...reset, countdown })} />
              {[5, 15, 25, 50].map((countdown) => <button key={countdown} disabled={running}
                onClick={() => save({ ...reset, countdown })}>{countdown} min</button>)}
            </div>}
            {timer.mode === "pomodoro" && <div className={styles.actions}>
              <Minutes label="Work minutes" value={timer.work} disabled={running}
                onChange={(work) => save({ ...reset, work })} />
              <Minutes label="Break minutes" value={timer.break} disabled={running}
                onChange={(breakMinutes) => save({ ...reset, break: breakMinutes })} />
            </div>}
            <label className={styles.field}>Linked task
              <select value={linkedTask ? linked : ""} onChange={(event) => link(event.target.value)}>
                <option value="">No linked task</option>
                {taskOptions.filter((task) => task.cloudId).map((task) =>
                  <option key={task.cloudId} value={task.cloudId}>{task.text}</option>)}
              </select>
            </label>
          </>}
        </div>
      </div>
      {view === "Workspace" && <label className={styles.panel}>
        <strong>Workspace notes</strong>
        <span className={styles.muted}> Temporary draft saved on this device.</span>
        <textarea className={styles.notes} value={notes} maxLength={20000}
          onChange={(event) => saveNotes(event.target.value)} />
      </label>}
    </div>
  </>;
  return immersive
    ? <dialog ref={dialog} className={styles.immersive} aria-label="Immersive focus timer"
        onCancel={(event) => { event.preventDefault(); setView("Standard"); }}>{content}</dialog>
    : <section className={styles.focus} aria-label="Focus timer">{content}</section>;
}

const projects = [
  { name: "Atlas", description: "Plan tasks, track habits, and review personal progress.", href: "/" },
  { name: "Monte", description: "A project in Henrique’s workspace." },
  { name: "Scribble", description: "A project in Henrique’s workspace." },
  { name: "School Portal", description: "Henrique’s school portal." },
];

function AccountWorkspace({ accountId }: { accountId: string }) {
  const data = useAtlasData();
  const key = `atlas-standby-v1:${accountId}`;
  const [section, setSection] = useState<Section>("Dashboard");
  const [timer, setTimer] = useState(() => recover(readLocal(`${key}:timer`, initialTimer) ?? initialTimer, Date.now()));
  const [notes, setNotes] = useState(() => readLocal(`${key}:notes`, ""));
  const [linked, setLinked] = useState(() => readLocal(`${key}:task`, ""));
  const [storageError, setStorageError] = useState(false);
  const [todayKey, setTodayKey] = useState(() => localDateKey(new Date()));

  useEffect(() => {
    const refresh = () => setTodayKey(localDateKey(new Date()));
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (timer.started === null || timer.mode === "stopwatch") return;
    let timeout: number;
    const check = () => {
      window.clearTimeout(timeout);
      const now = Date.now();
      const next = recover(timer, now);
      if (next !== timer) {
        setTimer(next);
        if (!writeLocal(`${key}:timer`, next)) setStorageError(true);
      } else {
        timeout = window.setTimeout(check, Math.max(1, duration(timer) - elapsedAt(timer, now)));
      }
    };
    timeout = window.setTimeout(check, Math.max(1, duration(timer) - elapsedAt(timer, Date.now())));
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", check);
    };
  }, [key, timer]);

  function saveTimer(next: Timer) {
    setTimer(next);
    if (!writeLocal(`${key}:timer`, next)) setStorageError(true);
  }

  const ready = data.dataSource === "cloud";
  const tasks = ready ? data.tasks.filter((task) => task.date === todayKey).sort((a, b) =>
    Number(a.completed) - Number(b.completed) || a.order - b.order) : [];
  const habits = ready ? data.habits.filter((habit) => habit.createdAt <= todayKey).sort((a, b) => a.order - b.order) : [];
  const events = ready ? getUpcomingEvents(data.events, new Date(`${todayKey}T00:00:00`)) : [];
  const score = calculateDailyScore(tasks.filter((task) => task.completed).length, tasks.length,
    habits.filter((habit) => habit.completedDates.includes(todayKey)).length, habits.length);

  return <div className={styles.shell}>
    <nav className={styles.rail} aria-label="Standby">
      <div className={styles.brand}>
        <Image src="/atlas-icon-512.png" alt="" width={32} height={32} />
        <div><strong>ATLAS</strong><span>Standby</span></div>
      </div>
      {(["Dashboard", "Focus", "Developer", "Settings"] as const).map((item) =>
        <button key={item} aria-current={section === item ? "page" : undefined}
          onClick={() => setSection(item)}>{item}</button>)}
    </nav>
    <main className={styles.main}>
      <header className={styles.header}><h1>{section}</h1>
        <time dateTime={todayKey}>{new Date(`${todayKey}T00:00:00`).toLocaleDateString(undefined, {
          weekday: "long", month: "short", day: "numeric",
        })}</time>
      </header>
      {storageError && <p role="alert">Device storage is unavailable. Recent timer or draft changes may be lost on reload.</p>}
      {data.dataLoading && <p role="status">Loading Atlas account data…</p>}
      {(data.dataError || data.syncStatus === "error" || data.syncStatus === "conflict") &&
        <div role="alert" className={styles.actions}>
          <p>{data.dataError || data.syncMessage || "Atlas could not sync."}</p>
          <button onClick={data.retry}>Reload cloud data</button>
        </div>}
      {section === "Dashboard" && <>
        <div className={styles.summary}>
          <div className={styles.panel}><p className={styles.eyebrow}>Daily Score</p>
            <strong className={styles.score}>{score ?? "—"}</strong><span className={styles.muted}> / 100</span>
            {score !== null && <progress className={styles.progress} max={100} value={score} aria-label="Daily Score" />}
          </div>
          <button className={styles.timerCard} onClick={() => setSection("Focus")} aria-label="Open Focus">
            <span className={styles.eyebrow}>Focus · {timer.mode === "pomodoro" ? timer.phase : timer.mode}</span>
            <TimerFace timer={timer} />
            <span aria-hidden="true" className={styles.timerArrow}>↗</span>
          </button>
        </div>
        {ready && <div className={styles.dashboard}>
          <div className={styles.stack}>
          <section className={styles.panel}><h2>Today’s tasks</h2>
            {tasks.length === 0 && <p className={styles.muted}>No tasks planned.</p>}
            {tasks.map((task) => <label key={task.id} className={styles.check}>
              <input type="checkbox" checked={task.completed} onChange={() => data.setTasks((items) =>
                items.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))} />
              <span>{task.text}</span>
            </label>)}
          </section>
            <section className={styles.panel}><h2>Upcoming events</h2>
              {events.length === 0 && <p className={styles.muted}>No events in the next 60 days.</p>}
              {events.map(({ date, event }) => <div key={event.id} className={styles.event}>
                <span>{event.title}</span>
                <time dateTime={event.time ? `${date}T${event.time}` : date}>
                  {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {event.time && ` · ${event.time}`}
                </time>
              </div>)}
            </section>
          </div>
          <div className={styles.stack}>
            <section className={styles.panel}><h2>Today’s habits</h2>
              {habits.length === 0 && <p className={styles.muted}>No active habits.</p>}
              {habits.map((habit) => <label key={habit.id} className={styles.check}>
                <input type="checkbox" checked={habit.completedDates.includes(todayKey)}
                  onChange={() => data.setHabits((items) => items.map((item) => item.id !== habit.id ? item : {
                    ...item,
                    completedDates: item.completedDates.includes(todayKey)
                      ? item.completedDates.filter((date) => date !== todayKey)
                      : [...item.completedDates, todayKey],
                  }))} />
                <span>{habit.name}</span>
              </label>)}
            </section>

          </div>
        </div>}
      </>}
      {section === "Focus" && <Focus timer={timer} save={saveTimer}
        tasks={ready ? data.tasks : []} linked={linked}
        link={(value) => {
          setLinked(value);
          if (!writeLocal(`${key}:task`, value)) setStorageError(true);
        }}
        notes={notes} saveNotes={(value) => {
          setNotes(value);
          if (!writeLocal(`${key}:notes`, value)) setStorageError(true);
        }} />}
      {section === "Developer" && <div className={styles.projects}>
        {projects.map((project) => <article className={styles.panel} key={project.name}>
          <h2>{project.name}</h2><p className={styles.muted}>{project.description}</p>
          {project.href && <Link href={project.href}>Open Atlas</Link>}
        </article>)}
      </div>}
      {section === "Settings" && <Settings dataSource={data.dataSource} syncStatus={data.syncStatus}
        syncMessage={data.syncMessage} standby />}
    </main>
  </div>;
}

export default function StandbyPage() {
  const { user, loading } = useAuth();
  if (loading) return <main className={styles.gate}><p role="status">Checking your Atlas account…</p></main>;
  if (!user) return <main className={styles.gate}>
    <h1>Atlas Standby</h1>
    <p>Sign in to Atlas to open your workspace.</p>
    <Link href="/auth/login">Sign in</Link>
    <Link href="/">Exit Standby</Link>
  </main>;
  return <AccountWorkspace key={user.id} accountId={user.id} />;
}
