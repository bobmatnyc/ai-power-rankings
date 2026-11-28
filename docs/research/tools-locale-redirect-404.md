# `/tools/<slug>` redirects to `/en/<slug>` (404)

Read at origin/main a6d18bef. No requests to production were made.

## Conclusion

The redirect is not a locale rule. It is the #191 "Q-A85-1" pattern rule in
`lib/seo/url-table.ts`. That rule treats the first segment of any path with two or
more segments as a junk prefix and strips it. `tools` is neither a locale nor in
`RESERVED_FIRST_SEGMENTS`, so `/tools/cursor` is handled like `/cryptocurrency/tools/cline`.

## 1. Code path

- `middleware.ts:49-50` calls `urlTableRedirect(req)` first, for every matched path.
- `lib/url-table-redirect.ts:18-23` calls `resolveTableRedirect(pathname)` and issues a 308 to the result.
- `lib/seo/url-table.ts:120-128` `resolveTableRedirect`: no literal row matches, so it calls `patternEnglishPath`.
- `lib/seo/url-table.ts:131-137` `patternEnglishPath`:
  - line 134 returns null when there is one segment or the first segment is a locale;
  - line 135 returns null when the first segment is reserved, or starts with `.`/`_`, or contains `.`/`%`;
  - line 136 returns `/en/${segments.slice(1).join("/")}`.
- `lib/seo/url-table.ts:48-61` `RESERVED_FIRST_SEGMENTS` is `api, trpc, design, sign-in, sign-up, data, fonts, logos, old-favicons, partytown, tool-icons, uploads`. It lacks `tools`, `rankings`, `news`.
- Not involved: `next.config.js` (no `redirects()`), `vercel.json` (no redirects/rewrites), `data/url-table-191.json` (no literal `/tools/...` row). `middleware.ts` has no locale-negotiation code.
- There is no `app/tools`, `app/rankings` or `app/news`; every page lives under `app/[lang]`. An unlocalized `/tools/<slug>` has no page, so it can only be redirected or 404.

## 2. Intent

The rule serves the 17 non-locale rows of the signed table (`data/url-table-191.json:2-4,136,215-227`).
Examples: `/cryptocurrency/tools/cline` -> `/en/tools/cline`, `/tech/news` -> `/en/news`,
`/strategy/privacy` -> `/en/privacy`, `/rankings/news` -> `/en/news`,
`/rankings/best-ai-coding-tools` -> `/en/best-ai-coding-tools` -> literal row
-> `/en/rankings/coding-harnesses` (one hop, D31 chain collapse at `url-table.ts:127`).
Those sources have a junk first segment, so dropping it is correct for them. Nobody designed the rule
for `/tools/<slug>`. Two of the 17 rows start with `rankings` (`/rankings/news` and the `best-*` rows), so
`rankings` must keep working as a stripped prefix for those, or each needs a literal row.
Anything that is a real, unlocalized site path (`tools`, `news`, `rankings`, `compare`, ...) is
caught by accident.

What breaks if the rule is narrowed: only the 17 table rows and the `/old/tools/<alias>` assertion
(`tests/unit/url-table-197-release.test.ts:98`) depend on it. Those use junk prefixes, which stay stripped.

## 3. When introduced

- `50ca64c6` 2026-10-25, "feat(seo): ship the signed URL table's 308s and noindex rows (#191) (#272)". Added the rule inline in `resolveTableRedirect` (the same checks as today's lines 131-136).
- `55c0b91a` 2026-10-30, "fix(i18n): return 404 for paths whose language segment is not a supported locale (#350)". Moved it into `patternEnglishPath` and added `heldSourceRewrite`. The behaviour did not change.
- Later commits (#410, #413) only touch `PENDING_TARGETS`.

## 4. Other affected paths

By the code, any unlocalized path with 2+ segments and a non-reserved first segment loses that segment:
- `/tools/<slug>` -> `/en/<slug>` (404)
- `/news/<slug>` -> `/en/<slug>` (404)
- `/rankings/<x>` -> `/en/<x>` (404), except the five literal-backed rows
- `/compare/<a>`, `/methodology/...`, and any other `<name>/<x>` -> `/en/<x>`

Single-segment paths (`/rankings`, `/news`, `/tools`) return null from the rule (line 134). They do not hit this bug.

Callers that emit unlocalized links and so hit the bug:
- `components/news/news-card.tsx:90` (`/tools/${item.tool_id}`)
- `components/ranking/rankings-content.tsx:263` (`/tools/${slug}`)
- `lib/seo/schema.ts:174` (`${baseUrl}/tools/${slug}`)
- `lib/seo/utils.ts:129` (`path: /tools/${slug}`; check whether a locale is prepended afterwards)

I did not verify these four callers beyond their lines.

Tests: no test asserts the wrong `/tools/<slug>` behaviour. The closest are
`tests/unit/url-table-197-release.test.ts:98` (`/old/tools/<alias>` -> `/en/tools/<to>`, correct and must keep passing)
and `tests/unit/url-table-191.test.ts:196-210` (the "left alone" list, which has no `/tools/x` case; the reserved-name loop at 211-218 reads `app/` and `public/` top-level entries only, so `tools` is never exercised). The gap is a missing test, not a wrong one.

## 5. Minimal fix and proof

Fix in `lib/seo/url-table.ts`: add the site's own unlocalized section names to `RESERVED_FIRST_SEGMENTS`,
or better, send them to the localized path instead of the stripped one. Two options:

- A. Stop stripping. In `patternEnglishPath`, when `first` is a known section (`tools`, `news`, `rankings`, ...), return `/en/${segments.join("/")}`. This fixes the 404 and gives the expected `/tools/<slug>` -> `/en/tools/<slug>`. `/rankings/news` and the `best-*` rows still need their literal rows moved to a pre-check, because they share the `rankings` prefix.
- B. Add `tools` (and `news`) to `RESERVED_FIRST_SEGMENTS`. Smallest, but then `/tools/<slug>` returns null: no redirect and a 404 (`/tools/cursor` has no page).

Option A with an explicit set of section names is recommended. Keep the 17 table rows byte-identical.

Test to add in `tests/unit/url-table-191.test.ts` (with the existing `run()` helper):
- `resolveTableRedirect("/tools/cursor")` -> `"/en/tools/cursor"`; `"/tools/openai-codex-cli"` -> `"/en/tools/openai-codex"` (the `/en/tools/openai-codex-cli` row at `url-table-191.json:51` then applies in one hop only if the code resolves the English path through `LITERAL_REDIRECTS`, as line 127 does).
- `run("/tools/cursor")` -> status 308, `location` `/en/tools/cursor`.
- The 17 non-locale rows and the `/old/tools/<alias>` test stay green (regression guard).
Prove it fails first: run the new cases on current main; they return `/en/cursor`.
