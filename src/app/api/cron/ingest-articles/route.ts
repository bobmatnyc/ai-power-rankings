import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  extractFolderId,
  listFilesInFolder,
  downloadFileContent,
  moveFileToFolder,
  createFileInFolder,
} from "@/lib/google-drive";
import { validateNewsItems } from "@/lib/article-validator";
import { ingestArticles, IngestionReport } from "@/lib/article-ingestion";
import { logger } from "@/lib/logger";

// Folder URLs
const INCOMING_FOLDER_URL =
  "https://drive.google.com/drive/u/0/folders/1TVEXlX3PDHDtyRgjR1VenDUywrIEAVy8";
const PROCESSED_FOLDER_URL =
  "https://drive.google.com/drive/u/0/folders/1VCEJc1USJ3iRs2aSVBCpaWW47e9jog12";

export async function GET() {
  try {
    // Verify the request is from Vercel Cron
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("Starting article ingestion cron job");

    // Extract folder IDs
    const incomingFolderId = extractFolderId(INCOMING_FOLDER_URL);
    const processedFolderId = extractFolderId(PROCESSED_FOLDER_URL);

    if (!incomingFolderId || !processedFolderId) {
      throw new Error("Invalid folder URLs");
    }

    // List all JSON files in the incoming folder
    const files = await listFilesInFolder(incomingFolderId);
    logger.info(`Found ${files.length} files to process`);

    const reports: IngestionReport[] = [];

    // Process each file
    for (const file of files) {
      if (!file.id || !file.name) {
        continue;
      }

      try {
        logger.info(`Processing file: ${file.name}`);

        // Download file content
        const content = await downloadFileContent(file.id);

        // Parse JSON content
        let jsonData;
        try {
          jsonData = JSON.parse(content);
        } catch (parseError) {
          logger.error(`Failed to parse JSON from ${file.name}:`, parseError);
          continue;
        }

        // Handle both single article and array of articles
        const articlesArray = Array.isArray(jsonData) ? jsonData : [jsonData];

        // Validate articles
        const { valid, invalid } = validateNewsItems(articlesArray);

        if (invalid.length > 0) {
          logger.warn(`${invalid.length} invalid articles in ${file.name}`);
        }

        // Ingest valid articles
        const report = await ingestArticles(valid, file.name);
        report.validation_errors = invalid.length;

        // Add validation errors to report
        for (const { errors } of invalid) {
          if (errors) {
            report.errors.push(...errors.map((e) => `Validation: ${e.path} - ${e.message}`));
          }
        }

        reports.push(report);

        // Create report file
        const reportFileName = file.name.replace(".json", ".report.json");
        const reportContent = JSON.stringify(report, null, 2);

        await createFileInFolder(processedFolderId, reportFileName, reportContent);

        // Move the original file to processed folder
        await moveFileToFolder(file.id, processedFolderId, incomingFolderId);

        logger.info(`Successfully processed ${file.name}: ${report.ingested} articles ingested`);
      } catch (fileError) {
        logger.error(`Error processing file ${file.name}:`, fileError);
      }
    }

    // Summary response
    const summary = {
      processed_files: reports.length,
      total_articles_ingested: reports.reduce((sum, r) => sum + r.ingested, 0),
      total_duplicates_removed: reports.reduce((sum, r) => sum + r.duplicates_removed, 0),
      total_validation_errors: reports.reduce((sum, r) => sum + r.validation_errors, 0),
      reports,
    };

    logger.info("Article ingestion cron job completed", summary);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error("Article ingestion cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optionally support POST for manual triggers
export async function POST() {
  return GET();
}
