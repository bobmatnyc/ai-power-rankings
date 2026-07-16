# Business Metrics Recovery — AI Coding Tools (Dec 2025 – Jul 2026)

Research-only. Output: `business-metrics-recovery.json` (structured, per-tool/per-field/per-month
with provenance) + this summary. Nothing in the JSON is fabricated — every anchor carries a source
URL and date except a handful explicitly flagged inline as "secondary-sourced" (no primary
company/press link located, but still a real, dated, publicly reported claim, not invented).

Methodology: 6 parallel research passes (3 covering the 15 Tier-1 tools in depth, 3 covering the
18 Tier-2 tools) via live web search/fetch. Anchors were assembled into monthly series for
Dec 2025–Jul 2026 using: **step functions** for `swe_bench.verified`, `valuation`, `funding`
(hold most recent real anchor, fidelity `real`); **linear interpolation** for `monthly_arr` and
`users` between two real anchors (fidelity `interpolated`), holding flat past the last anchor
(fidelity `held_flat`), and leaving the field absent before the first anchor. Full convention
notes are embedded in the JSON's `conventions` block.

## Coverage table — tools with at least one REAL anchor, by field

| Field | Tier-1 (of 15) | Tier-2 (of 18) |
|---|---|---|
| `swe_bench.verified` | 10 | 5 |
| `valuation` | 9 | 7 |
| `funding` | 10 | 13 |
| `monthly_arr` | 6 | 7 |
| `users` | 12 | 15 |
| `employees` | 1 | 3 |

Notes on the gaps:
- `swe_bench.verified` is the field most often genuinely **not applicable** rather than merely
  missing: Cursor (uses its own "CursorBench," explicitly rejects SWE-bench as contaminated),
  Tabnine, Sourcegraph Cody, Zed, Continue, IntelliCode, Sourcery, Diffblue Cover, JetBrains AI
  Assistant, Snyk Code, CodeRabbit are all real products that simply don't compete on this
  benchmark (wrong product category — completion/review/test-gen tools, not autonomous coding
  agents). This is an honest structural absence, not a research failure.
- `employees` is almost universally unavailable (as expected — lowest priority field, and most
  companies don't disclose headcount). The one Tier-1 hit is Snyk Code (post-layoff ~65,
  Feb 2025); Tier-2 hits are Lovable (146, Mar 2026), Windsurf (80, Aug 2024), Qodo (~100, 2025).
- `monthly_arr` gaps are concentrated in Google/Microsoft/Amazon/AWS-owned features (Gemini CLI,
  Gemini Code Assist, Amazon Q Developer, GitHub Copilot, IntelliCode) that don't break out
  product-line revenue, and in open-source/solo projects with no revenue model (Aider, OpenHands
  has none disclosed either, Kiro/Jules are Google/AWS-internal).

## Strongest findings — genuine month-to-month movement inside the Dec 2025–Jul 2026 window

These tools have **real, dated anchors landing inside the charted window itself**, not just
historical anchors held flat — i.e. they will show actual movement on the chart, not a flat line
extended from an old data point:

