import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { ClientLayout } from "@/components/layout/client-layout";
import { GoogleAnalyticsOptimized } from "@/components/analytics/GoogleAnalytics-optimized";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { getUrl } from "@/lib/get-url";
import "@/globals.css";

/**
 * Optimized font loading with display swap to prevent FOIT.
 * 
 * WHY: Font loading can block text rendering. Using display: 'swap'
 * ensures text is visible immediately with a fallback font.
 */
const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: true
});

export const metadata: Metadata = {
  metadataBase: new URL(getUrl()),
  title: {
    default: "AI Power Rankings",
    template: "%s | AI Power Rankings",
  },
  description: "Comprehensive rankings and analysis of AI coding tools and assistants",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: getUrl(),
    siteName: "AI Power Rankings",
    images: [
      {
        url: `${getUrl()}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "AI Power Rankings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Power Rankings",
    description: "Comprehensive rankings and analysis of AI coding tools and assistants",
    images: [`${getUrl()}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/crown.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/crown.svg",
  },
};

interface RootLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: Locale }>;
}

/**
 * Optimized root layout with performance improvements.
 * 
 * WHY: The layout component renders on every page, so optimizations here
 * have the biggest impact on overall performance.
 * 
 * OPTIMIZATIONS:
 * - Lazy load non-critical components
 * - Use optimized Google Analytics with delayed loading
 * - Implement resource hints for faster loading
 * - Use CSS containment for layout stability
 */
export default async function RootLayoutOptimized({
  children,
  params,
}: RootLayoutProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* Resource hints for critical resources */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        
        {/* Preload critical CSS */}
        <link 
          rel="preload" 
          href="/_next/static/css/app/layout.css" 
          as="style" 
          crossOrigin="anonymous"
        />
        
        {/* Optimize viewport for better CLS */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, viewport-fit=cover" 
        />
      </head>
      <body 
        className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}
        // CSS containment to improve rendering performance
        style={{
          contain: 'layout style paint',
          // Reserve space for scrollbar to prevent layout shift
          scrollbarGutter: 'stable',
        }}
      >
        <ClientLayout lang={lang} dict={dict}>
          {children}
        </ClientLayout>
        
        {/* Optimized Google Analytics with delayed loading */}
        <GoogleAnalyticsOptimized />
          
          {/* Performance monitoring in development */}
          {process.env.NODE_ENV === 'development' && (
            <script
              // biome-ignore lint/security/noDangerouslySetInnerHTML: Safe performance monitoring
              dangerouslySetInnerHTML={{
                __html: `
                  // Log performance metrics in development
                  if (window.performance && window.performance.timing) {
                    window.addEventListener('load', () => {
                      setTimeout(() => {
                        const timing = performance.timing;
                        const loadTime = timing.loadEventEnd - timing.navigationStart;
                        const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
                        const firstPaint = performance.getEntriesByType('paint')[0]?.startTime || 0;
                        
                        console.log('Performance Metrics:', {
                          'Total Load Time': loadTime + 'ms',
                          'DOM Ready': domReady + 'ms',
                          'First Paint': firstPaint + 'ms',
                          'Resources': performance.getEntriesByType('resource').length
                        });
                        
                        // Check for long tasks
                        if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
                          new PerformanceObserver((list) => {
                            for (const entry of list.getEntries()) {
                              console.warn('Long task:', entry.duration + 'ms', entry);
                            }
                          }).observe({ entryTypes: ['longtask'] });
                        }
                      }, 100);
                    });
                  }
                `,
              }}
            />
          )}
      </body>
    </html>
  );
}