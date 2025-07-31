import path from "node:path";
import Ajv from "ajv";
import ajvFormats from "ajv-formats";
import fs from "fs-extra";
import { loggers } from "@/lib/logger";
import type { Tool, ToolsData } from "./schemas";

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
    status: { enum: ["active", "beta", "deprecated", "discontinued", "acquired", "inactive"] },
    company_id: { type: ["string", "null"] },
    launch_date: { type: ["string", "null"], format: "date" },
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
            language_support: { type: ["array", "null"], items: { type: "string" } },
            llm_providers: { type: ["array", "null"], items: { type: "string" } },
          },
          additionalProperties: true,
        },
        business: {
          type: "object",
          properties: {
            pricing_model: { type: ["string", "null"] },
            business_model: { type: ["string", "null"] },
            base_price: { type: ["number", "null"] },
            enterprise_pricing: { type: ["boolean", "null"] },
            free_tier: { type: ["boolean", "null"] },
            pricing_details: { type: ["object", "null"], additionalProperties: { type: "string" } },
          },
          additionalProperties: true,
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
              additionalProperties: true,
            },
            users: { type: ["number", "null"] },
            employees: { type: ["number", "null"] },
            funding: { type: ["number", "null"] },
          },
          additionalProperties: true,
        },
        company: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            website: { type: ["string", "null"] },
            founded: { type: ["string", "null"] },
            size: { type: ["string", "null"] },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    tags: { type: ["array", "null"], items: { type: "string" } },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
  additionalProperties: true,
};

const validateTool = ajv.compile(toolSchema);

/**
 * ToolsRepository that supports individual tool files
 * Each tool is stored in its own JSON file in the individual/ directory
 */
export class ToolsRepository {
  private static instance: ToolsRepository;
  private toolsDir: string;
  private individualDir: string;
  private indexFile: string;
  private logger = loggers.db;
  private cache: Map<string, Tool> = new Map();
  private indexData: ToolsData | null = null;

  constructor() {
    this.toolsDir = path.join(process.cwd(), "data", "json", "tools");
    this.individualDir = path.join(this.toolsDir, "individual");
    this.indexFile = path.join(this.toolsDir, "tools-index.json");
  }

  static getInstance(): ToolsRepository {
    if (!ToolsRepository.instance) {
      ToolsRepository.instance = new ToolsRepository();
    }
    return ToolsRepository.instance;
  }

  /**
   * Initialize the repository and load the index
   */
  async initialize(): Promise<void> {
    // Ensure directories exist
    await fs.ensureDir(this.individualDir);

    // Load or create index
    if (await fs.pathExists(this.indexFile)) {
      const indexData = await fs.readJson(this.indexFile);
      this.indexData = {
        tools: [], // Tools are loaded on demand
        index: indexData.index || { byId: {}, bySlug: {}, byCategory: {} },
        metadata: indexData.metadata || {
          total: 0,
          last_updated: new Date().toISOString(),
          version: "2.0.0",
        },
      };
    } else {
      // Create new index
      this.indexData = {
        tools: [],
        index: { byId: {}, bySlug: {}, byCategory: {} },
        metadata: {
          total: 0,
          last_updated: new Date().toISOString(),
          version: "2.0.0",
        },
      };
      await this.rebuildIndex();
    }
  }

  /**
   * Get data structure (loads all tools)
   */
  async getData(): Promise<ToolsData> {
    if (!this.indexData) {
      await this.initialize();
    }

    // Load all tools
    const tools = await this.getAll();

    return {
      tools,
      index: this.indexData?.index || { byId: {}, bySlug: {}, byCategory: {} },
      metadata: this.indexData?.metadata || {
        total: 0,
        last_updated: new Date().toISOString(),
        version: "2.0.0",
      },
    };
  }

  /**
   * Load a tool from its individual file
   */
  private async loadTool(slug: string): Promise<Tool | null> {
    // Check cache first
    if (this.cache.has(slug)) {
      return this.cache.get(slug)!;
    }

    const filepath = path.join(this.individualDir, `${slug}.json`);

    try {
      if (await fs.pathExists(filepath)) {
        const tool = (await fs.readJson(filepath)) as Tool;

        // Validate tool
        if (validateTool(tool)) {
          this.cache.set(slug, tool);
          return tool;
        } else {
          this.logger.error("Tool validation failed", {
            tool: slug,
            errors: validateTool.errors,
          });
        }
      }
    } catch (error) {
      this.logger.error("Failed to load tool", { slug, error });
    }

    return null;
  }

