import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { SubscribersPage } from "@/components/admin/subscribers-page";

export const metadata: Metadata = generateSEOMetadata({
  title: "Subscriber Management",
  description: "Manage newsletter subscribers and email lists.",
  path: "/admin/subscribers",
  noIndex: true, // Don't index admin pages
});

export default function Subscribers() {
  return <SubscribersPage />;
}
