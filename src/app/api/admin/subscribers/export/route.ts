import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all verified subscribers
    const supabaseAdmin = createServiceClient();
    const { data: subscribers, error } = await supabaseAdmin
      .from("newsletter_subscriptions")
      .select("*")
      .eq("status", "verified")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching subscribers:", error);
      return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 });
    }

    // Create CSV content
    const headers = ["Email", "First Name", "Last Name", "Subscribed Date", "Verified Date"];
    const rows =
      subscribers?.map((subscriber) => [
        subscriber.email,
        subscriber.first_name,
        subscriber.last_name,
        format(new Date(subscriber.created_at), "yyyy-MM-dd HH:mm:ss"),
        subscriber.verified_at
          ? format(new Date(subscriber.verified_at), "yyyy-MM-dd HH:mm:ss")
          : "",
      ]) || [];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="subscribers-${format(new Date(), "yyyy-MM-dd")}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting subscribers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
