# Claude-MPM Multi-Agent Setup Guide

## Overview

This guide provides comprehensive instructions for setting up and optimizing Claude-MPM's multi-agent system for the AI Power Rankings project. The system leverages specialized agents for different aspects of development, ensuring efficient task completion and knowledge retention.

## Table of Contents

1. [Agent Configuration](#agent-configuration)
2. [Memory Organization](#memory-organization)
3. [Task Assignment Patterns](#task-assignment-patterns)
4. [Workflow Handoff Procedures](#workflow-handoff-procedures)
5. [TrackDown Integration](#trackdown-integration)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Agent Configuration

### Core Agent Roles

Each agent is configured with specific expertise and responsibilities:

#### Engineer Agent
**Focus**: Clean architecture, code reduction, SOLID principles
```bash
@engineer "Implement feature XYZ following SOLID principles"
```
- Maintains code under 800 lines per file
- Applies dependency injection patterns
- Reduces code duplication aggressively
- Documents architectural decisions

#### QA Agent
**Focus**: Testing, validation, quality assurance
```bash
@qa "Create comprehensive tests for the rankings module"
```
- Writes unit and integration tests
- Validates data integrity
- Performs regression testing
- Documents test coverage gaps

#### Research Agent
**Focus**: Investigation, documentation, analysis
```bash
@research "Analyze performance bottlenecks in news ingestion"
```
- Investigates technical solutions
- Updates documentation
- Analyzes dependencies
- Researches best practices

#### Ops Agent
**Focus**: Deployment, infrastructure, monitoring
```bash
@ops "Deploy latest changes to production"
```
- Manages deployments
- Configures CI/CD pipelines
- Monitors performance
- Handles infrastructure tasks

#### Version Control Agent
**Focus**: Git operations, branching, PR management
```bash
@version-control "Create PR for feature branch TSK-123"
```
- Creates structured commits
- Manages branches
- Handles pull requests
- Maintains release notes

### Configuration File Structure

The agent configuration is stored in `.claude-mpm/config/agents.json`:

```json
{
  "version": "2.0",
  "project_name": "ai-power-rankings",
  "agents": {
    "enabled": true,
    "configuration": {
      "engineer": {
        "role": "Software Engineer",
        "focus": ["architecture", "implementation", "refactoring"],
        "memory_file": "engineer_memories.md",
        "guidelines": [
          "Maintain files under 800 lines",
          "Apply SOLID principles",
          "Use dependency injection",
          "Document architectural decisions"
        ]
      },
      "qa": {
        "role": "Quality Assurance",
        "focus": ["testing", "validation", "quality"],
        "memory_file": "qa_memories.md",
        "guidelines": [
          "Write comprehensive tests",
          "Validate all data changes",
          "Document test coverage",
          "Verify bug fixes"
        ]
      },
      "research": {
        "role": "Technical Researcher",
        "focus": ["investigation", "documentation", "analysis"],
        "memory_file": "research_memories.md",
        "guidelines": [
          "Research best practices",
          "Update documentation",
          "Analyze performance",
          "Investigate solutions"
        ]
      },
      "ops": {
        "role": "DevOps Engineer",
        "focus": ["deployment", "infrastructure", "monitoring"],
        "memory_file": "ops_memories.md",
        "guidelines": [
          "Follow deployment checklist",
          "Monitor performance metrics",
          "Manage CI/CD pipelines",
          "Handle infrastructure"
        ]
      },
      "version-control": {
        "role": "Version Control Specialist",
        "focus": ["git", "branching", "releases"],
        "memory_file": "version-control_memories.md",
        "guidelines": [
          "Create atomic commits",
          "Link to TrackDown tickets",
          "Manage feature branches",
          "Create detailed PRs"
        ]
      }
    }
  },
  "memory": {
    "max_size_kb": 8,
    "max_sections": 10,
    "max_items_per_section": 15,
    "auto_truncate": true
  },
  "integration": {
    "trackdown": {
      "enabled": true,
      "auto_link": true,
      "ticket_prefix": "TSK"
    }
  }
}
```

## Memory Organization

### Memory File Structure

Each agent maintains its own memory file in `.claude-mpm/memories/`:

```markdown
# [Agent] Memory

## Project Architecture
- Key architectural patterns
- Module boundaries
- Dependency relationships

## Implementation Guidelines
- Coding standards specific to this project
- Common patterns to follow
- Performance considerations

## Common Mistakes to Avoid
- Known pitfalls
- Anti-patterns encountered
- Failed approaches

## Current Technical Context
- Recent changes
- Ongoing refactoring
- Technical debt items
```

### Memory Management Best Practices

1. **Regular Pruning**: Review and clean memory files monthly
2. **Accuracy Checks**: Verify memories reflect current codebase
3. **Context Updates**: Add new learnings after major features
4. **Size Management**: Keep under 8KB limit for optimal performance

### Memory Update Triggers

Agents should update memories when:
- Learning new project-specific patterns
- Discovering important constraints
- Finding optimal solutions
- Encountering recurring issues

## Task Assignment Patterns

### Feature Development Pattern

```bash
# 1. Research phase
@research "Investigate requirements for TSK-123 ranking algorithm enhancement"

# 2. Implementation phase
@engineer "Implement TSK-123 ranking algorithm with focus on performance"

# 3. Testing phase
@qa "Create comprehensive tests for TSK-123 ranking algorithm"

# 4. Review phase
@version-control "Create PR for TSK-123 with detailed description"

# 5. Deployment phase
@ops "Deploy TSK-123 to staging environment"
```

### Bug Fix Pattern

```bash
# 1. Reproduction
@qa "Reproduce and document bug TSK-456 in news display"

# 2. Investigation
@research "Investigate root cause of TSK-456"

# 3. Fix implementation
@engineer "Fix TSK-456 following investigation findings"

# 4. Verification
@qa "Verify TSK-456 fix and add regression tests"

# 5. Release
@version-control "Create hotfix PR for TSK-456"
```

### Documentation Update Pattern

```bash
# 1. Analysis
@research "Analyze current state of API documentation"

# 2. Update
@research "Update API documentation with new endpoints"

# 3. Review
@engineer "Review documentation for technical accuracy"

# 4. Commit
@version-control "Commit documentation updates"
```

## Workflow Handoff Procedures

### Explicit Handoff Protocol

When transferring work between agents:

1. **Complete Current Task**
   ```bash
   @engineer "Complete implementation of feature X"
   # Engineer finishes and updates memory
   ```

2. **Provide Context**
   ```bash
   @qa "Test feature X implemented in src/lib/feature-x.ts (TSK-123)"
   # Include specific files and ticket reference
   ```

3. **Include Findings**
   ```bash
   @engineer "Fix issues found by QA in TSK-123:
   - Issue 1: Validation error in line 45
   - Issue 2: Missing error handling"
   ```

### Context Preservation

Always include in handoffs:
- Ticket ID (TSK-XXX)
- Relevant file paths
- Specific issues or requirements
- Previous agent's findings
- Any blockers or dependencies

### Handoff Templates

#### Development to QA
```bash
@qa "Test TSK-123 implementation:
- Feature: [Feature name]
- Files: [List of changed files]
- Focus areas: [Specific areas to test]
- Expected behavior: [What should happen]"
```

#### QA to Engineering
```bash
@engineer "Fix issues in TSK-123:
- Bug: [Description]
- Location: [File and line]
- Steps to reproduce: [How to trigger]
- Expected vs Actual: [Behavior difference]"
```

#### Engineering to Ops
```bash
@ops "Deploy TSK-123:
- Feature: [What's being deployed]
- Dependencies: [New dependencies if any]
- Config changes: [Environment variables, etc.]
- Rollback plan: [How to revert if needed]"
```

## TrackDown Integration

### Linking Agent Work to Tickets

All agent work MUST be linked to TrackDown tickets:

1. **Include Ticket in Request**
   ```bash
   @engineer "Implement TSK-123: Add user authentication"
   ```

2. **Branch Naming**
   Agents automatically use ticket-based branches:
   ```
   feature/TSK-123-user-authentication
   bugfix/TSK-456-fix-display-issue
   ```

3. **Commit Messages**
   Agents include ticket IDs in commits:
   ```
   TSK-123: Add user authentication module
   
   - Implement login/logout functionality
   - Add JWT token handling
   - Create user session management
   ```

### Ticket Status Updates

Agents can update ticket status:

```bash
# Start work
@engineer "Start TSK-123 (move to in-progress)"

# Complete work
@engineer "Complete TSK-123 implementation (move to ready)"

# After testing
@qa "TSK-123 testing complete (move to done)"
```

### Creating Sub-tasks

For complex features:

```bash
@research "Break down TSK-100 into subtasks:
- Authentication module
- Database schema
- API endpoints
- Frontend integration"
```

## Best Practices

### 1. Single Responsibility

Give each agent ONE clear task:
```bash
# GOOD
@engineer "Implement user authentication"

# BAD
@engineer "Implement auth, fix bugs, and update docs"
```

### 2. Clear Success Criteria

Define what "done" means:
```bash
@qa "Test ranking algorithm:
- All unit tests pass
- Integration tests cover 80%+
- Performance under 100ms
- No console errors"
```

### 3. Progressive Enhancement

Build features incrementally:
```bash
# Phase 1: Core functionality
@engineer "Implement basic ranking calculation"

# Phase 2: Optimization
@engineer "Optimize ranking algorithm performance"

# Phase 3: Enhancement
@engineer "Add caching to ranking system"
```

### 4. Documentation as Code

Treat documentation updates as development tasks:
```bash
@research "Document ranking algorithm:
- Algorithm explanation
- Configuration options
- Performance characteristics
- Usage examples"
```

### 5. Validation Gates

Always validate before proceeding:
```bash
# After implementation
@qa "Validate TSK-123 before PR"

# After deployment
@ops "Verify staging deployment of TSK-123"
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: Agent Memory Not Updating
**Solution**: Check memory file permissions and size limits
```bash
ls -la .claude-mpm/memories/
# Ensure files are writable and under 8KB
```

#### Issue: Context Lost Between Agents
**Solution**: Use explicit handoff with full context
```bash
# Include all necessary information
@qa "Test TSK-123 changes in:
- /src/lib/rankings.ts (calculateScore function)
- /src/app/api/rankings/route.ts (GET endpoint)
- Expected: Returns scores between 0-100"
```

#### Issue: Ticket Not Linking
**Solution**: Ensure ticket ID is in correct format
```bash
# Correct format
@engineer "Fix TSK-456 display bug"

# Also works
@engineer "Working on ticket TSK-456"
```

#### Issue: Agent Using Outdated Information
**Solution**: Update agent memory manually
```bash
# Edit memory file directly
vim .claude-mpm/memories/engineer_memories.md
# Remove outdated information
# Add current context
```

### Performance Optimization

1. **Memory File Optimization**
   - Keep memories concise and relevant
   - Remove outdated information regularly
   - Focus on project-specific knowledge

2. **Task Batching**
   - Group related small tasks
   - Reduce context switching
   - Maintain focus within agent domain

3. **Parallel Processing**
   - Use different agents simultaneously for independent tasks
   - Example: QA can test while Engineer implements next feature

### Monitoring Agent Performance

Track agent effectiveness:
```bash
# Check agent memory updates
git diff .claude-mpm/memories/

# Review commit quality
git log --author="Engineer Agent"

# Monitor task completion time
# Review TrackDown ticket timelines
```

## Advanced Patterns

### Multi-Agent Collaboration

For complex features requiring multiple agents:

```bash
# Parallel investigation
@research "Research best practices for caching"
@engineer "Prototype caching solutions"

# Convergence point
@engineer "Implement chosen caching strategy based on research"

# Validation
@qa "Test caching implementation"
@ops "Monitor cache performance metrics"
```

### Agent Specialization

Configure agents for specific domains:

```json
{
  "engineer": {
    "specializations": {
      "frontend": ["React", "Next.js", "TypeScript"],
      "backend": ["Node.js", "API", "Database"],
      "performance": ["Optimization", "Caching", "Profiling"]
    }
  }
}
```

### Continuous Learning

Implement feedback loops:

1. **Post-Task Review**
   ```bash
   @research "Analyze TSK-123 implementation for learnings"
   ```

2. **Memory Enhancement**
   ```bash
   @engineer "Update memories with TSK-123 patterns"
   ```

3. **Process Improvement**
   ```bash
   @ops "Document deployment lessons from TSK-123"
   ```

## Conclusion

The Claude-MPM multi-agent system provides powerful capabilities for managing complex development workflows. By following these guidelines and patterns, teams can leverage specialized agents effectively while maintaining code quality and project consistency.

Remember:
- Choose the right agent for each task
- Maintain clear context in handoffs
- Link all work to TrackDown tickets
- Allow agents to learn and update memories
- Review and optimize agent performance regularly

For quick reference, see the agent configuration in `.claude-mpm/config/agents.json` and individual agent memories in `.claude-mpm/memories/`.