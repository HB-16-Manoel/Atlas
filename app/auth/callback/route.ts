import { NextResponse } from "next/server";
import { atlasAuthNext, atlasRequestAuthOrigin } from "../../lib/auth/urls";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  const requestedNext = searchParams.get("next") ?? "/";
  const authOrigin = atlasRequestAuthOrigin(request);
  const next = atlasAuthNext(requestedNext, authOrigin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${authOrigin}${next}`);
    }
  }

  const loginUrl = new URL("/auth/login", authOrigin);
  loginUrl.searchParams.set("error", "callback");
  if (providerError) loginUrl.searchParams.set("reason", providerError);
  return NextResponse.redirect(loginUrl);
}
