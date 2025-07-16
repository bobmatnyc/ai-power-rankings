import crypto from "node:crypto";
import path from "node:path";
import Ajv from "ajv";
import ajvFormats from "ajv-formats";
import { BaseRepository } from "./base-repository";
import type { Subscriber, SubscribersData } from "./schemas";

const ajv = new Ajv({ allErrors: true });
ajvFormats(ajv);

const subscriberSchema = {
  type: "object",
  required: ["id", "email", "status", "created_at", "updated_at"],
  properties: {
    id: { type: "string" },
    email: { type: "string", format: "email" },
    status: { enum: ["pending", "verified", "unsubscribed"] },
    verification_token: { type: ["string", "null"] },
    verified_at: { type: ["string", "null"], format: "date-time" },
    unsubscribed_at: { type: ["string", "null"], format: "date-time" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    preferences: {
      type: ["object", "null"],
      properties: {
        frequency: { type: ["string", "null"] },
        categories: { type: ["array", "null"], items: { type: "string" } },
      },
    },
    metadata: {
      type: ["object", "null"],
      properties: {
        source: { type: ["string", "null"] },
        user_agent: { type: ["string", "null"] },
        ip_address: { type: ["string", "null"] },
      },
    },
  },
};

const validateSubscriber = ajv.compile(subscriberSchema);

export class SubscribersRepository extends BaseRepository<SubscribersData> {
  private static instance: SubscribersRepository;
  private useBlob: boolean;
  private blobKey = "subscribers.json";

  constructor() {
    const filePath = path.join(process.cwd(), "data", "json", "subscribers", "subscribers.json");
    const defaultData: SubscribersData = {
      subscribers: [],
      index: {
        byId: {},
        byEmail: {},
        byStatus: {
          pending: [],
          verified: [],
          unsubscribed: [],
        },
      },
      metadata: {
        total: 0,
        verified: 0,
        pending: 0,
        unsubscribed: 0,
        last_updated: new Date().toISOString(),
        version: "1.0.0",
      },
    };

    super(filePath, defaultData);

    // Use blob storage in production, local files in development
    this.useBlob = process.env.NODE_ENV === "production" && !!process.env.BLOB_READ_WRITE_TOKEN;
  }

  static getInstance(): SubscribersRepository {
    if (!SubscribersRepository.instance) {
      SubscribersRepository.instance = new SubscribersRepository();
    }
    return SubscribersRepository.instance;
  }

  /**
   * Get default data structure
   */
  private getDefaultData(): SubscribersData {
    return {
      subscribers: [],
      index: {
        byId: {},
        byEmail: {},
        byStatus: {
          pending: [],
          verified: [],
          unsubscribed: [],
        },
      },
      metadata: {
        total: 0,
        verified: 0,
        pending: 0,
        unsubscribed: 0,
        last_updated: new Date().toISOString(),
        version: "1.0.0",
      },
    };
  }

  /**
   * Override getData to support blob storage
   */
  override async getData(): Promise<SubscribersData> {
    if (this.useBlob) {
      return this.getFromBlob();
    }
    return super.getData();
  }

  /**
   * Override write to support blob storage
   */
  protected override async write(): Promise<void> {
    if (this.useBlob) {
      return this.writeToBlob();
    }
    return super.write();
  }

  /**
   * Get data from Vercel Blob
   */
  private async getFromBlob(): Promise<SubscribersData> {
    try {
      const { list } = await import("@vercel/blob");
      const blobs = await list({ prefix: this.blobKey });

      if (blobs.blobs.length === 0) {
        this.logger.info("No blob found, using default data");
        return this.getDefaultData();
      }

      const blob = blobs.blobs[0];
      if (!blob) {
        this.logger.info("No blob found, using default data");
        return this.getDefaultData();
      }

      const response = await fetch(blob.url);
      const text = await response.text();

      const data = JSON.parse(text) as SubscribersData;

      // Validate the data
      if (await this.validate(data)) {
        return data;
      } else {
        this.logger.error("Invalid data from blob, using default");
        return this.getDefaultData();
      }
    } catch (error) {
      this.logger.error("Failed to read from blob", { error });
      return this.getDefaultData();
    }
  }

  /**
   * Write data to Vercel Blob
   */
  private async writeToBlob(): Promise<void> {
    try {
      const { put } = await import("@vercel/blob");
      const data = await super.getData();
      const jsonString = JSON.stringify(data, null, 2);

      await put(this.blobKey, jsonString, {
        access: "public",
        contentType: "application/json",
      });

      this.logger.info("Successfully wrote to blob");
    } catch (error) {
      this.logger.error("Failed to write to blob", { error });
      throw error;
    }
  }

  async validate(data: SubscribersData): Promise<boolean> {
    // Validate each subscriber
    for (const subscriber of data.subscribers) {
      if (!validateSubscriber(subscriber)) {
        this.logger.error("Subscriber validation failed", {
          subscriber: subscriber.id,
          errors: validateSubscriber.errors,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Get all subscribers
   */
  async getAll(): Promise<Subscriber[]> {
    const data = await this.getData();
    return data.subscribers;
  }

  /**
   * Get subscriber by ID
   */
  async getById(id: string): Promise<Subscriber | null> {
    const data = await this.getData();
    return data.index.byId[id] || null;
  }

  /**
   * Get subscriber by email
   */
  async getByEmail(email: string): Promise<Subscriber | null> {
    const data = await this.getData();
    return data.index.byEmail[email.toLowerCase()] || null;
  }

  /**
   * Get subscribers by status
   */
  async getByStatus(status: "pending" | "verified" | "unsubscribed"): Promise<Subscriber[]> {
    const data = await this.getData();
    const subscriberIds = data.index.byStatus[status] || [];
    return subscriberIds.map((id) => data.index.byId[id]).filter((s): s is Subscriber => !!s);
  }

  /**
   * Create a new subscriber
   */
  async create(
    subscriberData: Omit<Subscriber, "id" | "created_at" | "updated_at">
  ): Promise<Subscriber> {
    const now = new Date().toISOString();
    const subscriber: Subscriber = {
      ...subscriberData,
      id: crypto.randomUUID(),
      email: subscriberData.email.toLowerCase(),
      created_at: now,
      updated_at: now,
    };

    await this.update(async (data) => {
      // Check for duplicate email
      if (data.index.byEmail[subscriber.email]) {
        throw new Error("Email already exists");
      }

      data.subscribers.push(subscriber);
      this.rebuildIndices(data);
    });

    return subscriber;
  }

  /**
   * Update subscriber
   */
  async updateSubscriber(id: string, updates: Partial<Subscriber>): Promise<Subscriber | null> {
    let updatedSubscriber: Subscriber | null = null;

    await this.update(async (data) => {
      const index = data.subscribers.findIndex((s) => s.id === id);
      if (index === -1) {
        return;
      }

      const subscriber = data.subscribers[index];
      if (subscriber) {
        updatedSubscriber = {
          ...subscriber,
          ...updates,
          id: subscriber.id, // Never allow ID to be changed
          email: subscriber.email, // Ensure email is always present
          updated_at: new Date().toISOString(),
        };

        data.subscribers[index] = updatedSubscriber;
        this.rebuildIndices(data);
      }
    });

    return updatedSubscriber;
  }

  /**
   * Verify subscriber with token
   */
  async verifyWithToken(token: string): Promise<Subscriber | null> {
    let verifiedSubscriber: Subscriber | null = null;

    await this.update(async (data) => {
      const subscriber = data.subscribers.find((s) => s.verification_token === token);
      if (subscriber) {
        subscriber.status = "verified";
        subscriber.verified_at = new Date().toISOString();
        subscriber.verification_token = undefined;
        subscriber.updated_at = new Date().toISOString();

        verifiedSubscriber = subscriber;
        this.rebuildIndices(data);
      }
    });

    return verifiedSubscriber;
  }

  /**
   * Unsubscribe by email
   */
  async unsubscribe(email: string): Promise<boolean> {
    let found = false;

    await this.update(async (data) => {
      const subscriber = data.index.byEmail[email.toLowerCase()];
      if (!subscriber) {
        return;
      }

      subscriber.status = "unsubscribed";
      subscriber.unsubscribed_at = new Date().toISOString();
      subscriber.updated_at = new Date().toISOString();

      found = true;
      this.rebuildIndices(data);
    });

    return found;
  }

  /**
   * Delete subscriber permanently
   */
  async delete(id: string): Promise<boolean> {
    let deleted = false;

    await this.update(async (data) => {
      const index = data.subscribers.findIndex((s) => s.id === id);
      if (index !== -1) {
        data.subscribers.splice(index, 1);
        this.rebuildIndices(data);
        deleted = true;
      }
    });

    return deleted;
  }

  /**
   * Generate verification token
   */
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    verified: number;
    pending: number;
    unsubscribed: number;
    growth: {
      last_30_days: number;
      last_7_days: number;
    };
  }> {
    const data = await this.getData();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const last30Days = data.subscribers.filter(
      (s) => new Date(s.created_at) >= thirtyDaysAgo && s.status === "verified"
    ).length;

    const last7Days = data.subscribers.filter(
      (s) => new Date(s.created_at) >= sevenDaysAgo && s.status === "verified"
    ).length;

    return {
      total: data.metadata.total,
      verified: data.metadata.verified,
      pending: data.metadata.pending,
      unsubscribed: data.metadata.unsubscribed,
      growth: {
        last_30_days: last30Days,
        last_7_days: last7Days,
      },
    };
  }

  /**
   * Export subscribers as CSV data
   */
  async exportToCsv(): Promise<string> {
    const data = await this.getData();
    const verified = data.subscribers.filter((s) => s.status === "verified");

    const csvHeader = "Email,Status,Verified At,Created At,Preferences\n";
    const csvRows = verified
      .map((s) => {
        const preferences = s.preferences ? JSON.stringify(s.preferences) : "";
        return `"${s.email}","${s.status}","${s.verified_at || ""}","${s.created_at}","${preferences}"`;
      })
      .join("\n");

    return csvHeader + csvRows;
  }

  /**
   * Rebuild all indices
   */
  private rebuildIndices(data: SubscribersData): void {
    // Clear indices
    data.index.byId = {};
    data.index.byEmail = {};
    data.index.byStatus = {
      pending: [],
      verified: [],
      unsubscribed: [],
    };

    // Rebuild
    for (const subscriber of data.subscribers) {
      if (subscriber) {
        data.index.byId[subscriber.id] = subscriber;
        data.index.byEmail[subscriber.email] = subscriber;
        if (!data.index.byStatus[subscriber.status]) {
          data.index.byStatus[subscriber.status] = [];
        }
        data.index.byStatus[subscriber.status]?.push(subscriber.id);
      }
    }

    // Update metadata counts
    data.metadata.total = data.subscribers.length;
    data.metadata.verified = (data.index.byStatus.verified || []).length;
    data.metadata.pending = (data.index.byStatus.pending || []).length;
    data.metadata.unsubscribed = (data.index.byStatus.unsubscribed || []).length;
    data.metadata.last_updated = new Date().toISOString();
  }
}
