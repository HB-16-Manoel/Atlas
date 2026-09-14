"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { JournalEntry } from "../components/Journal";
import type { AtlasEvent, Habit, Task } from "../components/Planning";
import { useAuth } from "../components/AuthProvider";
import {
  CloudConflictError,
  createCloudAtlasRepository,
  snapshotsMatch,
  type AtlasSnapshot,
  type CloudTaskHistoryEvent,
} from "../lib/data/cloudAtlasRepository";
import {
  LEGACY_ATLAS_KEYS,
  legacyAtlasRepository,
} from "../lib/data/legacyAtlasRepository";
import { createClient } from "../lib/supabase/client";

export type AtlasSyncStatus =
  | "checking"
  | "local"
  | "loading"
  | "syncing"
  | "synced"
  | "conflict"
  | "error";

type DataMode = "checking" | "legacy" | "cloud-loading" | "cloud-ready" | "error";

const emptySnapshot = (): AtlasSnapshot => ({
  tasks: [],
  habits: [],
  events: [],
  journalEntries: [],
  taskHistory: [],
});

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function applyCarryOver(tasks: Task[]) {
  const date = todayKey();
  const candidates = tasks.filter(
    (task) =>
      !task.completed &&
      task.carryOver !== false &&
      task.date < date &&
      !task.carriedTo &&
      !task.carriedToId
  );

  if (candidates.length === 0) return tasks;

  const highestOrder = tasks
    .filter((task) => task.date === date)
    .reduce((highest, task) => Math.max(highest, task.order), -1);
  const nextId = Math.max(
    Date.now(),
    tasks.reduce((highest, task) => Math.max(highest, task.id), 0) + 1
  );
  const successors = new Map(
    candidates.map((task, index) => {
      const cloudId = crypto.randomUUID();
      return [
        task.id,
        {
          ...task,
          id: nextId + index,
          cloudId,
          revision: undefined,
          cloudUpdatedAt: undefined,
          completed: false,
          completedAt: undefined,
          date,
          order: highestOrder + index + 1,
          carriedFrom: task.date,
          carriedTo: undefined,
          carriedFromId: task.cloudId,
          carriedToId: undefined,
        } satisfies Task,
      ] as const;
    })
  );

  return [
    ...tasks.map((task) => {
      const successor = successors.get(task.id);
      return successor
        ? {
            ...task,
            carriedTo: date,
            carriedToId: successor.cloudId,
          }
        : task;
    }),
    ...successors.values(),
  ];
}

function parseArray(value: string | null) {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}

function loadLegacySnapshot(): AtlasSnapshot {
  const tasks = parseArray(
    legacyAtlasRepository.getRaw(LEGACY_ATLAS_KEYS.tasks)
  ).map((task, index): Task => {
    const value = task as Task;
    return {
      ...value,
      order: typeof value.order === "number" ? value.order : index,
      carryOver: value.carryOver !== false,
    };
  });

  const habits = parseArray(
    legacyAtlasRepository.getRaw(LEGACY_ATLAS_KEYS.habits)
  ).map((habit, index): Habit => {
    const value = habit as Habit;
    return {
      ...value,
      order: typeof value.order === "number" ? value.order : index,
      completedDates: Array.isArray(value.completedDates) ? value.completedDates : [],
    };
  });

  const events = parseArray(
    legacyAtlasRepository.getRaw(LEGACY_ATLAS_KEYS.events)
  ).filter(
    (event): event is AtlasEvent =>
      Boolean(event) &&
      typeof (event as AtlasEvent).id === "number" &&
      typeof (event as AtlasEvent).title === "string" &&
      typeof (event as AtlasEvent).date === "string"
  );

  const journalEntries = parseArray(
    legacyAtlasRepository.getRaw(LEGACY_ATLAS_KEYS.journal)
  ).filter(
    (entry): entry is JournalEntry =>
      Boolean(entry) &&
      typeof (entry as JournalEntry).date === "string" &&
      typeof (entry as JournalEntry).text === "string" &&
      typeof (entry as JournalEntry).updatedAt === "string"
  );

  const taskHistory = parseArray(
    legacyAtlasRepository.getRaw(LEGACY_ATLAS_KEYS.taskHistory)
  ).filter(
    (event): event is CloudTaskHistoryEvent =>
      Boolean(event) &&
      typeof (event as CloudTaskHistoryEvent).id === "string" &&
      typeof (event as CloudTaskHistoryEvent).taskId === "number" &&
      typeof (event as CloudTaskHistoryEvent).taskText === "string" &&
      typeof (event as CloudTaskHistoryEvent).taskDate === "string" &&
      typeof (event as CloudTaskHistoryEvent).timestamp === "string"
  );

  return {
    tasks: applyCarryOver(tasks),
    habits,
    events: events.map((event) => ({
      ...event,
      time: typeof event.time === "string" ? event.time : undefined,
      repeatYearly: event.repeatYearly === true,
    })),
    journalEntries,
    taskHistory,
  };
}

