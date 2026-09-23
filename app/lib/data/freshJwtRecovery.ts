const FRESH_JWT_RECOVERY_DELAY_MS = 750;

type PostgrestErrorLike = {
  code?: unknown;
  message?: unknown;
};

export function isFreshJwtIssuedAtFutureError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const { code, message } = error as PostgrestErrorLike;
  return (
    code === "PGRST303" &&
    typeof message === "string" &&
    message.toLowerCase().includes("jwt issued at future")
  );
}

export async function withFreshJwtRecovery<T>(
  operation: () => Promise<T>,
  errorsFor: (result: T) => readonly unknown[],
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds))
) {
  const firstResult = await operation();

  if (!errorsFor(firstResult).some(isFreshJwtIssuedAtFutureError)) {
    return firstResult;
  }

  await wait(FRESH_JWT_RECOVERY_DELAY_MS);
  return operation();
}
