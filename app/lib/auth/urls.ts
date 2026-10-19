export const ATLAS_PRODUCTION_ORIGIN = "https://atlas-five-kappa.vercel.app";

/** Preview origins must be explicitly configured in Vercel's Preview environment
 * and their callbacks separately allowed by Supabase. No wildcard host trust. */
export function atlasAuthOrigin(
  currentOrigin: string,
  previewOrigins = process.env.NEXT_PUBLIC_ATLAS_PREVIEW_AUTH_ORIGINS ?? "",
) {
  const url = new URL(currentOrigin);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return url.origin;
  }

  const authorizedPreview = previewOrigins.split(",").some((entry) => {
    try {
      const allowed = new URL(entry.trim());
      return (
        allowed.protocol === "https:" &&
        !allowed.username &&
        !allowed.password &&
        allowed.pathname === "/" &&
        !allowed.search &&
        !allowed.hash &&
        allowed.origin === url.origin
      );
    } catch {
      return false;
    }
  });

  return authorizedPreview ? url.origin : ATLAS_PRODUCTION_ORIGIN;
}

export function atlasGoogleOAuthCallback(currentOrigin: string) {
  return `${atlasAuthOrigin(currentOrigin)}/auth/callback`;
}

export function atlasAuthNext(requestedNext: string, origin: string) {
  if (!requestedNext.startsWith("/")) return "/";
  const target = new URL(requestedNext, origin);
  return target.origin === origin
    ? `${target.pathname}${target.search}${target.hash}`
    : "/";
}

/** Next may expose an internal request URL behind a proxy. Accept forwarded hosts
 * only when they resolve to the same explicit origin allowlist used by the UI. */
export function atlasRequestAuthOrigin(
  request: Request,
  previewOrigins = process.env.NEXT_PUBLIC_ATLAS_PREVIEW_AUTH_ORIGINS ?? "",
  hosted = Boolean(process.env.VERCEL),
) {
  const requestUrl = new URL(request.url);
  const protocol =
    request.headers.get("x-forwarded-proto") === "https"
      ? "https:"
      : requestUrl.protocol;
  const candidates = [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
  ];
  for (const host of candidates) {
    if (!host || /[\s,/@\\]/.test(host)) continue;
    try {
      const origin = new URL(`${protocol}//${host}`).origin;
      const local = ["localhost", "127.0.0.1"].includes(
        new URL(origin).hostname,
      );
      if (local && hosted) continue;
      if (atlasAuthOrigin(origin, previewOrigins) === origin) return origin;
    } catch {
      /* Invalid/untrusted proxy metadata is never a redirect target. */
    }
  }
  if (hosted && ["localhost", "127.0.0.1"].includes(requestUrl.hostname))
    return ATLAS_PRODUCTION_ORIGIN;
  return atlasAuthOrigin(requestUrl.origin, previewOrigins);
}