  /**
   * Save a tool to its individual file
   */
  private async saveTool(tool: Tool): Promise<void> {
    const filepath = path.join(this.individualDir, `${tool.slug}.json`);

    try {
      await fs.writeJson(filepath, tool, { spaces: 2 });
      this.cache.set(tool.slug, tool);
      this.logger.info("Tool saved", { slug: tool.slug });
    } catch (error) {
      this.logger.error("Failed to save tool", { slug: tool.slug, error });
      throw error;
    }
  }

  /**
   * Delete a tool file
   */
  private async deleteTool(slug: string): Promise<void> {
    const filepath = path.join(this.individualDir, `${slug}.json`);

    try {
      await fs.remove(filepath);
      this.cache.delete(slug);
      this.logger.info("Tool deleted", { slug });
    } catch (error) {
      this.logger.error("Failed to delete tool", { slug, error });
      throw error;
    }
  }

  /**
   * Save the index file
   */
  private async saveIndex(): Promise<void> {
    if (!this.indexData) return;

    try {
      await fs.writeJson(
        this.indexFile,
        {
          metadata: this.indexData.metadata,
          index: this.indexData.index,
          tools_directory: "individual",
        },
        { spaces: 2 }
      );

      this.logger.info("Index saved", {
        total: this.indexData.metadata.total,
      });
    } catch (error) {
      this.logger.error("Failed to save index", { error });
      throw error;
    }
  }

  /**
   * Rebuild the index from individual files
   */
  async rebuildIndex(): Promise<void> {
    this.logger.info("Rebuilding index from individual files...");

    if (!this.indexData) {
      await this.initialize();
    }

    // Clear existing index
    this.indexData!.index = {
      byId: {},
      bySlug: {},
      byCategory: {},
    };

    // Read all tool files
    const files = await fs.readdir(this.individualDir);
    const toolFiles = files.filter((f) => f.endsWith(".json"));

    let totalTools = 0;

    for (const file of toolFiles) {
      const slug = path.basename(file, ".json");
      const tool = await this.loadTool(slug);

      if (tool) {
        // Update indices
        if (this.indexData) {
          this.indexData.index.byId[tool.id] = tool;
          this.indexData.index.bySlug[tool.slug] = tool;

          if (!this.indexData.index.byCategory[tool.category]) {
            this.indexData.index.byCategory[tool.category] = [];
          }
          const categoryArray = this.indexData.index.byCategory[tool.category];
          if (categoryArray) {
            categoryArray.push(tool.id);
          }
        }

        totalTools++;
      }
    }

    // Update metadata
    if (this.indexData) {
      this.indexData.metadata.total = totalTools;
      this.indexData.metadata.last_updated = new Date().toISOString();
    }

    // Save the updated index
    await this.saveIndex();

    this.logger.info("Index rebuilt", {
      total: totalTools,
      categories: Object.keys(this.indexData?.index.byCategory || {}).length,
    });
  }

