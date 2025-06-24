import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all subscribers
    const supabaseAdmin = createServiceClient();
    const { data: subscribers, error } = await supabaseAdmin
      .from("newsletter_subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching subscribers:", error);
      return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: subscribers?.length || 0,
      verified: subscribers?.filter((s) => s.status === "verified").length || 0,
      pending: subscribers?.filter((s) => s.status === "pending").length || 0,
      unsubscribed: subscribers?.filter((s) => s.status === "unsubscribed").length || 0,
    };

    return NextResponse.json({
      subscribers: subscribers || [],
      stats,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/subscribers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
