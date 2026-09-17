import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  const requestedNext = searchParams.get("next") ?? "/";
  const next = requestedNext.startsWith("/") ? requestedNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
      return NextResponse.redirect(forwardedHost ? `${forwardedProto}://${forwardedHost}${next}` : `${origin}${next}`);
    }
  }

  const loginUrl = new URL("/auth/login", origin);
  loginUrl.searchParams.set("error", "callback");
  if (providerError) loginUrl.searchParams.set("reason", providerError);
  return NextResponse.redirect(loginUrl);
}
