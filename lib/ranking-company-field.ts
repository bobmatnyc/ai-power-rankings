/**
 * Why: `info.company` / `info.company_name` are typed as strings, but stored
 *   tool data can hold any JSON value there. The engine called `.includes` on
 *   the value, so an object, number or `true` threw and aborted the whole
 *   ranking run (#241).
 * What: reads the two company fields as strings only. A non-string value reads
 *   as absent, so it scores exactly like a missing field.
 * Test: `lib/ranking-algorithm-v76.company-guard.test.ts`.
 */

const COMPANY_FIELDS = ["company", "company_name"] as const;

/** `info.company`, then `info.company_name`, keeping only string values; else "". */
export function readCompanyString(info: unknown): string {
  const record = info as Record<string, unknown> | null | undefined;
  for (const field of COMPANY_FIELDS) {
    const value = record?.[field];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

/**
 * Lists each company field that is set but is not a string, as
 * `info.<field>: <type>`. Null and undefined count as absent and are not
 * listed. The value itself is never included.
 */
export function describeNonStringCompany(info: unknown): string[] {
  const record = info as Record<string, unknown> | null | undefined;
  const found: string[] = [];
  for (const field of COMPANY_FIELDS) {
    const value = record?.[field];
    if (value === null || value === undefined || typeof value === "string") continue;
    found.push(`info.${field}: ${Array.isArray(value) ? "array" : typeof value}`);
  }
  return found;
}
