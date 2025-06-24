import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPayload } from "payload";
import config from "@payload-config";
import { format } from "date-fns";

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize Payload
    const payload = await getPayload({ config });

    // Fetch all verified subscribers
    const { docs: subscribers } = await payload.find({
      collection: "newsletter-subscribers",
      where: {
        status: { equals: "verified" },
      },
      limit: 10000,
      sort: "-createdAt",
    });

    // Create CSV content
    const headers = ["Email", "First Name", "Last Name", "Subscribed Date", "Verified Date"];
    const rows = subscribers.map((subscriber) => [
      subscriber['email'],
      subscriber['first_name'],
      subscriber['last_name'],
      subscriber['createdAt'] 
        ? format(new Date(subscriber['createdAt']), "yyyy-MM-dd HH:mm:ss")
        : "",
      subscriber['verified_at']
        ? format(new Date(subscriber['verified_at']), "yyyy-MM-dd HH:mm:ss")
        : "",
    ]);

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