---
id: T-031
title: Optimize Lighthouse Performance Scores and Core Web Vitals
status: backlog
priority: high
assignee: bobmatnyc
created: 2025-01-29
updated: 2025-01-29
labels: [performance, lighthouse, core-web-vitals, seo, user-experience]
---

# Optimize Lighthouse Performance Scores and Core Web Vitals

## Description

Address critical Lighthouse performance issues affecting user experience and SEO rankings. Current performance audit reveals significant issues with Core Web Vitals, particularly Largest Contentful Paint (4.6s) and Cumulative Layout Shift (0.242).

## Current Performance Issues

### 1. Largest Contentful Paint (LCP): 4.6s - Critical ❌
- **Current**: 4,600ms
- **Target**: <2,500ms
- **Issues**:
  - 87% render delay (4,000ms)
  - Main document TTFB: 950ms
  - LCP element: Hero text paragraph

### 2. Cumulative Layout Shift (CLS): 0.242 - Poor ❌
- **Current**: 0.242
- **Target**: <0.1
- **Issues**:
  - Layout shift in stats grid component
  - Element: `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">`

### 3. JavaScript Performance Issues
- **Total Blocking Time**: 1.9s
- **Main Thread Work**: 2.6s
- **Long Tasks**: 7 identified
- **Largest Bundle**: 6191 chunk (1.66s execution time)

### 4. Image Optimization Issues
- **Crown Icon**: 1,067 KiB PNG file
- **Estimated Savings**: 1,037 KiB with WebP conversion
- **Issue**: Improperly sized images for responsive display

### 5. Third-party Performance Impact
- **Google Tag Manager**: 113ms main thread blocking
- **Unused JavaScript**: 54 KiB from GTM
- **Cache Policies**: Suboptimal for static assets

## Detailed Lighthouse Audit Results

### Critical Request Chains
- Maximum critical path latency: 2,373ms
- CSS files loading sequentially
- Font loading blocking render

### JavaScript Execution Breakdown
| File | CPU Time | Script Eval | Parse Time |
|------|----------|-------------|------------|
| 6191 chunk | 1,660ms | 1,393ms | 11ms |
| Main page | 167ms | 8ms | 7ms |
| Webpack runtime | 140ms | 131ms | 0ms |
| GTM | 220ms | 194ms | 24ms |

### Long Tasks Analysis
| Start Time | Duration | Source |
|------------|----------|---------|
| 9,152ms | 150ms | 6191 chunk |
| 8,252ms | 99ms | webpack runtime |
| 8,393ms | 73ms | 6191 chunk |
| 8,659ms | 130ms | GTM |

## Acceptance Criteria

### Performance Metrics
- [ ] **LCP improved to <2.5s** (currently 4.6s)
- [ ] **CLS reduced to <0.1** (currently 0.242)
- [ ] **JavaScript execution time <1s** (currently 1.9s)
- [ ] **Main thread blocking <500ms** (currently 2.6s)
- [ ] **Lighthouse Performance score >90** (currently ~60)
- [ ] **All Core Web Vitals in "Good" range**

### Technical Improvements
- [ ] **Crown icon converted to WebP format**
- [ ] **Image sizes optimized for responsive display**
- [ ] **Critical CSS inlined for above-the-fold content**
- [ ] **JavaScript bundles code-split and lazy-loaded**
- [ ] **Third-party scripts deferred or optimized**
- [ ] **Layout shifts eliminated in stats grid**
- [ ] **Cache policies optimized for static assets**

## Technical Implementation Plan

### Phase 1: Image Optimization (2 story points)
```bash
# 1. Convert crown-of-technology.png to WebP
npm install sharp
# Create multiple sizes: 48x48, 64x64, 128x128

# 2. Implement next/image with proper sizing
# Replace <img> tags with Next.js Image component
# Add responsive sizes and loading="eager" for above-fold images
```

**Files to modify:**
- `/public/crown-of-technology.png` → Add WebP versions
- `/src/components/layout/header.tsx` → Update image usage
- `/next.config.ts` → Configure image optimization

### Phase 2: JavaScript Optimization (3 story points)
```bash
# 1. Bundle analysis
npm install @next/bundle-analyzer
npm run analyze

# 2. Code splitting implementation
# Split large components into separate chunks
# Implement dynamic imports for non-critical components

# 3. Remove unused polyfills
# Update browserslist to target modern browsers
# Remove Array.prototype.at and other modern feature polyfills
```

