/**
 * Launch-time environment for `scripts/measure-v8-board.ts` (#185).
 *
 * Why: the script's import graph reaches `lib/db/connection.ts` (through the
 *   ranking service), which loads `.env.local` and `.env` into `process.env`
 *   when NODE_ENV is unset or "development". The measurement must use only a
 *   credential the operator passed on the command line, never one from a file.
 * What: the script imports this module first, so it runs before any other
 *   module. It records the dedicated connection variable as it was at launch,
 *   then sets NODE_ENV to "production" so the connection module skips dotenv.
 *   A value a `.env*` file supplies later is never read.
 * Test: `tests/unit/measure-v8-board-script-185.test.ts`
 */

/** The only variable the measurement reads its connection string from. */
export const MEASURE_DATABASE_VAR = "MEASURE_V8_DATABASE_URL";

/** The dedicated variable's value at process launch, before any `.env*` load. */
export const launchConnectionString: string | undefined = process.env[MEASURE_DATABASE_VAR];

// #185: lib/db/connection.ts runs dotenv unless NODE_ENV is set to something else.
Object.assign(process.env, { NODE_ENV: "production" });
