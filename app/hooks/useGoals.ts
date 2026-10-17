"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { createClient } from "../lib/supabase/client";
import { loadGoals, type GoalSnapshot } from "../lib/data/goalsRepository";

const empty: GoalSnapshot = { goals: [], milestones: [], taskLinks: [], habitLinks: [] };

export function useGoals() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const client = useMemo(() => createClient(), []);
  const [snapshot, setSnapshot] = useState<GoalSnapshot>(empty);
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async (showError = true) => {
    if (!userId) return;
    const request = ++sequence.current;
    try {
      const next = await loadGoals(client, userId);
      if (request !== sequence.current) return;
      setSnapshot(next);
      setLoadedUser(userId);
      setError(null);
    } catch (cause) {
      if (request !== sequence.current) return;
      if (showError) setError(cause instanceof Error ? cause.message : "Could not load goals.");
      setLoadedUser(userId);
    }
  }, [client, userId]);

  useEffect(() => {
    const currentSequence = sequence;
    ++currentSequence.current;
    if (userId) queueMicrotask(() => void refresh());
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(false); };
    const timer = window.setInterval(onFocus, 15000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      ++currentSequence.current;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [userId, refresh]);

  return {
    snapshot: loadedUser === userId && userId ? snapshot : empty,
    loading: authLoading || Boolean(userId && loadedUser !== userId),
    error: loadedUser === userId ? error : null,
    userId,
    client,
    refresh,
  };
}
