import { redirect } from "next/navigation";
import { headers } from "next/headers";

// Since we removed middleware, handle locale redirect here
export const dynamic = "force-dynamic";

export default async function RootPage() {
  // Get headers to ensure this runs server-side
  await headers();

  // Redirect to default locale
  redirect("/en");
}
