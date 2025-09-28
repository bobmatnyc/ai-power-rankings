import { redirect } from "next/navigation";

// Since we removed middleware, handle locale redirect here
export const dynamic = "force-dynamic";

export default function RootPage() {
  // Redirect to default locale
  redirect("/en");
}
