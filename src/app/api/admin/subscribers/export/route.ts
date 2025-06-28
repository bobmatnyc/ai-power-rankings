import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSubscribersRepo } from "@/lib/json-db";
import { format } from "date-fns";

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize subscriber repository
    const subscribersRepo = getSubscribersRepo();

    // Get CSV export from repository
    const csvContent = await subscribersRepo.exportToCsv();

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