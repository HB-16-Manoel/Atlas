"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "../lib/supabase/client";

type Mode = "login" | "sign-up" | "forgot" | "update";

const copy = {
  login: { title: "Welcome back", subtitle: "Log in to your Atlas account.", submit: "Log in" },
  "sign-up": { title: "Create your account", subtitle: "Prepare Atlas for cloud sync.", submit: "Create account" },
  forgot: { title: "Reset password", subtitle: "We’ll send a secure reset link to your email.", submit: "Send reset link" },
  update: { title: "Choose a new password", subtitle: "Update the password for your Atlas account.", submit: "Update password" },
} satisfies Record<Mode, { title: string; subtitle: string; submit: string }>;

function siteUrl() {
  return window.location.origin;
}

export default function AuthShell({ mode }: { mode: Mode }) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const details = copy[mode];
  const needsPassword = mode === "login" || mode === "sign-up" || mode === "update";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (mode === "sign-up" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        window.location.assign("/");
      } else if (mode === "sign-up") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/` },
        });
        if (authError) throw authError;
        if (data.session) window.location.assign("/");
        else setMessage("Check your email to confirm your account.");
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password`,
        });
        if (authError) throw authError;
        setMessage("If an account exists for that email, a reset link is on its way.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("Password updated. You can return to Atlas.");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl()}/auth/callback?next=/` },
    });
    if (authError) setError(authError.message);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#11131D] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171A26] p-6 shadow-2xl shadow-black/25 sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white">
          <Image src="/atlas-icon-192.png" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-[0.14em]"><span className="text-[#5B7CFF]">A</span>TLAS</span>
        </Link>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{details.title}</h1>
        <p className="mt-2 text-sm leading-6 text-white/45">{details.subtitle}</p>

        {(mode === "login" || mode === "sign-up") && (
          <>
            <button type="button" onClick={continueWithGoogle} className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-sm font-medium text-white/80 hover:bg-white/[0.07]">
              Continue with Google
            </button>
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-white/25"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>
          </>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode !== "update" && (
            <label className="block text-sm text-white/65">Email
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#10121B] px-4 text-white outline-none transition-colors placeholder:text-white/20 focus:border-[#5B7CFF]/60" />
            </label>
          )}
          {needsPassword && (
            <label className="block text-sm text-white/65">{mode === "update" ? "New password" : "Password"}
              <input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#10121B] px-4 text-white outline-none transition-colors focus:border-[#5B7CFF]/60" />
            </label>
          )}
          {mode === "sign-up" && (
            <label className="block text-sm text-white/65">Confirm password
              <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#10121B] px-4 text-white outline-none transition-colors focus:border-[#5B7CFF]/60" />
            </label>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-sm text-red-200/85">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-[#5B7CFF]/15 bg-[#5B7CFF]/[0.06] p-3 text-sm text-white/70">{message}</p>}

          <button disabled={busy} className="min-h-12 w-full rounded-xl bg-[#5B7CFF] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6B89FF] disabled:opacity-50">{busy ? "Please wait…" : details.submit}</button>
        </form>

        {mode === "login" && <div className="mt-5 flex items-center justify-between text-sm"><Link href="/auth/forgot-password" className="text-white/45 hover:text-white/75">Forgot password?</Link><Link href="/auth/sign-up" className="text-[#7892FF] hover:text-[#91A5FF]">Create account</Link></div>}
        {mode === "sign-up" && <p className="mt-5 text-center text-sm text-white/45">Already have an account? <Link href="/auth/login" className="text-[#7892FF]">Log in</Link></p>}
        {(mode === "forgot" || mode === "update") && <p className="mt-5 text-center text-sm"><Link href={mode === "forgot" ? "/auth/login" : "/"} className="text-white/45 hover:text-white/75">{mode === "forgot" ? "Back to login" : "Return to Atlas"}</Link></p>}
      </section>
    </main>
  );
}
