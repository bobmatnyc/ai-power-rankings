// This page should not be reached as middleware handles locale redirects
// But we need to export a component for Next.js

export const dynamic = "force-dynamic";

export default function RootPage() {
  return null;
}