- **Claude Code** (proxy: Anthropic/Claude model) — `valuation` steps $183B→$380B→$965B
  (Series F Sep'25 → G Feb'26 → H May'26); `funding` follows; `monthly_arr` interpolates
  $500M→$2.5B (Claude-Code-specific run-rate, Aug'25→Feb'26 anchors); `users` 115K devs
  (Jul'25) → 2M WAU (May'26, secondary-sourced).
- **ChatGPT Canvas** (proxy: OpenAI corporate) — `valuation` $300B(Mar'25)→$500B(Oct'25, secondary
  share sale)→$852B(Mar'26); `monthly_arr` $10B(Jun'25)→$21.4B(Jan'26)→$25B(Mar'26); `users`
  (ChatGPT WAU) 700M→800M→900M across the window.
- **Devin / Cognition** — `swe_bench.verified` and `valuation`/`funding` both move: valuation
  steps from the pre-window $10.2B (Sep'25) to $26B (May'26, the $1B raise); ARR $73M(Jun'25)→
  $492M(May'26, post-Windsurf-acquisition combined run-rate, self-reported/unaudited).
- **Replit Agent** — the richest Tier-2 story: valuation $3B(Sep'25)→$9B(Mar'26); funding
  $250M→$400M rounds; ARR anchors (though largely forward-looking targets, flagged as such);
  users 40M(Sep'25)→50M+(Mar'26).
- **OpenAI Codex CLI** — inherits OpenAI corporate valuation/funding movement (same as Canvas);
  users 1.6M WAU(Mar'26)→5M WAU(Jun'26, secondary-sourced) is a genuine, large in-window move.
- **Cursor** — ARR interpolates $1B(Nov'25)→$2B(~Feb'26); valuation is flat within the window
  (last confirmed round Nov'25 Series D $29.3B; a rumored $50B talks story in Apr'26 was
  explicitly excluded as unconfirmed).
- **Lovable** — ARR climbs $100M(~Sep'25)→$200M(~Jan'26)→$400M(Feb'26)→$500M(Mar'26), then holds
  flat — one of the cleanest, most fully-dated ARR trajectories of any tool researched.
- **CodeRabbit** — ARR $15M(Sep'25)→$40M(~Apr'26, secondary-sourced).
- **Qwen Code** — SWE-bench steps 67.0%(Jul'25)→70.6%(Feb'26), landing mid-window.
- **Snyk Code** — ARR $300M(Oct'24)→$326M(Feb'26).
- **Qodo Gen** — funding steps at the Series B ($70M, Mar'26), landing mid-window.
- **GitHub Copilot / Gemini CLI** — only `users` move in-window (Copilot 20M→4.7M paid subs is a
  metric-definition change, not a decline — flagged in the JSON note; Gemini CLI GitHub-star proxy
  grows to 100K+).

Tools whose *only* real data pre-dates the window (so the chart will show a flat line at the last
known value, `fidelity: held_flat`, rather than real in-window movement): Windsurf/Codeium (last
valuation event Jul 2025 — the acquisition saga itself is worth surfacing as a status note, see
JSON `status_note`), Augment Code, Zed, Continue (also flagged for its Jun 2026 acquisition by
Cursor — arguably itself a chart-worthy "end of independent existence" event), OpenHands,
JetBrains AI, Sourcery, Diffblue Cover, IntelliCode (flagged for its Nov 2025 deprecation),
Tabnine, Sourcegraph Cody (its own decline story — Free/Pro/Starter tiers discontinued Jul 2025,
became independent from Amp Dec 2025 — is itself real, dated, chart-relevant signal, even though
it's a story of stagnation rather than growth).

## Explicit `not_found` (candor on gaps)

The full per-tool, per-field `not_found` list is in the JSON under `not_found`. Headline patterns:

- **No standalone economics exist** for products that are features of a larger public company —
  Gemini CLI, Gemini Code Assist, Amazon Q Developer, Kiro (all Google/AWS), GitHub Copilot,
  IntelliCode (Microsoft). These aren't gaps in research; there is genuinely no separate
  valuation/funding/ARR disclosed at the product level. Parent-company figures were substituted
  where instructed (e.g. OpenAI/Anthropic/Google corporate rounds for the ChatGPT/Claude feature
  entries) but NOT invented for the AWS/Google/Microsoft product lines, since the task named those
  specific parent substitutions only for Claude Artifacts and ChatGPT Canvas.
- **Google Jules**: the project's own internal hint — "52.2% SWE-bench score at public beta
  launch" — could **not be verified against any primary or secondary source**. The nearest
  adjacent figure found was an unattributed 51.8% with no confirmed model version or date.
  Recommend treating the 52.2% claim already in the project's data as unconfirmed pending a
  primary source, rather than propagating it further.
- **Lovable**: similarly, the project's hint — "$5.56M ARR with 140,000 users" — could **not be
  verified**. The closest confirmed early data point is ~$17M ARR / ~500K users (~Feb 2025,
  secondary-sourced). The $5.56M/140K figure should be treated as unconfirmed.
- **Bolt.new**: the task brief's suggestion of "a large 2025 round" beyond the known $40M-ARR
  milestone maps to the same StackBlitz Series B ($105.5M / $700M valuation, Jan 2025) already
  captured — no separate/later round was found.
- **Employees** is not_found for the overwhelming majority of tools (30/33) — genuinely low
  public disclosure, as expected for this low-priority field.
- Several numeric conflicts were found across sources and are flagged rather than silently
  resolved (e.g. Cursor Series B $100M vs $105M / $2.5B vs $2.6B valuation; o3's SWE-bench score
  cited as both 71.7% and 69.1% in different OpenAI comparison contexts; CodeRabbit employee
  headcount ranging 24–213 across trackers). These are called out inline in the relevant anchor's
  `note` field rather than averaged or guessed.

## Files

- `/private/tmp/claude-502/-Users-masa-trusty-mpm-projects-bobmatnyc-ai-power-rankings--worktrees-tm-ai-power-rankings-01/96293651-0e13-43d6-bcdd-1d8b6b13a944/scratchpad/business-metrics-recovery.json`
- `/private/tmp/claude-502/-Users-masa-trusty-mpm-projects-bobmatnyc-ai-power-rankings--worktrees-tm-ai-power-rankings-01/96293651-0e13-43d6-bcdd-1d8b6b13a944/scratchpad/business-metrics-recovery.md` (this file)

No project files were modified — this is a research-only deliverable, written entirely to the
scratchpad as instructed.
