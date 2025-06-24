import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { id, name, slug } = await request.json();
    
    if (!id || !name || !slug) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, slug" },
        { status: 400 }
      );
    }
    
    const payload = await getPayload({ config });
    
    // Update the company
    const updated = await payload.update({
      collection: "companies",
      id,
      data: {
        name,
        slug,
        company_type: "private", // Default value
      },
    });
    
    loggers.api.info(`Updated company ${id}: ${name}`);
    
    return NextResponse.json({
      success: true,
      company: {
        id: updated.id,
        name: updated['name'],
        slug: updated['slug'],
      },
    });
    
  } catch (error) {
    loggers.api.error("Failed to update company", { error });
    return NextResponse.json(
      { 
        error: "Failed to update company",
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}