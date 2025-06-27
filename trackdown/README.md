# TrackDown - Project Management

This directory contains the TrackDown project management system for AI Power Rankings.

## Overview

TrackDown is a markdown-based project tracking system that treats project management artifacts as code, storing everything in version-controlled markdown files.

## Quick Start

### View Current Sprint
```bash
grep -A20 "## 🎯 Current Sprint" BACKLOG.md
```

### Check Status
```bash
./scripts/status-report.sh
```

### Update Task Status
1. Open `BACKLOG.md`
2. Find your task
3. Update status field
4. Mark checkboxes as complete: `- [x]`
5. Commit changes

## Files

- **BACKLOG.md** - All work items (tasks, bugs, stories, epics)
- **ROADMAP.md** - High-level planning and milestones
- **METRICS.md** - Velocity, quality, and performance metrics
- **RETROSPECTIVES.md** - Sprint retrospectives and learnings
- **templates/** - Templates for new work items
- **scripts/** - Automation tools
- **archive/** - Completed sprints

## Workflow

### Daily
1. Pull latest: `git pull`
2. Update your tasks in BACKLOG.md
3. Commit changes: `git commit -m "chore(trackdown): update T-XXX status"`
4. Push: `git push`

### Sprint Planning
1. Review backlog items
2. Move items to "Current Sprint" section
3. Update sprint number in frontmatter
4. Commit changes

### Creating New Items
Use templates in `templates/` as starting point:
- `task-template.md` - For development tasks
- `bug-template.md` - For bug reports
- `epic-template.md` - For large features

## Naming Conventions

- **Epics:** EP-XXX (EP-001, EP-002...)
- **Tasks:** T-XXX (T-001, T-002...)
- **Bugs:** BUG-XXX (BUG-001, BUG-002...)
- **Stories:** US-XXX (US-001, US-002...)

## Status Values

- `Backlog` - Not started
- `Ready` - Ready to work on
- `In Progress` - Being worked on
- `In Review` - In code review
- `Testing` - Being tested
- `Done` - Complete
- `Blocked` - Cannot proceed

## Integration

Reference TrackDown items in commits and PRs:
```bash
git commit -m "feat: implement feature - closes T-007"
```

## Reports

Generate status report:
```bash
./scripts/status-report.sh
```

## Current Focus

**Sprint 1**: JSON Database Migration (EP-001)
- Migrating from hybrid database/CMS to static JSON files
- 18 tasks planned
- Goal: Improve development velocity