import { logger } from "./logger";

// Google Drive API base URL
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

// Get API key from environment
function getApiKey(): string {
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not found in environment variables");
  }
  return apiKey;
}

// Extract folder ID from Google Drive URL
export function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || null;
}

// List files in a public folder (read-only with API key)
export async function listFilesInFolder(folderId: string) {
  const apiKey = getApiKey();

  try {
    const url =
      `${DRIVE_API_BASE}/files?` +
      new URLSearchParams({
        q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
        fields: "files(id, name, createdTime, modifiedTime)",
        orderBy: "createdTime",
        key: apiKey,
      });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    logger.error("Failed to list files in folder:", error);
    throw error;
  }
}

// Download file content (public files only with API key)
export async function downloadFileContent(fileId: string): Promise<string> {
  const apiKey = getApiKey();

  try {
    const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    logger.error("Failed to download file content:", error);
    throw error;
  }
}

// Note: Moving files and creating files requires OAuth authentication
// With API key only, we can only read public files
// For the ingestion system, we'll need to handle this differently

export async function moveFileToFolder(
  _fileId: string,
  _newFolderId: string,
  _currentFolderId: string
): Promise<void> {
  logger.warn("Moving files requires OAuth authentication, not supported with API key only");
  logger.info("Consider using a webhook or manual process to move processed files");
  // In production, you might want to:
  // 1. Mark the file as processed in your database
  // 2. Use a separate OAuth-authenticated service to move files
  // 3. Or have a manual process to clean up processed files
}

export async function createFileInFolder(
  _folderId: string,
  fileName: string,
  content: string,
  _mimeType: string = "application/json"
): Promise<string | null> {
  logger.warn("Creating files requires OAuth authentication, not supported with API key only");
  logger.info(`Would create file: ${fileName} with content length: ${content.length}`);
  // In production, you might want to:
  // 1. Store reports in your database instead
  // 2. Use a separate OAuth-authenticated service to create report files
  // 3. Or send reports via email/webhook instead
  return null;
}
