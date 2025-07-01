# Performance Optimization Guide - T-031

## Overview

This document provides implementation guidance for T-031: Optimize Lighthouse Performance Scores and Core Web Vitals.

## Current Performance Issues

### Critical Issues (Must Fix)
1. **Largest Contentful Paint: 4.6s** (Target: <2.5s)
2. **Cumulative Layout Shift: 0.242** (Target: <0.1)
3. **JavaScript Execution Time: 1.9s** (Target: <1s)

### Performance Audit Results
- Lighthouse Performance Score: ~60 (Target: >90)
- Main Thread Blocking: 2.6s
- Image Optimization Savings: 1,037 KiB
- Unused JavaScript: 54 KiB

## Implementation Phases

### Phase 1: Image Optimization (Quick Wins)

#### Convert Crown Icon to WebP
```bash
# Install sharp for image conversion
npm install sharp

# Create conversion script
node -e "
const sharp = require('sharp');
sharp('public/crown-of-technology.png')
  .webp({ quality: 85 })
  .toFile('public/crown-of-technology.webp');
"

# Create multiple sizes
sharp('public/crown-of-technology.png')
  .resize(48, 48)
  .webp({ quality: 85 })
  .toFile('public/crown-48.webp');
```

#### Update Image Usage
```tsx
// Before
<img src="/crown-of-technology.png" alt="AI Power Ranking Icon" 
     class="w-12 h-12 md:w-16 md:h-16 object-contain">

// After
import Image from 'next/image';

<Image
  src="/crown-of-technology.webp"
  alt="AI Power Ranking Icon"
  width={64}
  height={64}
  className="w-12 h-12 md:w-16 md:h-16 object-contain"
  priority={true}
  sizes="(max-width: 768px) 48px, 64px"
/>
```

### Phase 2: Layout Stability Fixes

#### Fix Stats Grid Layout Shifts
```tsx
// src/components/layout/stats-grid.tsx
export function StatsGrid() {
  return (
    <div 
      className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6"
      style={{ minHeight: '120px' }} // Reserve space
    >
      {stats.map((stat, index) => (
        <div 
          key={index}
          className="text-center"
          style={{ 
            width: '100%',
            aspectRatio: '1 / 0.8' // Maintain consistent aspect ratio
          }}
        >
          <div className="text-2xl md:text-3xl font-bold text-primary">
            {stat.loading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-16 mx-auto rounded" />
            ) : (
              stat.value
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Phase 3: JavaScript Optimization

#### Bundle Analysis
```bash
# Add bundle analyzer
npm install @next/bundle-analyzer

# Update next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // existing config
});

# Run analysis
ANALYZE=true npm run build
```

#### Code Splitting Implementation
```tsx
// Lazy load heavy components
import dynamic from 'next/dynamic';

const RankingsTable = dynamic(() => import('./rankings-table'), {
  loading: () => <RankingsTableSkeleton />,
  ssr: false
});

const NewsSection = dynamic(() => import('./news-section'), {
  loading: () => <NewsSectionSkeleton />
});
```

#### Remove Unused Polyfills
```javascript
// Update browserslist in package.json
"browserslist": [
  "> 1%",
  "last 2 versions",
  "not dead",
  "not ie 11"
]

// Update next.config.ts
module.exports = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    modern: true, // Enable modern JS output
  }
};
```

### Phase 4: Critical Resource Optimization

#### Inline Critical CSS
```tsx
// src/app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap', // Improve font loading
  preload: true
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preload critical resources */}
        <link rel="preload" href="/crown-of-technology.webp" as="image" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        
        {/* Critical CSS inline */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .hero-section { min-height: 400px; }
            .stats-grid { min-height: 120px; }
          `
        }} />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
```

#### Optimize Third-party Scripts
```tsx
// Defer Google Analytics
import Script from 'next/script';

export default function Layout({ children }) {
  return (
    <>
      {children}
      
      {/* Load GTM after page interaction */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-5YBL6NPWL6"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-5YBL6NPWL6');
        `}
      </Script>
    </>
  );
}
```

## Testing and Monitoring

### Performance Audit Script
```bash
# Run local performance audit
npm run perf:audit

# Run production audit
npm run perf:audit:prod

# Monitor performance
npm run perf:monitor
```

### Lighthouse CI Integration
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push, pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build project
        run: npm run build
      
      - name: Start server
        run: npm start &
        
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
```

### Performance Budget
```json
// lighthouse-budget.json
{
  "budget": [
    {
      "path": "/*",
      "timings": [
        { "metric": "largest-contentful-paint", "budget": 2500 },
        { "metric": "cumulative-layout-shift", "budget": 0.1 },
        { "metric": "total-blocking-time", "budget": 500 }
      ],
      "resourceSizes": [
        { "resourceType": "script", "budget": 500 },
        { "resourceType": "image", "budget": 200 },
        { "resourceType": "total", "budget": 1000 }
      ]
    }
  ]
}
```

## Success Criteria Checklist

### Core Web Vitals
- [ ] LCP < 2.5s (currently 4.6s)
- [ ] CLS < 0.1 (currently 0.242)
- [ ] FID < 100ms

### Lighthouse Scores
- [ ] Performance > 90 (currently ~60)
- [ ] Accessibility > 95
- [ ] Best Practices > 90
- [ ] SEO > 95

### Technical Improvements
- [ ] Crown icon converted to WebP
- [ ] Layout shifts eliminated
- [ ] JavaScript bundles optimized
- [ ] Critical CSS inlined
- [ ] Third-party scripts deferred
- [ ] Cache policies optimized

## Monitoring and Maintenance

### Real User Monitoring
```javascript
// Add to layout.tsx
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Send to your analytics service
  gtag('event', metric.name, {
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    event_category: 'Web Vitals',
    event_label: metric.id,
    non_interaction: true,
  });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Performance Regression Prevention
- Set up performance budgets in CI/CD
- Monitor bundle size changes
- Regular Lighthouse audits
- Real user metrics tracking

## Resources

- [Web Vitals Documentation](https://web.dev/vitals/)
- [Next.js Performance Guide](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Lighthouse Performance Scoring](https://web.dev/performance-scoring/)
- [Image Optimization Best Practices](https://web.dev/fast/#optimize-your-images)
