import type { Metadata } from "next";
import { generateToolMetadata } from "./metadata";
import ToolDetailClientPage from "./client-page";

interface ToolPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  return generateToolMetadata(slug);
}

export default async function ToolDetailPage({ params }: ToolPageProps) {
  const { slug } = await params;

  return <ToolDetailClientPage slug={slug} />;
}
