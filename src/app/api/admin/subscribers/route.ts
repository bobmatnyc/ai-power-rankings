import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSubscribersRepo } from "@/lib/json-db";

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize subscriber repository
    const subscribersRepo = getSubscribersRepo();

    // Fetch all subscribers
    const subscribers = await subscribersRepo.getAll();

    // Sort by created date (newest first)
    const sortedSubscribers = subscribers.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Get stats
    const stats = await subscribersRepo.getStatistics();

    return NextResponse.json({
      subscribers: sortedSubscribers,
      stats,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/subscribers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
