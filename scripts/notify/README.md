# Ingestion-gap alerting

Two independent, webhook-free channels warn you when the daily scraper goes silent
(no row in `automated_ingestion_runs` for 25h+). Both reuse the same gating script,
`scripts/check-ingestion-gap.mjs`.

| Channel | Where it runs | Always on? | Secrets needed |
| --- | --- | --- | --- |
| GitHub failed-workflow email + auto-opened issue | GitHub Actions (`.github/workflows/cron-gap-detector.yml`) | Yes (server-side) | None — uses the built-in `GITHUB_TOKEN` |
| macOS desktop notification | Your Mac, via `launchd` | Only while the Mac is awake/online | None — reads `.env.local` locally |

The GitHub channel is the **always-on** baseline. The macOS notifier is a louder,
local complement that only fires while your machine is awake.

## GitHub channel (no setup required)

On a detected gap, `cron-gap-detector.yml`:

1. Fails the workflow red, which triggers GitHub's built-in failed-workflow email.
2. Opens a de-duplicated tracking issue (or comments on the existing open one) labeled
   `ingestion-alert`, assigned to `bobmatnyc`.

No secrets are required for the issue alert — it uses the default `GITHUB_TOKEN` via
`actions/github-script`. The assignee (`bobmatnyc`) is editable directly in the workflow
(`ASSIGNEE` constant in the `Open or update ingestion-alert issue` step).

> Note: the issue is **not** auto-closed on recovery yet — close it manually once
> ingestion resumes. (Auto-close-on-recovery is flagged as a future enhancement in the
> workflow.)

## macOS notifier (launchd)

### Prerequisites

- A `.env.local` at the repo root containing `DATABASE_URL` (the same value the GitHub
  job pulls from `secrets.DATABASE_URL`).
- Optional: [`terminal-notifier`](https://github.com/julienXX/terminal-notifier)
  (`brew install terminal-notifier`) for richer notifications. Without it, the script
  falls back to the built-in `osascript` notification.

### Test the script directly first

```bash
bash scripts/notify/ingestion-gap-notify.sh
```

With a healthy DB this logs an `OK:` line and shows no notification. Logs are written to
`tmp/aipr-ingestion-gap.log` (gitignored), falling back to `/tmp/aipr-ingestion-gap.log`.

### Install the launchd job

```bash
cp scripts/launchd/com.aipowerranking.ingestion-gap.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.aipowerranking.ingestion-gap.plist
```

> If your clone lives somewhere other than `/Users/masa/Projects/aipowerranking`, edit
> the absolute path in the plist's `ProgramArguments` before copying it.

It runs daily at **09:15 local time** — just after the 09:00 UTC server cron window.

### Trigger it immediately (smoke test)

```bash
launchctl start com.aipowerranking.ingestion-gap
```

Then inspect output:

```bash
cat /tmp/aipr-ingestion-gap.out /tmp/aipr-ingestion-gap.err
cat tmp/aipr-ingestion-gap.log
```

### Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.aipowerranking.ingestion-gap.plist
rm ~/Library/LaunchAgents/com.aipowerranking.ingestion-gap.plist
```

### Limitations

The launchd job only fires while the Mac is awake and online. If the machine is asleep at
09:15, macOS may run it shortly after wake — but a powered-off machine misses the window
entirely. That is by design: the GitHub-issue alert is the always-on, server-side safety
net, and this is the local convenience layer on top.
