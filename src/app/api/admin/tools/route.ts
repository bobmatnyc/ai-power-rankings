/**
 * Consolidated Admin Tool Management API
 *
 * Endpoints:
 * - GET: Check tool existence, get tool details, or list tools
 * - POST: Update tool data, refresh display, or perform cleanup
 * - DELETE: Delete tools
 * - PUT: Quick fixes and updates
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";

interface ToolCheckResult {
  foundBySlug: boolean;
  foundByName: boolean;
  tool: any | null;
}

// Extended Tool type with additional properties that may exist in the data
interface ExtendedTool {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  display_name?: string;
  company_info?: {
    name?: string;
    website?: string;
    founded?: string | null;
    employees?: string | null;
    funding?: number | null;
    valuation?: number | null;
    size?: string;
  };
  company?: string;
  website?: string;
  company_id?: string;
  tool_mentions?: string[];
}

/**
 * GET /api/admin/tools
 *
 * Query params:
 * - action: 'check-exist' | 'list' | 'cleanup-auto'
 * - tools: comma-separated tool names for check-exist
 * - status: filter by status for list action
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }
  const { userId } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";
    const toolsRepo = new ToolsRepository();

    switch (action) {
      case "check-exist": {
        // Check if specific tools exist (replaces check-tools-exist)
        const toolsParam = searchParams.get("tools");
        const toolsToCheck = toolsParam
          ? toolsParam.split(",").map((t) => t.trim())
          : ["gemini", "chatgpt"];

        const results: Record<string, ToolCheckResult> = {};

        for (const toolName of toolsToCheck) {
          const bySlug = await toolsRepo.findBySlug(toolName);
          const allTools = await toolsRepo.findAll();
          const byName = allTools.find(
            (tool) => tool.name.toLowerCase() === toolName.toLowerCase()
          );

          results[toolName] = {
            foundBySlug: !!bySlug,
            foundByName: !!byName,
            tool: bySlug || byName || null,
          };
        }

        return NextResponse.json(results);
      }

      case "cleanup-auto": {
        // Find and list auto-generated tools (replaces cleanup-auto-tools GET)
        const tools = await toolsRepo.findAll();
        const autoTools = tools.filter(
          (tool) =>
            tool.id.startsWith("auto_") ||
            tool.slug.includes("auto-generated") ||
            tool.name.includes("(Auto)")
        );

        return NextResponse.json({
          total: autoTools.length,
          tools: autoTools.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            status: t.status,
            created_at: t.created_at,
          })),
        });
      }

      default: {
        // List tools with optional status filter
        const status = searchParams.get("status");
        const tools = status
          ? await toolsRepo.findByStatus(status as "active" | "deprecated" | "inactive")
          : await toolsRepo.findAll();

        return NextResponse.json({
          total: tools.length,
          tools,
        });
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    loggers.api.error("Error in admin/tools GET", { error, userId });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/admin/tools
 *
 * Actions:
 * - delete: Delete multiple tools
 * - refresh-display: Refresh tool display data
 * - cleanup-auto: Delete auto-generated tools
 * - update-company: Update company data for a tool
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { action } = body;
    const toolsRepo = new ToolsRepository();
    const articlesRepo = new ArticlesRepository();

    switch (action) {
      case "delete": {
        // Delete multiple tools (replaces delete-tools)
        const { toolIds } = body;

        if (!Array.isArray(toolIds) || toolIds.length === 0) {
          return NextResponse.json({ error: "toolIds array is required" }, { status: 400 });
        }

        const deletedTools = [];
        const errors = [];

        for (const toolId of toolIds) {
          try {
            const tool = await toolsRepo.findById(toolId);

            if (!tool) {
              errors.push(`Tool with ID ${toolId} not found`);
              continue;
            }

            // Remove references from news articles
            try {
              const articlesWithTool = await articlesRepo.findByToolMention(toolId);
              for (const article of articlesWithTool) {
                const updatedToolMentions = article.tool_mentions?.filter((id) => id !== toolId) || [];
                await articlesRepo.updateArticle(article.id, {
                  tool_mentions: updatedToolMentions,
                });
              }
            } catch (dbError) {
              // If database is unavailable, continue with tool deletion
              loggers.api.warn("Could not update articles - database unavailable", { dbError });
            }

            loggers.api.warn(
              `Deleting tool ${tool.name} - rankings and metrics may need manual cleanup`
            );

            const deleted = await toolsRepo.deleteById(toolId);

            if (deleted) {
              deletedTools.push({
                id: tool.id,
                slug: tool.slug,
                name: tool.name,
              });
              loggers.api.info(`Deleted tool: ${tool.name} (${tool.slug})`);
            } else {
              errors.push(`Failed to delete tool ${tool.name}`);
            }
          } catch (deleteError) {
            const errorMsg = `Failed to delete tool ID ${toolId}: ${
              deleteError instanceof Error ? deleteError.message : "Unknown error"
            }`;
            errors.push(errorMsg);
            loggers.api.error(errorMsg, { error: deleteError });
          }
        }

        return NextResponse.json({
          message: `Successfully deleted ${deletedTools.length} tools`,
          deletedTools,
          errors,
          totalRequested: toolIds.length,
        });
      }

      case "refresh-display": {
        // Refresh tool display names (replaces refresh-tool-display)
        const { toolId } = body;

        if (!toolId) {
          return NextResponse.json({ error: "toolId is required" }, { status: 400 });
        }

        const tool = await toolsRepo.findById(toolId);
        if (!tool) {
          return NextResponse.json({ error: `Tool ${toolId} not found` }, { status: 404 });
        }

        // Update display_name if needed
        const extendedTool = tool as ExtendedTool;
        const updatedTool = {
          ...tool,
          display_name: extendedTool.display_name || tool.name,
          updated_at: new Date().toISOString(),
        };

        await toolsRepo.update(toolId, updatedTool);

        return NextResponse.json({
          success: true,
          tool: updatedTool,
        });
      }

      case "cleanup-auto": {
        // Delete auto-generated tools (replaces cleanup-auto-tools POST)
        const tools = await toolsRepo.findAll();
        const autoTools = tools.filter(
          (tool) =>
            tool.id.startsWith("auto_") ||
            tool.slug.includes("auto-generated") ||
            tool.name.includes("(Auto)")
        );

        const deletedTools = [];
        const errors = [];

        for (const tool of autoTools) {
          try {
            const deleted = await toolsRepo.deleteById(tool.id);
            if (deleted) {
              deletedTools.push({
                id: tool.id,
                slug: tool.slug,
                name: tool.name,
              });
              loggers.api.info(`Deleted auto-generated tool: ${tool.name}`);
            }
          } catch (error) {
            errors.push(`Failed to delete ${tool.name}: ${error}`);
          }
        }

        return NextResponse.json({
          message: `Cleaned up ${deletedTools.length} auto-generated tools`,
          deletedTools,
          errors,
        });
      }

      case "update-company": {
        // Update company data for a tool (replaces update-company)
        const { toolId, companyData } = body;

        if (!toolId || !companyData) {
          return NextResponse.json(
            { error: "toolId and companyData are required" },
            { status: 400 }
          );
        }

        const tool = await toolsRepo.findById(toolId);
        if (!tool) {
          return NextResponse.json({ error: `Tool ${toolId} not found` }, { status: 404 });
        }

        const extendedTool = tool as ExtendedTool;
        const updatedTool = {
          ...tool,
          company_info: {
            ...extendedTool.company_info,
            ...companyData,
          },
          updated_at: new Date().toISOString(),
        };

        await toolsRepo.update(toolId, updatedTool);

        return NextResponse.json({
          success: true,
          tool: updatedTool,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    loggers.api.error("Error in admin/tools POST", { error, userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/tools
 *
 * Delete a single tool by ID
 */
