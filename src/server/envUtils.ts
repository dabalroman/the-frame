/**
 * Parse an integer environment variable with a fallback default.
 *
 * Uses `Number()` for strict conversion so values like `"25mb"` are treated as
 * invalid (unlike `parseInt`, which silently drops trailing non-digit characters).
 * If the raw value is absent, not a finite positive integer, emits a console.warn
 * and returns `defaultValue`.
 */
export function parseEnvInt(
  raw: string | undefined,
  varName: string,
  defaultValue: number,
): number {
  if (raw === undefined) return defaultValue;
  const n = Number(raw);
  if (Number.isFinite(n) && Number.isInteger(n) && n > 0) return n;
  console.warn(
    `[env] ${varName}="${raw}" is not a valid positive integer — using default ${defaultValue}`,
  );
  return defaultValue;
}

/**
 * Parse a float environment variable with a fallback default.
 *
 * Uses `Number()` for strict conversion so values like `"1.3x"` are treated as
 * invalid (unlike `parseFloat`, which silently drops trailing non-digit characters).
 * If the raw value is absent, not a finite positive number, emits a console.warn
 * and returns `defaultValue`.
 */
export function parseEnvFloat(
  raw: string | undefined,
  varName: string,
  defaultValue: number,
): number {
  if (raw === undefined) return defaultValue;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  console.warn(
    `[env] ${varName}="${raw}" is not a valid positive number — using default ${defaultValue}`,
  );
  return defaultValue;
}
