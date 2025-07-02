import { BaseRepository } from "./base-repository";
import type { SiteSettings, SiteSettingsData } from "./schemas";
import path from "path";
import Ajv from "ajv";
import ajvFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
ajvFormats(ajv);

const siteSettingsSchema = {
  type: "object",
  required: [
    "id",
    "site_name",
    "description",
    "contact_email",
    "algorithm_version",
    "created_at",
    "updated_at",
  ],
  properties: {
    id: { type: "string", enum: ["settings"] },
    site_name: { type: "string" },
    description: { type: "string" },
    contact_email: { type: "string", format: "email" },
    algorithm_version: { type: "string" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
};

const validateSiteSettings = ajv.compile(siteSettingsSchema);

export class SiteSettingsRepository extends BaseRepository<SiteSettingsData> {
  private static instance: SiteSettingsRepository;

  constructor() {
    const filePath = path.join(process.cwd(), "data", "json", "settings", "site-settings.json");
    const defaultData: SiteSettingsData = {
      settings: {
        id: "settings",
        site_name: "AI Power Ranking",
        description: "The comprehensive ranking of AI coding tools",
        contact_email: "contact@aipowerranking.com",
        algorithm_version: "v6.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      metadata: {
        last_updated: new Date().toISOString(),
        version: "1.0.0",
      },
    };

    super(filePath, defaultData);
  }

  static getInstance(): SiteSettingsRepository {
    if (!SiteSettingsRepository.instance) {
      SiteSettingsRepository.instance = new SiteSettingsRepository();
    }
    return SiteSettingsRepository.instance;
  }

  async validate(data: SiteSettingsData): Promise<boolean> {
    if (!validateSiteSettings(data.settings)) {
      this.logger.error("Site settings validation failed", {
        errors: validateSiteSettings.errors,
      });
      return false;
    }

    return true;
  }

  /**
   * Get site settings
   */
  async getSettings(): Promise<SiteSettings> {
    const data = await this.getData();
    return data.settings;
  }

  /**
   * Update site settings
   */
  async updateSettings(
    updates: Partial<Omit<SiteSettings, "id" | "created_at">>
  ): Promise<SiteSettings> {
    let updatedSettings: SiteSettings | null = null;

    await this.update(async (data) => {
      updatedSettings = {
        ...data.settings,
        ...updates,
        id: "settings",
        updated_at: new Date().toISOString(),
      };

      data.settings = updatedSettings;
      data.metadata.last_updated = new Date().toISOString();
    });

    return updatedSettings!;
  }

  /**
   * Get algorithm version
   */
  async getAlgorithmVersion(): Promise<string> {
    const settings = await this.getSettings();
    return settings.algorithm_version;
  }

  /**
   * Update algorithm version
   */
  async updateAlgorithmVersion(version: string): Promise<SiteSettings> {
    return this.updateSettings({ algorithm_version: version });
  }
}
