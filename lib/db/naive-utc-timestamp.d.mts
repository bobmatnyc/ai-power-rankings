// #103: type surface for naive-utc-timestamp.mjs, so TypeScript callers can pass
// `naiveUtcTypes` to neon() without checkJs.
import type { types } from "@neondatabase/serverless";

export declare const PG_TIMESTAMP_OID: 1114;
export declare function parseNaiveUtcTimestamp(value: unknown): Date | null;
export declare const naiveUtcTypes: typeof types;
