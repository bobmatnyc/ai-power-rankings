import { auth } from "@clerk/nextjs/server";
import { format } from "date-fns";
import { NextResponse } from "next/server";
import { getSubscribersRepo } from "@/lib/json-db";

export async function GET() {
  try {
    // Check authentication using Clerk
    const { userId } = await auth();
    if (!userId) {
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