export function useAtlasData() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const supabase = useMemo(() => createClient(), []);
  const repository = useMemo(
    () => (userId ? createCloudAtlasRepository(supabase, userId) : null),
    [supabase, userId]
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [events, setEvents] = useState<AtlasEvent[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [taskHistory, setTaskHistory] = useState<CloudTaskHistoryEvent[]>([]);
  const [mode, setMode] = useState<DataMode>("checking");
  const [syncStatus, setSyncStatus] = useState<AtlasSyncStatus>("checking");
  const [syncMessage, setSyncMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const modeRef = useRef<DataMode>("checking");
  const generationRef = useRef(0);
  const baselineRef = useRef<AtlasSnapshot | null>(null);
  const latestRef = useRef<AtlasSnapshot>(emptySnapshot());
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const syncingRef = useRef(false);
  const previousTasksRef = useRef<Task[]>([]);
  const taskTrackingReadyRef = useRef(false);

  const applySnapshot = useCallback((snapshot: AtlasSnapshot) => {
    latestRef.current = snapshot;
    previousTasksRef.current = snapshot.tasks;
    taskTrackingReadyRef.current = true;
    setTasks(snapshot.tasks);
    setHabits(snapshot.habits);
    setEvents(snapshot.events);
    setJournalEntries(snapshot.journalEntries);
    setTaskHistory(snapshot.taskHistory);
  }, []);

  useEffect(() => {
    latestRef.current = { tasks, habits, events, journalEntries, taskHistory };
  }, [tasks, habits, events, journalEntries, taskHistory]);

  useEffect(() => {
    if (authLoading) return;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    baselineRef.current = null;
    taskTrackingReadyRef.current = false;
    previousTasksRef.current = [];
    // Authentication is an external state boundary; initialization intentionally
    // replaces the previous account's visible snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncMessage("");

    if (!userId || !repository) {
      try {
        const legacy = loadLegacySnapshot();
        applySnapshot(legacy);
        modeRef.current = "legacy";
        setMode("legacy");
        setSyncStatus("local");
      } catch {
        applySnapshot(emptySnapshot());
        modeRef.current = "legacy";
        setMode("legacy");
        setSyncStatus("local");
      }
      return;
    }

    modeRef.current = "cloud-loading";
    setMode("cloud-loading");
    setSyncStatus("loading");
    applySnapshot(emptySnapshot());

    void repository
      .loadSnapshot()
      .then((cloudSnapshot) => {
        if (generationRef.current !== generation) return;
        const withCarryOver: AtlasSnapshot = {
          ...cloudSnapshot,
          tasks: applyCarryOver(cloudSnapshot.tasks),
        };
        baselineRef.current = cloudSnapshot;
        applySnapshot(withCarryOver);
        modeRef.current = "cloud-ready";
        setMode("cloud-ready");
        setSyncStatus(snapshotsMatch(cloudSnapshot, withCarryOver) ? "synced" : "syncing");
      })
      .catch((error: unknown) => {
        if (generationRef.current !== generation) return;
        modeRef.current = "error";
        setMode("error");
        setSyncStatus("error");
        setSyncMessage(error instanceof Error ? error.message : "Atlas could not load cloud data.");
      });
  }, [applySnapshot, authLoading, reloadToken, repository, userId]);

  useEffect(() => {
    if (mode !== "legacy") return;

    legacyAtlasRepository.setRaw(LEGACY_ATLAS_KEYS.tasks, JSON.stringify(tasks));
    legacyAtlasRepository.setRaw(LEGACY_ATLAS_KEYS.habits, JSON.stringify(habits));
    legacyAtlasRepository.setRaw(LEGACY_ATLAS_KEYS.events, JSON.stringify(events));
    legacyAtlasRepository.setRaw(LEGACY_ATLAS_KEYS.journal, JSON.stringify(journalEntries));
    legacyAtlasRepository.setRaw(LEGACY_ATLAS_KEYS.taskHistory, JSON.stringify(taskHistory));
  }, [events, habits, journalEntries, mode, taskHistory, tasks]);

  useEffect(() => {
    if (mode !== "legacy" && mode !== "cloud-ready") return;

    if (!taskTrackingReadyRef.current) {
      previousTasksRef.current = tasks;
      taskTrackingReadyRef.current = true;
      return;
    }

    const previousTasks = previousTasksRef.current;
    const previousById = new Map(previousTasks.map((task) => [task.id, task] as const));
    const currentById = new Map(tasks.map((task) => [task.id, task] as const));
    const changes: Omit<CloudTaskHistoryEvent, "id" | "cloudId" | "timestamp">[] = [];

    for (const task of tasks) {
      const previous = previousById.get(task.id);
      if (!previous) {
        changes.push({
          taskId: task.id,
          taskCloudId: task.cloudId,
          taskText: task.text,
          taskDate: task.date,
          type: "created",
        });
      } else if (!previous.completed && task.completed) {
        changes.push({
          taskId: task.id,
          taskCloudId: task.cloudId,
          taskText: task.text,
          taskDate: task.date,
          type: "completed",
        });
      } else if (previous.completed && !task.completed) {
        changes.push({
          taskId: task.id,
          taskCloudId: task.cloudId,
          taskText: task.text,
          taskDate: task.date,
          type: "uncompleted",
        });
      }
    }

    for (const task of previousTasks) {
      if (!currentById.has(task.id)) {
        changes.push({
          taskId: task.id,
          taskCloudId: task.cloudId,
          taskText: task.text,
          taskDate: task.date,
          type: "deleted",
        });
      }
    }

    if (changes.length > 0) {
      const timestamp = new Date().toISOString();
      // This effect records domain changes after task state commits.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTaskHistory((current) => [
        ...current,
        ...changes.map((change, index) => ({
          ...change,
          id: `${change.taskId}-${change.type}-${timestamp}-${index}`,
          cloudId: crypto.randomUUID(),
          timestamp,
        })),
      ]);
    }

    previousTasksRef.current = tasks;
  }, [mode, tasks]);

  const queueCloudSync = useCallback(() => {
    if (!repository || modeRef.current !== "cloud-ready") return;
    const generation = generationRef.current;

    syncQueueRef.current = syncQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (generationRef.current !== generation || modeRef.current !== "cloud-ready") return;
        const baseline = baselineRef.current;
        const desired = latestRef.current;
        if (!baseline || snapshotsMatch(baseline, desired)) return;

        syncingRef.current = true;
        setSyncStatus("syncing");
        setSyncMessage("");

        try {
          const fresh = await repository.syncSnapshot(baseline, desired);
          if (generationRef.current !== generation) return;
          baselineRef.current = fresh;

          if (snapshotsMatch(latestRef.current, desired)) {
            applySnapshot(fresh);
          }

          setSyncStatus("synced");
        } catch (error) {
          if (generationRef.current !== generation) return;
          setSyncStatus(error instanceof CloudConflictError ? "conflict" : "error");
          setSyncMessage(error instanceof Error ? error.message : "Atlas could not sync.");
        } finally {
          syncingRef.current = false;
        }
      });
  }, [applySnapshot, repository]);

  useEffect(() => {
    if (mode !== "cloud-ready") return;
    queueCloudSync();
  }, [events, habits, journalEntries, mode, queueCloudSync, taskHistory, tasks]);

  const refreshFromCloud = useCallback(async () => {
    if (
      !repository ||
      modeRef.current !== "cloud-ready" ||
      syncingRef.current ||
      !baselineRef.current ||
      !snapshotsMatch(baselineRef.current, latestRef.current)
    ) {
      return;
    }

    const generation = generationRef.current;

    try {
      const fresh = await repository.loadSnapshot();
      if (generationRef.current !== generation || modeRef.current !== "cloud-ready") return;
      const withCarryOver: AtlasSnapshot = {
        ...fresh,
        tasks: applyCarryOver(fresh.tasks),
      };
      baselineRef.current = fresh;
      applySnapshot(withCarryOver);
      setSyncStatus(snapshotsMatch(fresh, withCarryOver) ? "synced" : "syncing");
      setSyncMessage("");
    } catch (error) {
      if (generationRef.current !== generation) return;
      setSyncStatus("error");
      setSyncMessage(error instanceof Error ? error.message : "Atlas could not refresh cloud data.");
    }
  }, [applySnapshot, repository]);

  useEffect(() => {
    if (mode !== "cloud-ready") return;

    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void refreshFromCloud();
    };
    const interval = window.setInterval(refreshWhenActive, 15_000);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
    };
  }, [mode, refreshFromCloud]);

  return {
    tasks,
    setTasks: setTasks as Dispatch<SetStateAction<Task[]>>,
    habits,
    setHabits: setHabits as Dispatch<SetStateAction<Habit[]>>,
    events,
    setEvents: setEvents as Dispatch<SetStateAction<AtlasEvent[]>>,
    journalEntries,
    setJournalEntries: setJournalEntries as Dispatch<SetStateAction<JournalEntry[]>>,
    taskHistory,
    dataLoading: authLoading || mode === "checking" || mode === "cloud-loading",
    dataError: mode === "error" ? syncMessage : "",
    dataSource:
      mode === "cloud-ready"
        ? ("cloud" as const)
        : mode === "legacy"
          ? ("legacy-local" as const)
          : null,
    syncStatus,
    syncMessage,
    retry: () => setReloadToken((current) => current + 1),
  };
}
