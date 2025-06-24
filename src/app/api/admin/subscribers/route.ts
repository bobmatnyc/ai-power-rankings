import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPayload } from "payload";
import config from "@payload-config";

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize Payload
    const payload = await getPayload({ config });

    // Fetch all subscribers
    const { docs: subscribers } = await payload.find({
      collection: "newsletter-subscribers",
      limit: 1000,
      sort: "-createdAt",
    });

    // Calculate stats
    const stats = {
      total: subscribers.length,
      verified: subscribers.filter((s) => s['status'] === "verified").length,
      pending: subscribers.filter((s) => s['status'] === "pending").length,
      unsubscribed: subscribers.filter((s) => s['status'] === "unsubscribed").length,
    };

    return NextResponse.json({
      subscribers,
      stats,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/subscribers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}