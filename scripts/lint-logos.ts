/**
 * CLI for the logo lint (`npm run lint:logos`): exits 1 and lists every problem, else 0.
 * Why/What/Test: see `lib/logos/lint.ts`.
 */
import { lintLogos } from "../lib/logos/lint";

const errors = lintLogos(process.cwd());
if (errors.length > 0) {
  console.error(`lint:logos found ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("lint:logos: public/logos and data/logos/manifest.json agree");