**Files to modify:**
- `/next.config.ts` → Add bundle analyzer, update target
- `/src/components/` → Implement lazy loading
- `/package.json` → Update browserslist

### Phase 3: Layout Stability (1 story point)
```bash
# 1. Fix stats grid layout shifts
# Add explicit dimensions and aspect ratios
# Implement skeleton loading states
# Reserve space for dynamic content
```

**Files to modify:**
- `/src/components/layout/stats-grid.tsx` → Add dimensions
- `/src/components/ui/skeleton.tsx` → Create loading states

### Phase 4: Critical Resource Optimization (2 story points)
```bash
# 1. Inline critical CSS
# Extract above-the-fold styles
# Implement critical CSS inlining

# 2. Optimize font loading
# Add font-display: swap
# Preload critical fonts
# Use system fonts as fallback
```

**Files to modify:**
- `/src/app/layout.tsx` → Optimize font loading
- `/src/app/globals.css` → Critical CSS extraction
- `/next.config.ts` → Add font optimization

## Testing Strategy

### Performance Testing
- [ ] **Lighthouse CI integration**
  ```bash
  npm install @lhci/cli
  # Add to GitHub Actions workflow
  ```

- [ ] **Core Web Vitals monitoring**
  ```bash
  # Implement real user monitoring
  # Set up performance budgets
  ```

- [ ] **Cross-browser testing**
  - Chrome DevTools Lighthouse
  - Firefox Performance Tools
  - Safari Web Inspector

### Regression Testing
- [ ] Performance regression tests in CI/CD
- [ ] Bundle size monitoring
- [ ] Image optimization validation
- [ ] Layout shift detection

## Success Metrics

### Before/After Comparison
| Metric | Current | Target | Impact |
|--------|---------|--------|---------|
| LCP | 4.6s | <2.5s | 46% improvement |
| CLS | 0.242 | <0.1 | 59% improvement |
| JS Execution | 1.9s | <1s | 47% improvement |
| Bundle Size | ~2MB | <1.5MB | 25% reduction |
| Lighthouse Score | ~60 | >90 | 50% improvement |

### Business Impact
- Improved SEO rankings (Core Web Vitals are ranking factors)
- Reduced bounce rate from performance issues
- Better user experience, especially on mobile
- Faster time-to-interactive leading to higher engagement

## Dependencies

- Next.js image optimization features
- WebP image conversion tools (sharp)
- Bundle analysis tools (@next/bundle-analyzer)
- Performance monitoring setup (Lighthouse CI)
- Real user monitoring implementation

## Risks and Mitigation

### High Risk
- **Image conversion affecting visual quality**
  - *Mitigation*: Test WebP quality settings, provide PNG fallback

### Medium Risk
- **Code splitting introducing loading delays**
  - *Mitigation*: Implement proper loading states, preload critical chunks

### Low Risk
- **Third-party script changes affecting analytics**
  - *Mitigation*: Test analytics functionality, implement gradual rollout

## Implementation Timeline

### Week 1: Analysis and Setup
- [ ] Bundle analysis and performance profiling
- [ ] Set up Lighthouse CI
- [ ] Create performance baseline

### Week 2: Image and Layout Optimization
- [ ] Convert images to WebP
- [ ] Fix layout shifts in stats grid
- [ ] Implement skeleton loading states

### Week 3: JavaScript Optimization
- [ ] Implement code splitting
- [ ] Remove unused polyfills
- [ ] Optimize third-party scripts

### Week 4: Testing and Monitoring
- [ ] Performance testing across devices
- [ ] Real user monitoring setup
- [ ] Documentation and guidelines

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Lighthouse Performance score >90
- [ ] Core Web Vitals in "Good" range
- [ ] Performance tests passing in CI/CD
- [ ] Real user monitoring configured
- [ ] Performance guidelines documented
- [ ] Code reviewed and approved
- [ ] Cross-browser testing completed
- [ ] Performance budget established

## Related Issues

- Links to SEO optimization tasks
- User experience improvement initiatives
- Mobile performance optimization
- Bundle size optimization efforts

## Notes

- Focus on mobile performance first (mobile-first approach)
- Implement progressive enhancement strategies
- Monitor real user metrics post-deployment
- Consider implementing performance budgets for future development
- Document performance optimization guidelines for team
