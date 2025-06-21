interface SEOMetrics {
  searchMetrics: {
    avgPosition: number;
    clicks: number;
    impressions: number;
    ctr: number;
  };
  coreWebVitals: {
    lcp: number;
    fid: number;
    cls: number;
  };
  technicalSEO: {
    crawlErrors: number;
    indexedPages: number;
    brokenLinks: number;
  };
  contentQuality?: {
    avgWordCount: number;
    headingStructure: boolean;
    metaDescriptions: number;
    altTexts: number;
  };
}

export function calculateSEOScore(metrics: Partial<SEOMetrics>): number {
  let totalScore = 0;
  let totalWeight = 0;

  // Search Performance (40% weight)
  if (metrics.searchMetrics) {
    const searchScore = calculateSearchScore(metrics.searchMetrics);
    totalScore += searchScore * 0.4;
    totalWeight += 0.4;
  }

  // Core Web Vitals (30% weight)
  if (metrics.coreWebVitals) {
    const vitalsScore = calculateVitalsScore(metrics.coreWebVitals);
    totalScore += vitalsScore * 0.3;
    totalWeight += 0.3;
  }

  // Technical SEO (20% weight)
  if (metrics.technicalSEO) {
    const technicalScore = calculateTechnicalScore(metrics.technicalSEO);
    totalScore += technicalScore * 0.2;
    totalWeight += 0.2;
  }

  // Content Quality (10% weight)
  if (metrics.contentQuality) {
    const contentScore = calculateContentScore(metrics.contentQuality);
    totalScore += contentScore * 0.1;
    totalWeight += 0.1;
  }

  // Normalize score if not all components are available
  if (totalWeight > 0) {
    return Math.round((totalScore / totalWeight) * 100);
  }

  return 0;
}

function calculateSearchScore(metrics: SEOMetrics["searchMetrics"]): number {
  let score = 0;

  // Average position (lower is better, 1-3 = 100, 4-10 = 80, 11-20 = 60, 21-50 = 40, 50+ = 20)
  if (metrics.avgPosition <= 3) {
    score += 25;
  } else if (metrics.avgPosition <= 10) {
    score += 20;
  } else if (metrics.avgPosition <= 20) {
    score += 15;
  } else if (metrics.avgPosition <= 50) {
    score += 10;
  } else {
    score += 5;
  }

  // CTR (Click-through rate)
  const ctr = metrics.ctr || metrics.clicks / metrics.impressions;
  if (ctr >= 0.1) {
    score += 25;
  } // 10%+ CTR is excellent
  else if (ctr >= 0.05) {
    score += 20;
  } // 5%+ CTR is good
  else if (ctr >= 0.02) {
    score += 15;
  } // 2%+ CTR is average
  else {
    score += 10;
  }

  // Traffic volume (impressions)
  if (metrics.impressions >= 100000) {
    score += 25;
  } else if (metrics.impressions >= 10000) {
    score += 20;
  } else if (metrics.impressions >= 1000) {
    score += 15;
  } else if (metrics.impressions >= 100) {
    score += 10;
  } else {
    score += 5;
  }

  // Click volume
  if (metrics.clicks >= 10000) {
    score += 25;
  } else if (metrics.clicks >= 1000) {
    score += 20;
  } else if (metrics.clicks >= 100) {
    score += 15;
  } else if (metrics.clicks >= 10) {
    score += 10;
  } else {
    score += 5;
  }

  return score;
}

function calculateVitalsScore(vitals: SEOMetrics["coreWebVitals"]): number {
  let score = 0;

  // LCP (Largest Contentful Paint) - Good: <2.5s, Needs Improvement: 2.5-4s, Poor: >4s
  if (vitals.lcp <= 2.5) {
    score += 35;
  } else if (vitals.lcp <= 4) {
    score += 20;
  } else {
    score += 10;
  }

  // FID (First Input Delay) - Good: <100ms, Needs Improvement: 100-300ms, Poor: >300ms
  if (vitals.fid <= 100) {
    score += 35;
  } else if (vitals.fid <= 300) {
    score += 20;
  } else {
    score += 10;
  }

  // CLS (Cumulative Layout Shift) - Good: <0.1, Needs Improvement: 0.1-0.25, Poor: >0.25
  if (vitals.cls <= 0.1) {
    score += 30;
  } else if (vitals.cls <= 0.25) {
    score += 20;
  } else {
    score += 10;
  }

  return score;
}

function calculateTechnicalScore(technical: SEOMetrics["technicalSEO"]): number {
  let score = 50; // Start with base score

  // Deduct points for issues
  if (technical.crawlErrors > 0) {
    score -= Math.min(20, technical.crawlErrors * 2); // -2 points per error, max -20
  }

  if (technical.brokenLinks > 0) {
    score -= Math.min(15, technical.brokenLinks * 3); // -3 points per broken link, max -15
  }

  // Add points for good indexing
  if (technical.indexedPages > 100) {
    score += 25;
  } else if (technical.indexedPages > 50) {
    score += 20;
  } else if (technical.indexedPages > 20) {
    score += 15;
  } else if (technical.indexedPages > 10) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

function calculateContentScore(content: NonNullable<SEOMetrics["contentQuality"]>): number {
  let score = 0;

  // Word count (assuming average across pages)
  if (content.avgWordCount >= 1000) {
    score += 30;
  } else if (content.avgWordCount >= 500) {
    score += 20;
  } else if (content.avgWordCount >= 300) {
    score += 15;
  } else {
    score += 10;
  }

  // Heading structure
  if (content.headingStructure) {
    score += 25;
  }

  // Meta descriptions coverage
  if (content.metaDescriptions >= 90) {
    score += 25;
  } // 90%+ coverage
  else if (content.metaDescriptions >= 70) {
    score += 20;
  } else if (content.metaDescriptions >= 50) {
    score += 15;
  } else {
    score += 10;
  }

  // Alt text coverage
  if (content.altTexts >= 90) {
    score += 20;
  } // 90%+ coverage
  else if (content.altTexts >= 70) {
    score += 15;
  } else if (content.altTexts >= 50) {
    score += 10;
  } else {
    score += 5;
  }

  return score;
}
