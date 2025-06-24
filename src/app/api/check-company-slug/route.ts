import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    
    if (!slug) {
      return NextResponse.json({ error: "Slug parameter required" }, { status: 400 });
    }
    
    const payload = await getPayload({ config });
    
    const { docs: companies } = await payload.find({
      collection: "companies",
      where: {
        slug: { equals: slug }
      },
      limit: 10,
    });
    
    return NextResponse.json({
      slug,
      exists: companies.length > 0,
      companies: companies.map((c: any) => ({
        id: c.id,
        name: c['name'],
        slug: c['slug'],
      })),
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check slug" },
      { status: 500 }
    );
  }
}