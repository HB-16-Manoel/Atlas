export const ATLAS_PRODUCTION_ORIGIN = "https://atlas-five-kappa.vercel.app";

export function atlasAuthOrigin(currentOrigin: string) {
  const url = new URL(currentOrigin);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return url.origin;
  }

  return ATLAS_PRODUCTION_ORIGIN;
}
