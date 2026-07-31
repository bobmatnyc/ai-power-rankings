# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- feat(rankings): v7.9 — blend Terminal-Bench (terminal-bench 2.1) into the agentic-capability factor as a second benchmark alongside SWE-bench (best scaffold+model row per tool via a hand-curated allowlist, tunable `TB_BLEND_WEIGHT` default 0.4, no factor-weight change); wired matched `terminal_bench` leaves into `data/historical-metrics/2026-06.json` with full provenance and a curated source capture at `data/historical-metrics/sources/terminal-bench-2.1.json`

### Changed
- feat(rankings): v7.9 calibration so Terminal-Bench differentiates already-saturated leaders — SWE-bench Verified anchor 70 → 88 (`SWE_BENCH_ANCHOR`, de-saturates today's top scores to the low-90s) and agentic heuristic bonuses now fill remaining headroom instead of adding-then-clipping at 100 (`AGENTIC_BONUS_HEADROOM_SCALE`). Reshapes the SWE-bench contribution for all 31 tools (surfaced in the impact analysis); factor weights unchanged

## [0.5.0] - 2026-07-16

### Changed
- feat(rankings): ranking algorithm v7.6 → v7.7 → v7.8; `ALGORITHM_VERSION` constant advanced as scoring changed (#97, #100)
- feat(rankings): `monthly_arr`/`users` scoring is now continuous (log-interpolated through the previous band anchors) instead of step-banded (#97)

### Fixed
- fix(rankings): metric-path shadowing — `canonicalizeMetricPaths()` normalizes `data.metrics.*` vs `data.info.metrics.*` at scoring time so every factor reads one value per field; corrected Cursor's live rank #13→#3, whose users/ARR/news were invisible to two factor groups (#100)
- fix(rankings): string-stored numeric fields (e.g. valuation `"$10.2B (…)"`) were silently scoring zero — added robust numeric coercion; corrected Devin's ranking (#97)
- fix(rankings): restore the live current snapshot (`is_current`) after multi-period publishes (#98)

### Added
- feat(rankings): period-scoped metrics-override pipeline — `regenerateRankings({ metricsOverridePath })`, CLI `--metrics-source` and `--dry-run` flags, `scripts/generate-historical-metrics.ts` generator (#94, #97, #98)
- data: reconstructed monthly ranking snapshots for Dec 2025–Jun 2026 (the 8-month gap after the Nov 2025 v7.6 rollout), built from source-verified data (npm/PyPI download APIs, dated funding/valuation/SWE-bench announcements) with per-metric `fidelity` provenance; rows flagged `reconstructed: true` (published, not real-time history)
- data: populated live business metrics (`monthly_arr`, `users`, `valuation`, `funding`, `swe_bench`) for 29 tools from source-verified anchors; parent-company financials flow to sub-feature tools by policy, with provenance recorded in `data.business_metrics_provenance`

### Known Issues
- #95 — dated `tool_metrics_history` store (specced, not yet built)
- #96 — lint toolchain broken in worktree
- #101 — `data.info.technical`/`data.info.business` path divergence, same class as #100's fix

## [0.4.5] - 2026-04-12

### Changed
- docs: add final QA verification reports for duplicate prevention system
- docs: add comprehensive duplicate prevention system documentation
- feat(utils): add duplicate investigation and cleanup verification tools
- test: add E2E accessibility verification tests
- feat(scripts): add comprehensive database management and duplicate prevention utilities
- feat(quality): enhance article quality assessment with stricter filtering
- fix: resolve auto article scraping failure by fixing Vercel environment variables
- feat(db): add comprehensive duplicate prevention system
- fix(build): restore build quality checks and resolve ESLint violations
- feat(scripts): add backfill-day.ts for targeted date-range article ingestion
- fix(ingestion): add AbortSignal timeouts to prevent cron hang
- fix(news): tighten article event_type keyword classification
- fix(i18n): replace [TRANSLATE] placeholders in tools.categories + add missing keys
- chore: add post-deployment verification to release pipeline


## [0.4.4] - 2026-03-15

### Changed
- docs: add research notes from i18n and tools cleanup session
- chore: add pnpm release scripts + release.sh
- chore: gitignore kuzu-memories directory
- feat(ingestion): harden auto-tool creation against bad tool ingestion
- fix(i18n): localize left rail category names in sidebar
- i18n: complete translation pass across all 9 language files + tool descriptions
- fix(security): remove insecure cron auth methods — endpoint was open to public
- fix(mobile): implement comprehensive mobile cache-busting for articles
- fix(cron): enable Vercel cron scheduler authentication
- feat: add tool update data for 10 tools with poor descriptions


The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-02-04

### Added
- Automated AI news ingestion with Tavily search integration
- Monthly "State of Agentic Coding" report generation
- Style guide integration for monthly summaries
- Lazy service initialization for build-time safety

### Fixed
- Markdown rendering in StateOfUnion component
- Aggregation service to filter by specific month/year

## [0.3.14] - 2025-12-05

### Security
- Upgrade Next.js to 15.5.7 to fix CVE-2025-55182 (Critical RCE vulnerability)
- Upgrade React to 19.2.1 to fix CVE-2025-55182
- Upgrade React-DOM to 19.2.1

### Added
- Deployment automation system with semantic versioning
- Comprehensive deployment documentation and guides
- Release checklists and GitHub Actions template

### Fixed
- Sitemap XML validation errors for Google Search Console

## [0.3.13] - 2025-12-01

### Added
- Sitemap verification and Google Search Console integration
- ISR optimization for tool pages

### Fixed
- XML sitemap format to resolve Google Search Console errors
- TypeScript and ESLint errors for production deployment

## [0.3.10] - 2025-11-12

### Added
- Integrated Jina.ai Reader API for enhanced article crawling capabilities
- Improved article content extraction and processing

### Changed
- Organized project files into standardized directory structure
- Improved project organization following the Project Organization Standard

### Documentation
- Updated documentation structure to match new organization standard
- Enhanced reference documentation

## [0.3.9] - 2024-11-XX

### Added
- Organized project documentation into structured hierarchy
- Documentation organized by category (algorithms, api, architecture, deployment, development, performance, qa, reference, research, security, troubleshooting)

### Fixed
- Resolved all 94 ESLint errors to pass pre-publish quality gate
- Sign-in button state verification improvements

### Documentation
- Added QA report for sign-in button verification
- Updated changelog structure

## [0.3.8] - 2024-11-XX

### Changed
- Version bump for maintenance release
- Various bug fixes and improvements