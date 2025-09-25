import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact/contact-form";
import type { Locale } from "@/i18n/config";
import { contentLoader } from "@/lib/content-loader";

// Force dynamic rendering to avoid SSG issues with Clerk
export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable ISR, force runtime rendering

// CRITICAL: Force runtime-only operations to prevent SSG
async function forceRuntimeCheck() {
  // Access cookies() which forces dynamic rendering
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session") || null;

  // Access headers() as well
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const host = headersList.get("host") || "";

  // Add timestamp to prevent any caching
  const timestamp = new Date().toISOString();

  // Force runtime evaluation in all environments
  return {
    dynamicCheck: true,
    userAgent,
    host,
    timestamp,
    sessionCookie: sessionCookie?.value || null,
    // Force runtime by accessing process.env during execution
    nodeEnv: process.env["NODE_ENV"] || "unknown",
  };
}

interface PageProps {
  params: Promise<{ lang: Locale; slug: string }>;
}

export default async function DynamicContactPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { lang, slug } = await params;

  // Only accept 'default' as the slug to prevent abuse
  if (slug !== "default") {
    notFound();
  }

  // CRITICAL: Force runtime check to prevent static generation
  await forceRuntimeCheck();

  // Load contact content
  const content = await contentLoader.loadContent(lang, "contact");

  if (!content) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">{content.title}</h1>
        {content.subtitle && <p className="text-muted-foreground text-lg">{content.subtitle}</p>}
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
          We&apos;d love to hear from you! Whether you have questions about our rankings,
          suggestions for improvements, or business inquiries, we&apos;re here to help.
        </p>
      </div>

      <ContactForm />

      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>
          <em>AI Power Rankings - Your trusted source for AI developer tool intelligence</em>
        </p>
      </div>
    </div>
  );
}

// Generate metadata
export async function generateMetadata({ params }: PageProps) {
  const { lang, slug } = await params;

  // Only generate metadata for 'default' slug
  if (slug !== "default") {
    return {
      title: "Not Found",
    };
  }

  // CRITICAL: Force runtime check in metadata as well
  await forceRuntimeCheck();

  const content = await contentLoader.loadContent(lang, "contact");

  return {
    title: content?.title || "Contact Us",
    description: content?.subtitle || "Get in touch with AI Power Rankings",
  };
}
