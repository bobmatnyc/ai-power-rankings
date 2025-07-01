import { BaseRepository } from "./base-repository";
import { Tool, ToolsData } from "./schemas";
import path from "path";
import Ajv from "ajv";
import ajvFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
ajvFormats(ajv);

const toolSchema = {
  type: "object",
  required: ["id", "slug", "name", "category", "status", "info", "created_at", "updated_at"],
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    status: { enum: ["active", "inactive", "deprecated"] },
    company_id: { type: ["string", "null"] },
    launch_date: { type: ["string", "null"], format: "date" }, // Optional launch date
    info: {
      type: "object",
      required: ["summary", "description", "website", "features"],
      properties: {
        summary: { type: "string" },
        description: { type: "string" },
        website: { type: "string", format: "uri" },
        features: { type: "array", items: { type: "string" } },
        technical: {
          type: "object",
          properties: {
            context_window: { type: ["number", "null"] },
            supported_languages: { type: ["number", "null"] },
            has_api: { type: ["boolean", "null"] },
            multi_file_support: { type: ["boolean", "null"] },
            languages: { type: ["array", "null"], items: { type: "string" } },
          },
        },
        business: {
          type: "object",
          properties: {
            pricing_model: { type: ["string", "null"] },
            business_model: { type: ["string", "null"] },
            base_price: { type: ["number", "null"] },
            enterprise_pricing: { type: ["boolean", "null"] },
          },
        },
        metrics: {
          type: "object",
          properties: {
            github_stars: { type: ["number", "null"] },
            github_contributors: { type: ["number", "null"] },
            estimated_users: { type: ["number", "null"] },
            monthly_arr: { type: ["number", "null"] },
            valuation: { type: ["number", "null"] },
            funding_total: { type: ["number", "null"] },
            last_funding_date: { type: ["string", "null"], format: "date" },
            swe_bench_score: { type: ["number", "null"] },
            swe_bench: {
              type: "object",
              properties: {
                verified: { type: ["number", "null"] },
                verified_basic: { type: ["number", "null"] },
                lite: { type: ["number", "null"] },
                full: { type: ["number", "null"] },
                date: { type: ["string", "null"] },
                source: { type: ["string", "null"] },
                model: { type: ["string", "null"] },
                note: { type: ["string", "null"] },
                methodology: { type: ["string", "null"] },
                achievement: { type: ["string", "null"] },
                context: { type: ["string", "null"] },
                updates: { type: ["string", "null"] },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    },
    tags: { type: ["array", "null"], items: { type: "string" } },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
};

const validateTool = ajv.compile(toolSchema);

export class ToolsRepository extends BaseRepository<ToolsData> {
  private static instance: ToolsRepository;

  constructor() {
    const filePath = path.join(process.cwd(), "data", "json", "tools", "tools.json");
    const defaultData: ToolsData = {
      tools: [],
      index: {
        byId: {},
        bySlug: {},
        byCategory: {},
      },
      metadata: {
        total: 0,
        last_updated: new Date().toISOString(),
        version: "1.0.0",
      },
    };

    super(filePath, defaultData);
  }

  static getInstance(): ToolsRepository {
    if (!ToolsRepository.instance) {
      ToolsRepository.instance = new ToolsRepository();
    }
    return ToolsRepository.instance;
  }

  async validate(data: ToolsData): Promise<boolean> {
    // Validate each tool
    for (const tool of data.tools) {
      if (!validateTool(tool)) {
        this.logger.error("Tool validation failed", {
          tool: tool.id,
          errors: validateTool.errors,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Get all tools
   */
  async getAll(): Promise<Tool[]> {
    const data = await this.getData();
    return data.tools;
  }

  /**
   * Get tool by ID
   */
  async getById(id: string): Promise<Tool | null> {
    const data = await this.getData();
    return data.index.byId[id] || null;
  }

  /**
   * Get tool by slug
   */
  async getBySlug(slug: string): Promise<Tool | null> {
    const data = await this.getData();
    return data.index.bySlug[slug] || null;
  }

  /**
   * Get tools by category
   */
  async getByCategory(category: string): Promise<Tool[]> {
    const data = await this.getData();
    const toolIds = data.index.byCategory[category] || [];
    return toolIds.map((id) => data.index.byId[id]).filter((tool): tool is Tool => Boolean(tool));
  }

  /**
   * Get tools by status
   */
  async getByStatus(status: "active" | "inactive" | "deprecated"): Promise<Tool[]> {
    const data = await this.getData();
    return data.tools.filter((tool) => tool.status === status);
  }

  /**
   * Add or update a tool
   */
  async upsert(tool: Tool): Promise<void> {
    await this.update(async (data) => {
      // Remove existing tool if updating
      const existingIndex = data.tools.findIndex((t) => t.id === tool.id);
      if (existingIndex !== -1) {
        data.tools[existingIndex] = tool;
      } else {
        data.tools.push(tool);
      }

      // Rebuild indices
      this.rebuildIndices(data);
    });
  }

  /**
   * Delete a tool
   */
  async delete(id: string): Promise<boolean> {
    let deleted = false;

    await this.update(async (data) => {
      const index = data.tools.findIndex((t) => t.id === id);
      if (index !== -1) {
        data.tools.splice(index, 1);
        this.rebuildIndices(data);
        deleted = true;
      }
    });

    return deleted;
  }

  /**
   * Search tools
   */
  async search(query: string): Promise<Tool[]> {
    const data = await this.getData();
    const searchTerm = query.toLowerCase();

    return data.tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(searchTerm) ||
        tool.info.summary.toLowerCase().includes(searchTerm) ||
        tool.info.description.toLowerCase().includes(searchTerm) ||
        (tool.tags && tool.tags.some((tag) => tag.toLowerCase().includes(searchTerm)))
    );
  }

  /**
   * Rebuild all indices
   */
  private rebuildIndices(data: ToolsData): void {
    // Clear indices
    data.index.byId = {};
    data.index.bySlug = {};
    data.index.byCategory = {};

    // Rebuild
    for (const tool of data.tools) {
      data.index.byId[tool.id] = tool;
      data.index.bySlug[tool.slug] = tool;

      if (!data.index.byCategory[tool.category]) {
        data.index.byCategory[tool.category] = [];
      }
      data.index.byCategory[tool.category]!.push(tool.id);
    }

    // Update metadata
    data.metadata.total = data.tools.length;
    data.metadata.last_updated = new Date().toISOString();
  }

  /**
   * Get categories with counts
   */
  async getCategoriesWithCounts(): Promise<Record<string, number>> {
    const data = await this.getData();
    const counts: Record<string, number> = {};

    for (const [category, toolIds] of Object.entries(data.index.byCategory)) {
      counts[category] = toolIds.length;
    }

    return counts;
  }

  /**
   * Force rebuild indices (useful for fixing corrupted indices)
   */
  async forceRebuildIndices(): Promise<void> {
    await this.update(async (data) => {
      this.rebuildIndices(data);
    });
  }
}
