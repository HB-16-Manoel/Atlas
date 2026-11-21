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

type Section = "Dashboard" | "Focus" | "Studio" | "Settings";
const navigation = [
  { name: "Dashboard", icon: "▦" },
  { name: "Focus", icon: "◷" },
  { name: "Studio", icon: "⌘" },
] as const;

type View = "Standard" | "Immersive";

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

function Focus({ timer, save, tasks, linked, link }: {
  timer: Timer;
  save: (timer: Timer) => void;
  tasks: Task[];
  linked: string;
  link: (id: string) => void;
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
      {(["Standard", "Immersive"] as const).map((option) =>
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
          {!immersive && <details className={styles.timerSettings}><summary>Timer setup</summary>
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
          </details>}
        </div>
      </div>
    </div>
  </>;
  return immersive
    ? <dialog ref={dialog} className={styles.immersive} aria-label="Immersive focus timer"
        onCancel={(event) => { event.preventDefault(); setView("Standard"); }}>{content}</dialog>
    : <section className={styles.focus} aria-label="Focus timer">{content}</section>;
}

const projects = [
  { id: "Atlas", name: "Atlas", repo: "Atlas", description: "Plan tasks, track habits, and review personal progress.", href: "/" },
  { id: "Monte", name: "Monte", repo: "Monte", description: "Development workspace for Monte." },
  { id: "Scribble", name: "Scribble", repo: "Scribble", description: "Development workspace for Scribble." },
  { id: "School-Portal", name: "School Portal", repo: "School-Portal", description: "Henrique’s school portal." },
];

type Commit = { sha: string; message: string; date: string; branch: string };

function StationClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timeout: number;
    const update = () => {
      window.clearTimeout(timeout);
      const time = new Date();
      setNow(time);
      timeout = window.setTimeout(update, 60_000 - (time.getTime() % 60_000));
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return <time className={styles.clock} dateTime={now.toISOString()}>
    <span>{now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
    <strong>{now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</strong>
  </time>;
}

function Studio({ storageKey, onStorageError }: { storageKey: string; onStorageError: () => void }) {
  const [id, select] = useState("Atlas");
  const [commit, setCommit] = useState<Commit | "error" | null>(null);
  const project = projects.find((entry) => entry.id === id) ?? projects[0];
  const repo = `https://github.com/HB-16-Manoel/${project.repo}`;

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/standby/commit", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("GitHub unavailable");
        const result = await response.json() as Commit;
        if (!controller.signal.aborted) setCommit(result);
      })
      .catch(() => { if (!controller.signal.aborted) setCommit("error"); });
    return () => controller.abort();
  }, []);

  return <section aria-label="Studio">
    <div className={styles.studioBanner}>
      <div><h2>{project.name}</h2><p className={styles.muted}>{project.description}</p>
        {id === "Atlas" && commit && commit !== "error" && <p className={styles.eyebrow}>{commit.branch}</p>}
      </div>
      <label className={styles.field}>Project
        <select value={id} onChange={(event) => select(event.target.value)}>
          {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
    <div className={styles.studioGrid}>
      <article className={styles.panel}>
        <h2>Latest commit</h2>
        {id !== "Atlas" ? <p className={styles.muted}>Commit details are available to repository members on GitHub.</p>
          : commit === "error" ? <p role="status">GitHub is temporarily unavailable.</p>
          : !commit ? <p role="status">Loading latest commit…</p>
          : <>
            <p className={styles.commitMessage}>{commit.message.split("\n")[0]}</p>
            <p className={styles.muted}>{commit.branch} · <time dateTime={commit.date}>{new Date(commit.date).toLocaleString()}</time></p>
            <a className={styles.projectLink} href={`${repo}/commit/${commit.sha}`}>{commit.sha.slice(0, 7)} ↗</a>
          </>}
      </article>
      <ProjectNotes key={id} noteKey={`${storageKey}:studio:${id}:notes`}
        legacyKey={id === "Atlas" ? `${storageKey}:notes` : undefined} onStorageError={onStorageError} />
    </div>
    <div className={styles.studioLinks}>
      <a href={repo}>GitHub ↗</a>
      {project.href && <Link href={project.href}>Open project ↗</Link>}
    </div>
  </section>;
}

function ProjectNotes({ noteKey, legacyKey, onStorageError }: {
  noteKey: string;
  legacyKey?: string;
  onStorageError: () => void;
}) {
  const [notes, setNotes] = useState(() =>
    readLocal(noteKey, legacyKey ? readLocal(legacyKey, "") : ""));
  return <label className={styles.panel}>
    <strong>Development notes</strong>
    <textarea className={styles.notes} value={notes} maxLength={20000}
      placeholder="Ideas, bugs, and next steps"
      onChange={(event) => {
        const value = event.target.value;
        setNotes(value);
        if (!writeLocal(noteKey, value)) onStorageError();
      }} />
    <span className={styles.muted}>Saved on this device</span>
  </label>;
}

function AccountWorkspace({ accountId }: { accountId: string }) {
  const data = useAtlasData();
  const key = `atlas-standby-v1:${accountId}`;
  const [section, setSection] = useState<Section>("Dashboard");
  const [timer, setTimer] = useState(() => recover(readLocal(`${key}:timer`, initialTimer) ?? initialTimer, Date.now()));
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
        <Image src="/atlas-icon-512.png" alt="" width={40} height={40} />
        <div><strong>ATLAS</strong><span>Standby</span></div>
      </div>
      <div className={styles.modes}>{navigation.map(({ name, icon }) =>
        <button key={name} aria-current={section === name ? "page" : undefined}
          onClick={() => setSection(name)}>
          <span className={styles.navIcon} aria-hidden="true">{icon}</span><span>{name}</span>
        </button>)}</div>
      <button className={styles.gear} aria-label="Settings" aria-current={section === "Settings" ? "page" : undefined}
        onClick={() => setSection("Settings")}>⚙</button>
    </nav>
    <main className={styles.main}>
      <header className={styles.header}><h1>{section}</h1>
        {section === "Dashboard" && <StationClock />}
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
          <div className={`${styles.panel} ${styles.overview}`}><p className={styles.eyebrow}>Today</p>
            <h2>Your day, at a glance</h2>
            <span className={styles.muted}>Daily Score </span>
            <strong className={styles.score}>{score ?? "—"}</strong><span className={styles.muted}> / 100</span>
            {score !== null && <progress className={styles.progress} max={100} value={score} aria-label="Daily Score" />}
          </div>
          <button className={styles.timerCard} onClick={() => setSection("Focus")} aria-label="Open Focus">
            <span className={styles.eyebrow}>Focus · {timer.mode === "pomodoro" ? timer.phase : timer.mode}</span>
            <TimerFace timer={timer} />
            <span className={styles.muted}>{timer.finished ? "Finished" : timer.started !== null ? "Running" : timer.elapsed ? "Paused" : "Ready"}</span>
            <span aria-hidden="true" className={styles.timerArrow}>↗</span>
          </button>
        </div>
        {ready && <div className={styles.dashboard}>
          <section className={styles.panel}>
            <div className={styles.widgetHeading}><h2>Today’s tasks</h2>
              <span className={styles.muted}>{tasks.filter((task) => !task.completed).length} remaining</span>
            </div><div className={styles.taskList} tabIndex={tasks.length > 4 ? 0 : undefined} aria-label="Today’s task list">
            {tasks.length === 0 && <p className={styles.muted}>No tasks planned.</p>}
            {tasks.map((task) => <label key={task.id} className={styles.check}>
              <input type="checkbox" checked={task.completed} onChange={() => data.setTasks((items) =>
                items.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))} />
              <span>{task.text}</span>
            </label>)}
          </div></section>
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
            <section className={`${styles.panel} ${styles.habits}`}>
              <div className={styles.widgetHeading}><h2>Today’s habits</h2>
                <span className={styles.muted}>{habits.filter((habit) => habit.completedDates.includes(todayKey)).length} / {habits.length} complete</span>
              </div><div className={styles.habitGrid}>
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
            </div></section>
        </div>}
      </>}
      {section === "Focus" && <Focus timer={timer} save={saveTimer}
        tasks={ready ? data.tasks : []} linked={linked}
        link={(value) => {
          setLinked(value);
          if (!writeLocal(`${key}:task`, value)) setStorageError(true);
        }}
        />
      }
      {section === "Studio" && <Studio storageKey={key} onStorageError={() => setStorageError(true)} />}
      {section === "Settings" && <div className={styles.settings}>
        <Settings dataSource={data.dataSource} syncStatus={data.syncStatus}
          syncMessage={data.syncMessage} standby />
      </div>}
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
