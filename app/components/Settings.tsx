"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import type { AtlasSyncStatus } from "../hooks/useAtlasData";
import { createClient } from "../lib/supabase/client";

type SettingsProps = {
  dataSource: "cloud" | "legacy-local" | null;
  syncStatus: AtlasSyncStatus;
  syncMessage: string;
};

export default function Settings({
  dataSource,
  syncStatus,
  syncMessage,
}: SettingsProps) {
  const { user, loading, signOut } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [signingOut, setSigningOut] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savedDisplayName, setSavedDisplayName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    if (!user) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setProfileLoading(true);
    });
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAccountError(error.message);
        const name = typeof data?.display_name === "string" ? data.display_name : "";
        setDisplayName(name);
        setSavedDisplayName(name);
        setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [supabase, user]);

  async function saveDisplayName(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const normalized = displayName.trim();
    setProfileSaving(true);
    setProfileMessage("");
    setAccountError("");

    const { error } = await supabase.from("profiles").upsert(
      { id: user.id, email: user.email ?? null, display_name: normalized || null },
      { onConflict: "id" }
    );

    if (error) setAccountError(error.message);
    else {
      setDisplayName(normalized);
      setSavedDisplayName(normalized);
      setProfileMessage(normalized ? "Display name saved." : "Display name removed.");
    }
    setProfileSaving(false);
  }

  return (
    <div className="mx-auto mt-4 max-w-2xl md:mt-8">
      <h2 className="text-2xl font-semibold md:text-3xl">Settings</h2>
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">Account</p>

        {loading ? (
          <p className="mt-4 text-sm text-white/50">Checking account…</p>
        ) : user ? (
          <div className="mt-4">
            <p className="text-sm text-white/55">Signed in as</p>
            <p className="mt-1 break-all font-medium text-white/90">{user.email}</p>
            <form onSubmit={saveDisplayName} className="mt-5">
              <label htmlFor="display-name" className="text-sm text-white/65">Display name <span className="text-white/30">(optional)</span></label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input id="display-name" maxLength={80} autoComplete="name" disabled={profileLoading || profileSaving} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setProfileMessage(""); }} placeholder="How Atlas should address you" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#10121B] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#5B7CFF]/60 disabled:opacity-50" />
                <button type="submit" disabled={profileLoading || profileSaving || displayName.trim() === savedDisplayName} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-medium text-white/70 hover:bg-white/5 disabled:opacity-40">{profileSaving ? "Saving…" : "Save"}</button>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/35">Shown only in your Atlas account. It does not change how you log in.</p>
              {profileMessage && <p role="status" className="mt-2 text-xs text-[#91A5FF]">{profileMessage}</p>}
            </form>
            <div className="mt-4 rounded-xl border border-[#5B7CFF]/15 bg-[#5B7CFF]/[0.06] p-3">
              <p className="text-sm text-white/70">
                {syncStatus === "syncing" || syncStatus === "loading"
                  ? "Syncing with Atlas Cloud…"
                  : syncStatus === "conflict"
                    ? "Sync needs attention"
                    : syncStatus === "error"
                      ? "Cloud connection problem"
                      : "Synced with Atlas Cloud"}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/40">
                {syncMessage ||
                  (dataSource === "cloud"
                    ? "This account uses the same fresh cloud data on every signed-in device."
                    : "Your legacy data remains only on this device.")}
              </p>
            </div>
            {accountError && <p role="alert" className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-sm text-red-200/85">{accountError}</p>}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => setShowLogout(true)}
              className="mt-5 min-h-11 rounded-xl border border-white/10 px-4 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              {signingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="max-w-md text-sm leading-6 text-white/50">Sign in to prepare this Atlas for cloud sync. Your current local data stays on this device.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/auth/login" className="flex min-h-11 items-center rounded-xl bg-[#5B7CFF] px-4 text-sm font-medium text-white hover:bg-[#6B89FF]">Log in</Link>
              <Link href="/auth/sign-up" className="flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/75 hover:bg-white/5 hover:text-white">Create account</Link>
            </div>
          </div>
        )}
      </section>
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !signingOut) setShowLogout(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-description" className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#171A26] p-5 shadow-2xl shadow-black/40">
            <h3 id="logout-title" className="text-lg font-semibold text-white">Log out of Atlas?</h3>
            <p id="logout-description" className="mt-2 text-sm leading-6 text-white/50">Your cloud data will stay saved, but this device will return to its local Atlas data.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={signingOut} autoFocus onClick={() => setShowLogout(false)} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-white/65 hover:bg-white/5 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={signingOut} onClick={async () => { setSigningOut(true); setAccountError(""); try { await signOut(); setShowLogout(false); } catch (error) { setAccountError(error instanceof Error ? error.message : "Atlas could not log out. Try again."); } finally { setSigningOut(false); } }} className="min-h-11 rounded-xl bg-[#5B7CFF] px-4 text-sm font-semibold text-white hover:bg-[#6B89FF] disabled:opacity-50">{signingOut ? "Logging out…" : "Log out"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