  /**
   * Get all tools
   */
  async getAll(): Promise<Tool[]> {
    if (!this.indexData) {
      await this.initialize();
    }

    const tools: Tool[] = [];

    // Load each tool from the index
    for (const slug of Object.keys(this.indexData?.index.bySlug || {})) {
      const tool = await this.loadTool(slug);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Get tool by ID
   */
  async getById(id: string): Promise<Tool | null> {
    if (!this.indexData) {
      await this.initialize();
    }

    const toolRef = this.indexData?.index.byId[id];
    if (toolRef?.slug) {
      return await this.loadTool(toolRef.slug);
    }

    return null;
  }

  /**
   * Get tool by slug
   */
  async getBySlug(slug: string): Promise<Tool | null> {
    return await this.loadTool(slug);
  }

  /**
   * Get tools by category
   */
  async getByCategory(category: string): Promise<Tool[]> {
    if (!this.indexData) {
      await this.initialize();
    }

    const toolIds = this.indexData?.index.byCategory[category] || [];
    const tools: Tool[] = [];

    for (const id of toolIds) {
      const toolRef = this.indexData?.index.byId[id];
      if (toolRef?.slug) {
        const tool = await this.loadTool(toolRef.slug);
        if (tool) {
          tools.push(tool);
        }
      }
    }

    return tools;
  }

  /**
   * Get tools by status
   */
  async getByStatus(status: "active" | "inactive" | "deprecated"): Promise<Tool[]> {
    const allTools = await this.getAll();
    return allTools.filter((tool) => tool.status === status);
  }

  /**
   * Add or update a tool
   */
  async upsert(tool: Tool): Promise<void> {
    if (!this.indexData) {
      await this.initialize();
    }

    // Validate tool
    if (!validateTool(tool)) {
      throw new Error(`Invalid tool data: ${JSON.stringify(validateTool.errors)}`);
    }

    // Save the tool file
    await this.saveTool(tool);

    // Update indices
    if (this.indexData) {
      this.indexData.index.byId[tool.id] = tool;
      this.indexData.index.bySlug[tool.slug] = tool;

      // Update category index
      if (!this.indexData.index.byCategory[tool.category]) {
        this.indexData.index.byCategory[tool.category] = [];
      }
      const categoryTools = this.indexData.index.byCategory[tool.category];
      if (categoryTools && !categoryTools.includes(tool.id)) {
        categoryTools.push(tool.id);
      }

      // Update metadata
      this.indexData.metadata.total = Object.keys(this.indexData.index.byId).length;
      this.indexData.metadata.last_updated = new Date().toISOString();
    }

    // Save the index
    await this.saveIndex();
  }

  /**
   * Delete a tool
   */
  async delete(id: string): Promise<boolean> {
    if (!this.indexData) {
      await this.initialize();
    }

    const toolRef = this.indexData?.index.byId[id];
    if (!toolRef || !toolRef.slug) {
      return false;
    }

    const tool = await this.loadTool(toolRef.slug);
    if (!tool) {
      return false;
    }

    // Delete the tool file
    await this.deleteTool(tool.slug);

    // Remove from indices
    if (this.indexData) {
      delete this.indexData.index.byId[id];
      delete this.indexData.index.bySlug[tool.slug];

      // Remove from category index
      if (this.indexData.index.byCategory[tool.category]) {
        const categoryTools = this.indexData.index.byCategory[tool.category];
        if (categoryTools) {
          const index = categoryTools.indexOf(id);
          if (index !== -1) {
            categoryTools.splice(index, 1);
          }

          // Remove empty category
          if (categoryTools.length === 0) {
            delete this.indexData.index.byCategory[tool.category];
          }
        }
      }

      // Update metadata
      this.indexData.metadata.total = Object.keys(this.indexData.index.byId).length;
      this.indexData.metadata.last_updated = new Date().toISOString();
    }

    // Save the index
    await this.saveIndex();

    return true;
  }

  /**
   * Search tools
   */
  async search(query: string): Promise<Tool[]> {
    const allTools = await this.getAll();
    const searchTerm = query.toLowerCase();

    return allTools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(searchTerm) ||
        tool.info.summary.toLowerCase().includes(searchTerm) ||
        tool.info.description.toLowerCase().includes(searchTerm) ||
        tool.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Get categories with counts
   */
  async getCategoriesWithCounts(): Promise<Record<string, number>> {
    if (!this.indexData) {
      await this.initialize();
    }

    const counts: Record<string, number> = {};

    for (const [category, toolIds] of Object.entries(this.indexData?.index.byCategory || {})) {
      counts[category] = toolIds.length;
    }

    return counts;
  }

  /**
   * Get file size information
   */
  async getFileSize(): Promise<number> {
    // Calculate total size of all tool files
    let totalSize = 0;

    const files = await fs.readdir(this.individualDir);
    const toolFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of toolFiles) {
      const filepath = path.join(this.individualDir, file);
      const stats = await fs.stat(filepath);
      totalSize += stats.size;
    }

    // Add index file size
    if (await fs.pathExists(this.indexFile)) {
      const indexStats = await fs.stat(this.indexFile);
      totalSize += indexStats.size;
    }

    return totalSize;
  }

  /**
   * Validate all tools
   */
  async validate(): Promise<boolean> {
    const tools = await this.getAll();
    let isValid = true;

    for (const tool of tools) {
      if (!validateTool(tool)) {
        this.logger.error("Tool validation failed", {
          tool: tool.id,
          errors: validateTool.errors,
        });
        isValid = false;
      }
    }

    return isValid;
  }

  /**
   * Create backup of all tools
   */
  async backup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(this.toolsDir, "backups");
    const backupPath = path.join(backupDir, `tools-backup-${timestamp}`);

    try {
      // Ensure backup directory exists
      await fs.ensureDir(backupDir);

      // Copy individual files directory
      await fs.copy(this.individualDir, path.join(backupPath, "individual"));

      // Copy index file
      await fs.copy(this.indexFile, path.join(backupPath, "tools-index.json"));

      this.logger.info("Backup created", { path: backupPath });
      return backupPath;
    } catch (error) {
      this.logger.error("Failed to create backup", { error });
      throw error;
    }
  }
}
