import { notFound } from "next/navigation";
// import { getDictionary } from "@/i18n/get-dictionary"; // Not used in contact form version
import { ContactForm } from "@/components/contact/contact-form";
import type { Locale } from "@/i18n/config";
import { contentLoader } from "@/lib/content-loader";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function ContactPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  // const dict = await getDictionary(lang); // Not used in contact form version

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

// Generate static params only for main pages to prevent Vercel timeout
export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "de" }, { lang: "ja" }];
}

// Generate metadata
export async function generateMetadata({ params }: PageProps) {
  const { lang } = await params;
  const content = await contentLoader.loadContent(lang, "contact");

  return {
    title: content?.title || "Contact Us",
    description: content?.subtitle || "Get in touch with AI Power Rankings",
  };
}
