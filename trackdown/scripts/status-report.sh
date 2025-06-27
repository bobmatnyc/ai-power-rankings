#!/bin/bash

# TrackDown Status Report Generator
# Generates a quick status report from BACKLOG.md

BACKLOG_FILE="trackdown/BACKLOG.md"

if [ ! -f "$BACKLOG_FILE" ]; then
    echo "Error: $BACKLOG_FILE not found!"
    exit 1
fi

echo "==================================="
echo "TrackDown Status Report"
echo "Generated: $(date)"
echo "==================================="
echo

# Extract sprint info from frontmatter
CURRENT_SPRINT=$(grep "sprint_current:" "$BACKLOG_FILE" | cut -d: -f2 | tr -d ' ')
echo "Current Sprint: $CURRENT_SPRINT"
echo

# Count items by status
echo "Task Status Summary:"
echo "-------------------"

# Count total tasks (excluding the template example)
TOTAL_TASKS=$(grep -E "^\- \[[ x]\] \*\*\[T-[0-9]+\]\*\*" "$BACKLOG_FILE" | wc -l)
COMPLETED_TASKS=$(grep -E "^\- \[x\] \*\*\[T-[0-9]+\]\*\*" "$BACKLOG_FILE" | wc -l)
PENDING_TASKS=$(grep -E "^\- \[ \] \*\*\[T-[0-9]+\]\*\*" "$BACKLOG_FILE" | wc -l)

echo "Total Tasks: $TOTAL_TASKS"
echo "Completed: $COMPLETED_TASKS"
echo "Pending: $PENDING_TASKS"

if [ $TOTAL_TASKS -gt 0 ]; then
    COMPLETION_PERCENT=$((COMPLETED_TASKS * 100 / TOTAL_TASKS))
    echo "Completion: $COMPLETION_PERCENT%"
fi

echo

# Show current sprint items
echo "Current Sprint Items:"
echo "--------------------"

# Extract current sprint section
awk '/## 🎯 Current Sprint/,/^## 📋/' "$BACKLOG_FILE" | grep -E "^\- \[[ x]\] \*\*\[" | while read -r line; do
    # Extract task ID and title
    TASK_ID=$(echo "$line" | grep -oE "\[T-[0-9]+\]" | tr -d '[]')
    TASK_TITLE=$(echo "$line" | sed -E 's/.*\*\* (.+)$/\1/')
    STATUS="Pending"
    if [[ "$line" == *"[x]"* ]]; then
        STATUS="Done"
    fi
    printf "%-8s %-40s %s\n" "$TASK_ID" "$TASK_TITLE" "[$STATUS]"
done

echo

# Count by priority
echo "Tasks by Priority:"
echo "-----------------"
HIGH_PRIORITY=$(grep -A5 "Priority: High" "$BACKLOG_FILE" | grep -B5 "\[T-[0-9]\+\]" | grep -c "Priority: High")
MEDIUM_PRIORITY=$(grep -A5 "Priority: Medium" "$BACKLOG_FILE" | grep -B5 "\[T-[0-9]\+\]" | grep -c "Priority: Medium")
LOW_PRIORITY=$(grep -A5 "Priority: Low" "$BACKLOG_FILE" | grep -B5 "\[T-[0-9]\+\]" | grep -c "Priority: Low")
CRITICAL_PRIORITY=$(grep -A5 "Priority: Critical" "$BACKLOG_FILE" | grep -B5 "\[T-[0-9]\+\]" | grep -c "Priority: Critical")

[ $CRITICAL_PRIORITY -gt 0 ] && echo "Critical: $CRITICAL_PRIORITY"
[ $HIGH_PRIORITY -gt 0 ] && echo "High: $HIGH_PRIORITY"
[ $MEDIUM_PRIORITY -gt 0 ] && echo "Medium: $MEDIUM_PRIORITY"
[ $LOW_PRIORITY -gt 0 ] && echo "Low: $LOW_PRIORITY"

echo
echo "==================================="