export async function DELETE(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }
  const { userId } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get("id");

    if (!toolId) {
      return NextResponse.json({ error: "Tool ID is required" }, { status: 400 });
    }

    const toolsRepo = new ToolsRepository();
    const articlesRepo = new ArticlesRepository();

    const tool = await toolsRepo.getById(toolId);
    if (!tool) {
      return NextResponse.json({ error: `Tool ${toolId} not found` }, { status: 404 });
    }

    // Remove from news articles
    try {
      const articlesWithTool = await articlesRepo.findByToolMention(toolId);
      for (const article of articlesWithTool) {
        const updatedToolMentions = article.tool_mentions?.filter((id) => id !== toolId) || [];
        await articlesRepo.updateArticle(article.id, {
          tool_mentions: updatedToolMentions,
        });
      }
    } catch (dbError) {
      // If database is unavailable, continue with tool deletion
      loggers.api.warn("Could not update articles - database unavailable", { dbError });
    }

    const deleted = await toolsRepo.deleteById(toolId);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: `Successfully deleted tool ${tool.name}`,
        tool: {
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
        },
      });
    } else {
      return NextResponse.json({ error: "Failed to delete tool" }, { status: 500 });
    }
  } catch (error) {
    loggers.api.error("Error in admin/tools DELETE", { error, userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/tools
 *
 * Quick fix and update operations
 */
export async function PUT(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { action } = body;
    const toolsRepo = new ToolsRepository();

    switch (action) {
      case "quick-fix-display": {
        // Quick fix for tool display issues (replaces quick-fix-tool-display)
        const tools = await toolsRepo.findAll();
        const fixedTools = [];

        for (const tool of tools) {
          const extendedTool = tool as ExtendedTool;
          if (!extendedTool.display_name || extendedTool.display_name === tool.id) {
            const updatedTool = {
              ...tool,
              display_name: tool.name,
              updated_at: new Date().toISOString(),
            };
            await toolsRepo.update(tool.id, updatedTool);
            fixedTools.push({
              id: tool.id,
              name: tool.name,
              display_name: updatedTool.display_name,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Fixed display names for ${fixedTools.length} tools`,
          fixedTools,
        });
      }

      case "update-missing-company": {
        // Update missing company data (replaces update-missing-company-data)
        const tools = await toolsRepo.findAll();
        const updatedTools = [];

        for (const tool of tools) {
          const extendedTool = tool as ExtendedTool;
          if (!extendedTool.company_info || Object.keys(extendedTool.company_info).length === 0) {
            const companyInfo = {
              name: extendedTool.company || tool.name,
              website: extendedTool.website || "",
              founded: null,
              employees: null,
              funding: null,
              valuation: null,
            };

            const updatedTool = {
              ...tool,
              company_info: companyInfo,
              updated_at: new Date().toISOString(),
            };

            await toolsRepo.update(tool.id, updatedTool);
            updatedTools.push({
              id: tool.id,
              name: tool.name,
              company_info: companyInfo,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Updated company data for ${updatedTools.length} tools`,
          updatedTools,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    loggers.api.error("Error in admin/tools PUT", { error, userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
