import { redirect } from "next/navigation";

export default function AdminSignIn() {
  // Redirect to Clerk sign-in page
  redirect("/sign-in");
}
