# Memory Service Usage Guide

## Overview

The EVA monorepo uses a mem0-based memory service for persistent context and knowledge management. This service is accessed through MCP (Model Context Protocol) and provides semantic memory storage with vector search capabilities.

## Architecture

- **Memory Service**: `services/mcp-memory-service` - mem0-based implementation
- **Storage**: MongoDB for data, Qdrant for vector embeddings
- **Access**: Through MCP protocol via Claude Desktop configuration
- **API**: Standardized mem0 interface

## Available Memory Tools

When the memory service is configured, these MCP tools are available:

### Memory Operations
- `search_memories` - Semantic search across all memories
- `add_memory` - Create new memories with metadata
- `get_memory` - Retrieve specific memory by ID
- `update_memory` - Update existing memories
- `delete_memory` - Remove memories

### Entity Management
- `search_entities` - Find people, projects, companies, etc.
- `create_entity` - Create new entities with metadata
- `get_entity` - Retrieve entity details
- `update_entity` - Update entity information
- `delete_entity` - Remove entities
- `create_relationship` - Link entities together

## Using Memory Service in Claude Code

### Initial Context Loading

When starting work, always load relevant context:

```
# Search for project-specific memories
Search memories for "eva-monorepo"

# Check for assigned tasks
Search memories for tags: ["claude-code-task", "pending"]

# Get recent updates
Search memories for recent changes in the last 24 hours
```

### Saving Memories

Always include structured metadata when saving memories:

```json
{
  "content": "Completed Slack integration setup for EVA. Bot token and app token configured, Socket Mode enabled.",
  "metadata": {
    "project_path": "/Users/masa/Projects/eva-monorepo",
    "project_root": "eva-monorepo",
    "service": "mcp-cloud-bridge",
    "component": "slack-connector",
    "file_paths": [
      "/services/mcp-cloud-bridge/src/connectors/slack/connector.py",
      "/services/mcp-cloud-bridge/.env"
    ],
    "task_type": "integration",
    "status": "completed",
    "tags": ["eva-monorepo", "slack", "integration", "mcp-cloud-bridge"],
    "related_entities": ["divelement-workspace", "eva-assistant-bot"]
  }
}
```

### Memory Metadata Standards

Required fields for project memories:
- `project_path`: Full filesystem path
- `project_root`: Project name/identifier
- `service`: Which service/component
- `tags`: Array of searchable tags

Optional but recommended:
- `file_paths`: Specific files involved
- `task_type`: development|bug-fix|documentation|refactoring|integration
- `status`: pending|in-progress|completed|blocked
- `related_entities`: IDs of related entities
- `component`: Specific component within service

### Entity Creation

When creating entities for projects, people, or systems:

```json
{
  "name": "Slack Integration",
  "type": "project",
  "metadata": {
    "project_root": "eva-monorepo",
    "service": "mcp-cloud-bridge",
    "status": "active",
    "workspace": "divelement",
    "bot_name": "eva_assistant",
    "created_date": "2024-01-15",
    "tags": ["integration", "slack", "communication"]
  }
}
```

## Best Practices

### 1. Semantic Richness
Write memories with rich, descriptive content that will match semantic searches:
- ❌ "Fixed bug in Slack"
- ✅ "Fixed Socket Mode SSL certificate verification error in Slack connector by configuring proper SSL context with certifi"

### 2. Consistent Tagging
Use hierarchical tags for better organization:
- `eva-monorepo` (project level)
- `mcp-cloud-bridge` (service level)
- `slack-connector` (component level)
- `bug-fix` or `feature` (task type)

### 3. Cross-Reference Memories
Link related memories and entities:
- Reference memory IDs in metadata
- Create relationships between entities
- Update related memories when status changes

### 4. Task Lifecycle
Track task progress through memory updates:
1. Create task memory with `status: "pending"`
2. Update to `status: "in-progress"` when starting
3. Add progress memories linking to task ID
4. Update to `status: "completed"` with summary

### 5. Search First, Create Second
Always search before creating to avoid duplicates:
```
# Before creating an entity
Search entities for "Slack Integration project"

# Before adding a memory about a topic
Search memories for "Slack SSL certificate issue"
```

## Integration with Other Services

The memory service integrates with:
- **Event Hub**: For event-driven memory creation
- **Cloud Bridge**: For external service memories
- **Desktop Gateway**: For desktop interaction context
- **EVA Agent**: For autonomous memory management

## Troubleshooting

### "No memory tools available"
- Memory service must be configured in Claude Desktop config
- Service must be running: `make start-memory`
- Check logs: `make logs-memory`

### "Memory not found after saving"
- Vector indexing may take a few seconds
- Check MongoDB directly if needed
- Verify memory service is healthy

### "Cannot connect to memory service"
- Check MongoDB is running: `docker ps | grep mongo`
- Check Qdrant is running: `docker ps | grep qdrant`
- Verify service logs for errors

## Memory Service Configuration

The memory service configuration in Claude Desktop:

```json
{
  "mcpServers": {
    "memory": {
      "command": "/path/to/venv/bin/python",
      "args": ["/path/to/mcp-memory-service/run_production.py"],
      "cwd": "/path/to/mcp-memory-service",
      "env": {
        "PYTHONPATH": "...",
        "MCP_MODE": "1"
      }
    }
  }
}
```

## Important Notes

- **Privacy**: Memories are stored locally in your MongoDB instance
- **Persistence**: Memories persist across Claude sessions
- **Semantic Search**: Uses Qdrant vector database for intelligent retrieval
- **mem0 Framework**: Built on mem0 for standardized memory operations
- **No Direct DB Access**: Always use the service API, never access MongoDB/Qdrant directly