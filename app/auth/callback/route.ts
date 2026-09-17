import { NextResponse } from "next/server";
import { atlasAuthOrigin } from "../../lib/auth/urls";
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
      return NextResponse.redirect(`${atlasAuthOrigin(origin)}${next}`);
    }
  }

  const loginUrl = new URL("/auth/login", atlasAuthOrigin(origin));
  loginUrl.searchParams.set("error", "callback");
  if (providerError) loginUrl.searchParams.set("reason", providerError);
  return NextResponse.redirect(loginUrl);
}
