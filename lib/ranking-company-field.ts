/**
 * Why: `info.company` / `info.company_name` are typed as strings, but stored
 *   tool data can hold any JSON value there. The engine called `.includes` on
 *   the value, so an object, number or `true` threw and aborted the whole
 *   ranking run (#241).
 * What: resolves the company the way the engine always did
 *   (`company || company_name || ""`), except that a value `.includes` would
 *   throw on (truthy, neither string nor array) is skipped as absent. Strings
 *   and arrays resolve exactly as before, so only crashing input changes.
 * Test: `lib/ranking-algorithm-v76.company-guard.test.ts`.
 */

const COMPANY_FIELDS = ["company", "company_name"] as const;

/** A company value the engine can call `.includes` on. */
export type CompanyValue = string | readonly unknown[];

interface ResolvedCompany {
  value: CompanyValue;
  /** `info.<field>: <type>` for each skipped value; never the value itself. */
  skipped: string[];
}

function resolveCompany(info: unknown): ResolvedCompany {
  const record = info as Record<string, unknown> | null | undefined;
  const skipped: string[] = [];
  for (const field of COMPANY_FIELDS) {
    const value = record?.[field];
    if (!value) continue;
    if (typeof value === "string" || Array.isArray(value)) return { value, skipped };
    skipped.push(`info.${field}: ${typeof value}`);
  }
  return { value: "", skipped };
}

/** `company || company_name || ""`, skipping values that would throw on `.includes`. */
export function readCompany(info: unknown): CompanyValue {
  return resolveCompany(info).value;
}

/** The company values `readCompany` skipped, as `info.<field>: <type>`. */
export function describeSkippedCompany(info: unknown): string[] {
  return resolveCompany(info).skipped;
}
