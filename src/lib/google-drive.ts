import { google } from "googleapis";
import { logger } from "./logger";

// Initialize Google Drive client
export function getGoogleDriveClient() {
  try {
    // Parse the service account credentials from environment variable
    const credentials = JSON.parse(process.env["GOOGLE_SERVICE_ACCOUNT_KEY"] || "{}");

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    return google.drive({ version: "v3", auth });
  } catch (error) {
    logger.error("Failed to initialize Google Drive client:", error);
    throw new Error("Google Drive client initialization failed");
  }
}

// Extract folder ID from Google Drive URL
export function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || null;
}

// List files in a folder
export async function listFilesInFolder(folderId: string) {
  const drive = getGoogleDriveClient();

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
      fields: "files(id, name, createdTime, modifiedTime)",
      orderBy: "createdTime",
    });

    return response.data.files || [];
  } catch (error) {
    logger.error("Failed to list files in folder:", error);
    throw error;
  }
}

// Download file content
export async function downloadFileContent(fileId: string): Promise<string> {
  const drive = getGoogleDriveClient();

  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      {
        responseType: "text",
      }
    );

    return response.data as string;
  } catch (error) {
    logger.error("Failed to download file content:", error);
    throw error;
  }
}

// Move file to another folder
export async function moveFileToFolder(
  fileId: string,
  newFolderId: string,
  currentFolderId: string
) {
  const drive = getGoogleDriveClient();

  try {
    await drive.files.update({
      fileId,
      addParents: newFolderId,
      removeParents: currentFolderId,
      fields: "id, parents",
    });
  } catch (error) {
    logger.error("Failed to move file:", error);
    throw error;
  }
}

// Create a file in a folder
export async function createFileInFolder(
  folderId: string,
  fileName: string,
  content: string,
  mimeType: string = "application/json"
) {
  const drive = getGoogleDriveClient();

  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType,
      },
      media: {
        mimeType,
        body: content,
      },
      fields: "id",
    });

    return response.data.id;
  } catch (error) {
    logger.error("Failed to create file:", error);
    throw error;
  }
}
