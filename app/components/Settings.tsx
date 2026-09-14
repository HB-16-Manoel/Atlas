"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import type { AtlasSyncStatus } from "../hooks/useAtlasData";

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
  const [signingOut, setSigningOut] = useState(false);

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
            <button
              type="button"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await signOut();
                setSigningOut(false);
              }}
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
    </div>
  );
}
