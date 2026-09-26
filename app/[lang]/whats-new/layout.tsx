import { Sparkles } from 'lucide-react';
import { WhatsNewNavigation } from '@/components/whats-new/whats-new-navigation';
import type { Metadata } from 'next';
import { WHATS_NEW_OG_DESCRIPTION, WHATS_NEW_TITLE } from './page-metadata';

export const metadata: Metadata = {
  title: WHATS_NEW_TITLE,
  description: 'Stay updated with the latest AI tool rankings, news, and platform improvements. Monthly summaries and recent updates.',
  openGraph: {
    title: WHATS_NEW_TITLE,
    description: WHATS_NEW_OG_DESCRIPTION,
  },
};

interface WhatsNewLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function WhatsNewLayout({
  children,
  params,
}: WhatsNewLayoutProps) {
  const { lang } = await params;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">What&apos;s New</h1>
        </div>
        <p className="text-muted-foreground">
          Stay updated with the latest AI tool rankings, news, and platform improvements
        </p>
      </div>

      <WhatsNewNavigation lang={lang} />

      {children}
    </div>
  );
}
