import { redirect } from "next/navigation";
import { i18n } from "@/i18n/config";

export default function RootPage() {
  // The middleware handles the redirect to avoid conflicts with Payload admin
  redirect(`/${i18n.defaultLocale}`);
}
