# TrackDown Task Management System

This directory contains the unified task management system for the AI Power Rankings project.

## Structure

```
trackdown/
├── epics/      # High-level project initiatives and feature groups
├── issues/     # Specific problems or feature implementations
├── tasks/      # Individual actionable work items
└── README.md   # This file
```

## Conventions

### File Naming
- Epics: `EP-XXXX-descriptive-name.md`
- Issues: `ISS-XXXX-descriptive-name.md`
- Tasks: `TSK-XXXX-descriptive-name.md`

### Status Tracking
Each item should include:
- Status: `pending`, `in-progress`, `completed`, `blocked`
- Priority: `critical`, `high`, `medium`, `low`
- Created date
- Updated date
- Assignee (if applicable)

### Relationships
- Tasks belong to Issues
- Issues belong to Epics
- Each item should reference its parent

## Workflow

1. Create an Epic for major features or initiatives
2. Break down Epics into Issues for specific implementations
3. Create Tasks for individual work items
4. Update status as work progresses
5. Link commits to task IDs

## Templates

See archived templates in `/docs/archive/2025-08-cleanup/old-tasks/templates/` for reference.

## Migration Note

This system consolidates the previous task management directories:
- `/ai-power-rankings/tasks/` → Archived to `/docs/archive/2025-08-cleanup/old-tasks/`
- `/TICKETS/` → Archived to `/docs/archive/2025-08-cleanup/legacy-tickets/`
- `/tasks/` → Removed (was empty)

Last Updated: 2025-08-25