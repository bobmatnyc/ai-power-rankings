import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientLayout } from "@/components/layout/client-layout";
import { Analytics } from "@vercel/analytics/react";
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return {
    title: dict.seo?.title || `${dict.common.appName} - ${dict.common.appDescription}`,
    description: dict.seo?.description || dict.home.methodology.algorithmDescription,
    keywords: dict.seo?.keywords?.split(", ") || [],
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}>): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <html lang={lang}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <ClientLayout lang={lang} dict={dict}>
          {children}
        </ClientLayout>
        <Analytics />
      </body>
    </html>
  );
}
