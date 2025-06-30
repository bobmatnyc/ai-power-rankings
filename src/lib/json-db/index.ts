// JSON Database - Main exports
export * from "./schemas";
export * from "./base-repository";
export * from "./tools-repository";
export * from "./rankings-repository";
export * from "./news-repository";
export * from "./companies-repository";
export * from "./subscribers-repository";
export * from "./site-settings-repository";
export { backupManager } from "./backup-manager";
export { initializeJsonDb } from "./init";

// Utility functions for common operations
import { ToolsRepository } from "./tools-repository";
import { RankingsRepository } from "./rankings-repository";
import { NewsRepository } from "./news-repository";
import { CompaniesRepository } from "./companies-repository";
import { SubscribersRepository } from "./subscribers-repository";
import { SiteSettingsRepository } from "./site-settings-repository";

export const getToolsRepo = () => ToolsRepository.getInstance();
export const getRankingsRepo = () => RankingsRepository.getInstance();
export const getNewsRepo = () => NewsRepository.getInstance();
export const getCompaniesRepo = () => CompaniesRepository.getInstance();
export const getSubscribersRepo = () => SubscribersRepository.getInstance();
export const getSiteSettingsRepo = () => SiteSettingsRepository.getInstance();

/**
 * Initialize all repositories
 */
export async function initializeRepositories(): Promise<void> {
  const repos = [
    getToolsRepo(),
    getRankingsRepo(),
    getNewsRepo(),
    getCompaniesRepo(),
    getSubscribersRepo(),
    getSiteSettingsRepo(),
  ];

  await Promise.all(repos.map((repo) => repo.initialize()));
}

/**
 * Create backup of all data
 */
export async function backupAllData(): Promise<{
  tools: string;
  rankings: string;
  news: string;
  companies: string;
  subscribers: string;
  settings: string;
}> {
  const [tools, rankings, news, companies, subscribers, settings] = await Promise.all([
    getToolsRepo().backup(),
    getRankingsRepo().backup(),
    getNewsRepo().backup(),
    getCompaniesRepo().backup(),
    getSubscribersRepo().backup(),
    getSiteSettingsRepo().backup(),
  ]);

  return { tools, rankings, news, companies, subscribers, settings };
}
