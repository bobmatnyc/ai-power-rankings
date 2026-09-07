/**
 * Database URL resolution — the branching strategy, as a pure function
 *
 * Why: Two places used to decide whether a connection string exists.
 * `getDatabaseUrl()` in lib/db/connection.ts is conditioned on `NODE_ENV` and in
 * production reads only `DATABASE_URL`; the #143 build guard in
 * scripts/generate-static-categories.ts ORed all three variables regardless. An
 * environment with only `DATABASE_URL_STAGING` set and `NODE_ENV=production` —
 * a Vercel build — passed the guard and then threw inside `getDb()`, turning a
 * skip into a failed build. The rule now lives here once, and both callers read
 * it.
 * What: `resolveDatabaseUrl` maps an environment record and a `NODE_ENV` to the
 * variable `getDb()` would use, or to nothing. It reads no globals, so a test
 * can drive every environment without mutating `process.env` and without any
 * `.env*` file existing.
 * Test: `tests/unit/generate-static-categories.test.ts`.
 */

/** The environment variables the branching strategy can select. */
export type DatabaseUrlVariable =
  | "DATABASE_URL"
  | "DATABASE_URL_DEVELOPMENT"
  | "DATABASE_URL_STAGING";

/** Which variable won, and its value. Both absent when nothing is usable. */
export interface DatabaseUrlResolution {
  url?: string;
  variable?: DatabaseUrlVariable;
}

/** Reads `.env.example`'s `YOUR_PASSWORD` placeholder as "not configured". */
function usable(url: string | undefined): boolean {
  return typeof url === "string" && url.length > 0 && !url.includes("YOUR_PASSWORD");
}

/**
 * Resolves the connection string for `nodeEnv`, or nothing.
 *
 * Why: The single source of truth for "would a connection be attempted?" —
 * `getDb()` and the generate-categories build guard must never disagree (#143).
 * What: Development prefers `DATABASE_URL_DEVELOPMENT` then falls back to
 * `DATABASE_URL`; staging prefers `DATABASE_URL_STAGING` with the same fallback;
 * every other `NODE_ENV`, production included, reads `DATABASE_URL` only.
 * Test: `tests/unit/generate-static-categories.test.ts`.
 */
export function resolveDatabaseUrl(
  env: Readonly<Record<string, string | undefined>>,
  nodeEnv: string
): DatabaseUrlResolution {
  const fallback = env["DATABASE_URL"];

  if (nodeEnv === "development" || nodeEnv === "staging") {
    const preferred: DatabaseUrlVariable =
      nodeEnv === "development" ? "DATABASE_URL_DEVELOPMENT" : "DATABASE_URL_STAGING";
    const preferredUrl = env[preferred];

    if (usable(preferredUrl)) {
      return { url: preferredUrl, variable: preferred };
    }
    if (usable(fallback)) {
      return { url: fallback, variable: "DATABASE_URL" };
    }
    return {};
  }

  if (usable(fallback)) {
    return { url: fallback, variable: "DATABASE_URL" };
  }
  return {};
}

/** The line `getDb()` logs for a resolution, preserved from its old inline form. */
export function describeDatabaseUrlResolution(
  nodeEnv: string,
  variable: DatabaseUrlVariable
): string {
  if (nodeEnv === "development") {
    return variable === "DATABASE_URL_DEVELOPMENT"
      ? "🔧 Using DATABASE_URL_DEVELOPMENT (development branch)"
      : "⚠️ DATABASE_URL_DEVELOPMENT not found, falling back to DATABASE_URL";
  }
  if (nodeEnv === "staging") {
    return variable === "DATABASE_URL_STAGING"
      ? "🚦 Using DATABASE_URL_STAGING (staging branch)"
      : "⚠️ DATABASE_URL_STAGING not found, falling back to DATABASE_URL";
  }
  return "🚀 Using DATABASE_URL (production branch)";
}
