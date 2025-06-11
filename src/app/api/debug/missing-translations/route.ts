import { NextResponse } from "next/server";
import { getMissingTranslations, clearMissingTranslations } from "@/i18n/dictionary-utils";

export async function GET() {
  const missing = getMissingTranslations();

  return NextResponse.json({
    count: missing.length,
    missing: missing,
    timestamp: new Date().toISOString(),
  });
}

export async function DELETE() {
  clearMissingTranslations();

  return NextResponse.json({
    message: "Missing translations log cleared",
    timestamp: new Date().toISOString(),
  });
}
