// Force dynamic rendering to avoid Clerk SSG issues
export const dynamic = "force-dynamic";

import NewsListPage from "./news-client";

export default function AdminNewsPage() {
  return <NewsListPage />;
}
