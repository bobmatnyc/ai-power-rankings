# Current-UI audit (#188)

Input to the design-system token layer (`docs/refresh/design-tokens.md`).
Contributor guide: [../design-system.md](../design-system.md).

| File | Content |
|---|---|
| [token-inventory.md](token-inventory.md) | Colours, type scale, spacing, radius, shadows and motion in use, with class counts |
| [migration-190b.md](migration-190b.md) | #190 PR B: core-component classes mapped to fixed tokens, with resolved values |
| [one-off-styles.md](one-off-styles.md) | Hard-coded colours (palette classes, hex, `rgb(`) per file under `components/` and `app/` |
| `tmp/design-audit/<label>/` | Screenshots, local only (gitignored, never committed) |

## Screenshots

`scripts/design-audit-shots.ts` captures 9 page types at 375, 768 and 1280 px,
light and dark, 54 full-page PNGs per run.

| Page type | Route |
|---|---|
| `home` | `/en` |
| `rankings` | `/en/rankings` |
| `tools-index` | `/en/tools` |
| `tool-detail` | `/en/tools/claude-code` |
| `category-landing` | `/en/best-ai-coding-tools` (one of nine `best-*` pages) |
| `news-index` | `/en/news` |
| `news-article` | `/en/news/<slug>` |
| `trending` | `/en/trending` |
| `content` | `/en/methodology` (same template family as about, privacy, terms) |

Admin and dashboard routes are behind Clerk and out of scope.

### Run

```bash
npm ci
npm run dev                 # http://localhost:3007
npx tsx scripts/design-audit-shots.ts --label before --base-url http://localhost:3007
# … make the change …
npx tsx scripts/design-audit-shots.ts --label after --base-url http://localhost:3007
npx tsx scripts/design-audit-shots.ts --compare before,after
```

`--compare` prints one line per file (`identical-bytes`,
`identical-pixels` or `DIFFERENT` with a pixel count), writes
`tmp/design-audit/compare-<a>-<b>.tsv`, and exits non-zero on any difference.

- **Dark mode.** The site has no theme toggle, so the script adds
  `class="dark"` to `<html>`.
- **Repeatability.** Requests to origins other than the base URL (analytics,
  remote logos) are blocked, animations are disabled, and Next's dev
  indicator is hidden.
- **Browser.** The script uses Playwright's bundled Chromium
  (`npx playwright install chromium`). To use another build, set
  `PLAYWRIGHT_CHROMIUM_PATH` to its executable.
- **Without a database.** With no `DATABASE_URL`, start the dev server with
  `NEXT_PUBLIC_DISABLE_AUTH=true` (development only; the middleware refuses it
  in production). Pages render, but database-backed sections show their empty
  or error state, and the news article renders the not-found page. That is
  enough to prove a stylesheet change is invisible; a full visual audit needs
  a development database.
- **Run-to-run noise.** Without a database, `home`, `trending` and
  `rankings-375-light` differ between two runs of the same code (page height
  changes as client-side fetches fail at different moments). Take a second
  set of the unchanged code (`--label after2`) and compare it too: a file
  that differs only where the control also differs is noise. In #188,
  before/after differed in 7 files and after/after2 in 6, all from that set;
  the other 47 were byte-identical, and the compiled stylesheet only gained
  the token layer.
