"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { atlasAuthOrigin, atlasGoogleOAuthCallback } from "../lib/auth/urls";
import { createClient } from "../lib/supabase/client";

type Mode = "login" | "sign-up" | "forgot" | "update";

const copy = {
  login: { title: "Welcome back", subtitle: "Log in to your Atlas account.", submit: "Log in" },
  "sign-up": { title: "Create your account", subtitle: "Prepare Atlas for cloud sync.", submit: "Create account" },
  forgot: { title: "Reset password", subtitle: "We’ll send a secure reset link to your email.", submit: "Send reset link" },
  update: { title: "Choose a new password", subtitle: "Update the password for your Atlas account.", submit: "Update password" },
} satisfies Record<Mode, { title: string; subtitle: string; submit: string }>;

function siteUrl() {
  return atlasAuthOrigin(window.location.origin);
}

function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "Incorrect email or password.";
  if (normalized.includes("email not confirmed")) return "Confirm your email before logging in.";
  if (normalized.includes("user already registered")) return "An account with this email already exists.";
  if (normalized.includes("password") && normalized.includes("weak")) return "Choose a stronger password with at least 8 characters.";
  if (normalized.includes("expired") || normalized.includes("invalid")) return "This link is invalid or has expired. Request a new one.";
  if (normalized.includes("rate limit")) return "Too many attempts. Wait a moment and try again.";
  return message || "Something went wrong. Try again.";
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.61Z" />
      <path fill="#EA4335" d="M12 6c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.61C7.18 7.76 9.39 6 12 6Z" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);

  const visibilityIcon = visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.8 10.8 0 0 1 12 4c5.5 0 9 5.5 9 5.5a15 15 0 0 1-2.2 2.7M6.5 6.5C4.3 8 3 9.5 3 9.5S6.5 15 12 15c.8 0 1.6-.1 2.3-.3" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );

  return (
    <label className="block text-sm text-white/65">
      {label}
      <span className="relative mt-2 block">
        <input
          required
          minLength={8}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full rounded-xl border border-white/10 bg-[#10121B] px-4 pr-14 text-white outline-none transition-colors focus:border-[#5B7CFF]/60"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center rounded-r-xl px-3 text-white/45 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#5B7CFF]"
        >
          {visibilityIcon}
        </button>
      </span>
    </label>
  );
}

export default function AuthShell({ mode }: { mode: Mode }) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "callback") return "";
    return friendlyAuthError(new Error(params.get("reason") || "This authentication link is invalid or has expired."));
  });
  const [busy, setBusy] = useState(false);
  const details = copy[mode];
  const needsPassword = mode === "login" || mode === "sign-up" || mode === "update";

  useEffect(() => {
    if (mode === "update") {
      void supabase.auth.getUser().then(({ data, error: userError }) => {
        if (userError || !data.user) setError("This password-reset link is invalid or has expired. Request a new one.");
      });
    }
  }, [mode, supabase]);

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
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        window.location.replace("/");
      }
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setError("");
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: atlasGoogleOAuthCallback(window.location.origin) },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(friendlyAuthError(authError));
      setBusy(false);
    }
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
            <button type="button" disabled={busy} onClick={continueWithGoogle} className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] text-sm font-medium text-white/80 hover:bg-white/[0.07] disabled:opacity-50">
              <GoogleLogo />
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
            <PasswordField label={mode === "update" ? "New password" : "Password"} value={password} onChange={setPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          )}
          {mode === "sign-up" && (
            <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          )}

          {error && <p role="alert" className="rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-sm text-red-200/85">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-[#5B7CFF]/15 bg-[#5B7CFF]/[0.06] p-3 text-sm text-white/70">{message}</p>}

          <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-[#5B7CFF] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6B89FF] disabled:opacity-50">{busy ? "Please wait…" : details.submit}</button>
        </form>

        {mode === "login" && <div className="mt-5 flex items-center justify-between text-sm"><Link href="/auth/forgot-password" className="text-white/45 hover:text-white/75">Forgot password?</Link><Link href="/auth/sign-up" className="text-[#7892FF] hover:text-[#91A5FF]">Create account</Link></div>}
        {mode === "sign-up" && <p className="mt-5 text-center text-sm text-white/45">Already have an account? <Link href="/auth/login" className="text-[#7892FF]">Log in</Link></p>}
        {mode === "forgot" && <p className="mt-5 text-center text-sm"><Link href="/auth/login" className="text-white/45 hover:text-white/75">Back to login</Link></p>}
      </section>
    </main>
  );
}
