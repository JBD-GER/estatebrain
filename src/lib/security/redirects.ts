const INTERNAL_ORIGIN = "https://estate-brain.internal";
const unsafeCharacters = /[\u0000-\u001f\u007f\\]/;

export function safeInternalPath(
  value: string | null | undefined,
  fallback: string,
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    unsafeCharacters.test(value) ||
    /%5c/i.test(value)
  ) {
    return fallback;
  }

  try {
    const target = new URL(value, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function trustedApplicationOrigin(
  configured: string | undefined,
  requestOrigin: string | null,
) {
  for (const candidate of [configured, requestOrigin]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.hostname === "localhost") {
        return url.origin;
      }
    } catch {
      // Continue with the next trusted source.
    }
  }
  return "http://localhost:3000";
}
