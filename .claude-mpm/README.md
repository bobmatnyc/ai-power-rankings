# Claude-MPM Directory Structure

## Overview

This directory contains Claude-MPM (Multi-Persona Management) configuration and runtime data for the AI Power Rankings project. It enables efficient multi-agent collaboration for development tasks.

## Directory Structure

```
.claude-mpm/
├── config/                 # Configuration files
│   ├── project.json       # Project-level settings
│   ├── agents.json        # Agent roles and capabilities
│   ├── agent-templates.json # Agent behavior templates
│   └── workflows.json     # Workflow orchestration
├── memories/              # Agent-specific memory files
│   ├── engineer_memories.md
│   ├── qa_memories.md
│   ├── research_memories.md
│   ├── ops_memories.md
│   ├── version-control_memories.md
│   ├── PM.md             # Project Manager memory
│   └── README.md
├── logs/                  # System and prompt logs
│   └── prompts/          # Historical prompt logs
└── README.md             # This file
```

## Quick Start

### Using Agents

Delegate tasks to specific agents based on their expertise:

```bash
# Feature development
@engineer "Implement new ranking algorithm"

# Testing
@qa "Write tests for ranking module"

# Documentation
@research "Update API documentation"

# Deployment
@ops "Deploy to production"

# Version control
@version-control "Create PR for feature"
```

### Checking Agent Status

```bash
# View agent configuration
cat .claude-mpm/config/agents.json

# Check agent memories
ls -la .claude-mpm/memories/

# Review recent learnings
git diff .claude-mpm/memories/
```

## Key Files

### config/project.json
Enhanced project configuration including:
- Project paths and structure
- Agent system enablement
- TrackDown ticket integration
- Validation gates and checks
- Critical operation settings
- Platform integrations (PM2, Vercel, GitHub)

### config/agents.json
Comprehensive agent configuration including:
- Agent roles and responsibilities
- SOLID principles and constraints
- Tool permissions and preferences
- Memory management settings
- Integration with TrackDown
- Workflow task patterns
- Project-specific paths and files

### config/agent-templates.json
Agent behavior templates including:
- Task patterns per agent type
- Common commands and scripts
- Handoff templates and protocols
- Validation checklists
- Escalation paths

### config/workflows.json
Complete workflow orchestration including:
- Feature development workflow
- Bug fix workflow
- News ingestion workflow
- Rankings update workflow
- Deployment workflow
- Code cleanup workflow
- Emergency procedures
- Automation rules

### memories/[agent]_memories.md
Each agent maintains memories about:
- Project architecture
- Implementation guidelines
- Common mistakes to avoid
- Current technical context

## Agent Roles

| Agent | Primary Responsibility | Key Skills | Constraints |
|-------|----------------------|------------|------------|
| **Engineer** | Code implementation | Architecture, SOLID, DI, refactoring | Max 800 lines/file, 30 lines/function |
| **QA** | Quality assurance | Testing, validation, bug verification | 80%+ coverage target |
| **Research** | Investigation & docs | Analysis, documentation, best practices | Focus on WHY not what |
| **Ops** | DevOps & deployment | CI/CD, monitoring, infrastructure | Vercel, PM2 integration |
| **Version Control** | Git operations | Commits, PRs, branching, releases | TSK-XXX linking required |
| **PM** | Project coordination | Planning, tracking, reporting | TrackDown integration |

## Memory Management

### Automatic Updates
Agents automatically update their memories when they:
- Learn new project patterns
- Discover important constraints
- Find optimal solutions
- Encounter significant issues

### Manual Maintenance
Developers should periodically:
1. Review memory files for accuracy
2. Remove outdated information
3. Add important project context
4. Ensure size stays under 8KB limit

### Memory Limits
- Maximum file size: 8KB
- Maximum sections: 10
- Maximum items per section: 15
- Auto-truncation when limits exceeded

## Integration Points

### TrackDown Tickets
All agent work must reference TrackDown tickets:
- Include ticket ID in requests (TSK-XXX)
- Agents auto-link commits to tickets
- Branch names include ticket IDs

### PM2 Process Management
Agents integrate with PM2 for development:
- Auto-restart after changes
- Log monitoring
- Status checking

### CI/CD Pipeline
Agents follow validation gates:
- Pre-commit: type-check, lint, test
- Pre-PR: full CI checks
- Pre-deploy: build and cache generation

## Best Practices

1. **Single Task Focus**: Give each agent one clear task
2. **Context Preservation**: Include ticket IDs and file paths
3. **Memory Updates**: Allow agents to learn from tasks
4. **Validation Gates**: Use QA agent to verify changes
5. **Documentation**: Update through Research agent

## Workflow Examples

### Feature Development
```
Research → Engineer → QA → Version Control → Ops
```

### Bug Fix
```
QA (reproduce) → Research → Engineer → QA (verify) → Version Control
```

### Documentation Update
```
Research → Engineer (review) → Version Control
```

## Troubleshooting

### Common Issues

**Agent not updating memory**
- Check file permissions
- Verify size under 8KB
- Ensure write access

**Context lost between agents**
- Use explicit handoffs
- Include all relevant information
- Reference ticket IDs

**Ticket not linking**
- Use correct format (TSK-XXX)
- Include in initial request
- Check branch naming

## Maintenance

### Daily
- Monitor agent performance
- Check for memory updates
- Review completed tasks

### Weekly
- Clean outdated memories
- Analyze agent effectiveness
- Update configuration if needed

### Monthly
- Full memory review
- Configuration optimization
- Workflow pattern analysis

## Additional Resources

- [Project Documentation](/docs/CLAUDE-MPM-SETUP.md)
- [Main Configuration](/CLAUDE.md)
- [Workflow Guide](/docs/WORKFLOW.md)
- [TrackDown Integration](/trackdown/README.md)

## Support

For issues or questions about Claude-MPM:
1. Check `/docs/CLAUDE-MPM-SETUP.md` for detailed setup
2. Review agent memories for project context
3. Consult workflow documentation
4. Check recent commits for examples

---

*Last Updated: 2025-08-25*
*Version: 2.0*