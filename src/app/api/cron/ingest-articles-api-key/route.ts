import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { listFilesInFolder, downloadFileContent } from "@/lib/google-drive-api-key";
import { validateNewsItems } from "@/lib/article-validator";
import { ingestArticles, IngestionReport } from "@/lib/article-ingestion-payload";
import { logger } from "@/lib/logger";
import { getPayload } from "payload";
import config from "@payload-config";

// Get folder IDs from environment
const INCOMING_FOLDER_ID =
  process.env["GOOGLE_DRIVE_INCOMING_FOLDER_ID"] || "1TVEXlX3PDHDtyRgjR1VenDUywrIEAVy8";

export async function GET() {
  try {
    // Verify the request is from Vercel Cron
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("Starting article ingestion cron job (Payload CMS version)");

    // Initialize Payload
    const payload = await getPayload({ config });

    // Use folder ID directly from environment
    const incomingFolderId = INCOMING_FOLDER_ID;

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

        // Check if we've already processed this file
        const { docs: processedFiles } = await payload.find({
          collection: "processed-files",
          where: {
            file_id: { equals: file.id },
          },
          limit: 1,
        });

        if (processedFiles.length > 0) {
          logger.info(`File ${file.name} already processed, skipping`);
          continue;
        }

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

        // Store the report in Payload
        await payload.create({
          collection: "ingestion-reports",
          data: {
            file_name: file.name,
            file_id: file.id,
            processed_at: new Date().toISOString(),
            total_articles: report.total_articles,
            ingested: report.ingested,
            duplicates_removed: report.duplicates_removed,
            validation_errors: report.validation_errors,
            errors: report.errors,
            ingested_articles: report.ingested_articles,
            report: report,
          },
        });

        // Mark file as processed
        await payload.create({
          collection: "processed-files",
          data: {
            file_id: file.id,
            file_name: file.name,
            processed_at: new Date().toISOString(),
            articles_ingested: report.ingested,
            validation_errors: report.validation_errors,
          },
        });

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

// Support POST for manual triggers
export async function POST() {
  return GET();
}