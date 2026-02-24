/**
 * Manual Test Script for Semantic Duplicate Detection
 *
 * This script demonstrates the semantic duplicate detection logic
 * without requiring a full test framework setup.
 *
 * Run with: npx tsx scripts/test-semantic-deduplication.ts
 */

// Test data: 5 articles about the same story (Apple Xcode)
const appleXcodeArticles = [
  {
    title: 'Apple Announces AI-Powered Xcode Agent for Developers',
    source: 'TechCrunch',
  },
  {
    title: 'Apple Unveils Xcode Agent: New AI Coding Assistant',
    source: 'The Verge',
  },
  {
    title: 'Apple Launches Agentic Coding Tool in Xcode',
    source: 'Ars Technica',
  },
  {
    title: 'Apple Xcode Gets New AI Agent Feature for iOS Development',
    source: 'MacRumors',
  },
  {
    title: 'New Apple Xcode Agent Brings AI-Powered Coding',
    source: '9to5Mac',
  },
];

// Additional test: Different story (should NOT be duplicate)
const differentStory = {
  title: 'Google Releases New Gemini 2.0 Model with Enhanced Capabilities',
  source: 'Google Blog',
};

/**
 * Normalize a title for similarity comparison
 */
function normalizeTitle(title: string): string {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'has',
    'have',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'and',
    'or',
    'but',
    'if',
    'then',
    'than',
    'as',
    'from',
    'into',
    'about',
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .join(' ')
    .trim();
}

/**
 * Extract key semantic features from title (companies, products, topics)
 */
function extractKeyFeatures(title: string): Set<string> {
  const normalized = normalizeTitle(title);
  const words = normalized.split(' ');

  const keyEntities = new Set([
    'openai',
    'anthropic',
    'google',
    'microsoft',
    'apple',
    'amazon',
    'meta',
    'claude',
    'chatgpt',
    'gemini',
    'copilot',
    'xcode',
    'cursor',
    'devin',
    'github',
    'agent',
    'coding',
    'assistant',
    'model',
    'release',
    'launch',
    'announces',
    'unveils',
    'funding',
    'acquisition',
    'partnership',
  ]);

  return new Set(words.filter((w) => keyEntities.has(w)));
}

/**
 * Calculate weighted similarity between two titles
 * Uses both standard Jaccard and key feature matching
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);

  if (!normalized1 || !normalized2) {
    return 0;
  }

  const words1 = new Set(normalized1.split(' '));
  const words2 = new Set(normalized2.split(' '));

  // Calculate standard Jaccard similarity
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

  // Extract key features
  const features1 = extractKeyFeatures(title1);
  const features2 = extractKeyFeatures(title2);

  if (features1.size > 0 && features2.size > 0) {
    const featureIntersection = new Set([...features1].filter((f) => features2.has(f)));
    const featureUnion = new Set([...features1, ...features2]);
    const featureSimilarity = featureUnion.size > 0 ? featureIntersection.size / featureUnion.size : 0;

    // Weighted: 40% standard + 60% features
    return jaccardSimilarity * 0.4 + featureSimilarity * 0.6;
  }

  return jaccardSimilarity;
}

/**
 * Simulate the deduplication logic
 */
function filterSemanticDuplicates(
  articles: Array<{ title: string; source: string }>,
  threshold: number = 0.35
): Array<{ title: string; source: string }> {
  const uniqueArticles: Array<{ title: string; source: string }> = [];
  const seenTitles: string[] = [];

  console.log('\n=== Starting Semantic Deduplication ===');
  console.log(`Threshold: ${(threshold * 100).toFixed(0)}% weighted similarity`);
  console.log(`Algorithm: 40% word overlap + 60% key feature overlap\n`);

  for (const article of articles) {
    let isDuplicate = false;
    let matchedTitle = '';
    let maxSimilarity = 0;

    for (const seenTitle of seenTitles) {
      const similarity = calculateTitleSimilarity(article.title, seenTitle);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedTitle = seenTitle;
      }

      if (similarity >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      console.log(`❌ DUPLICATE DETECTED`);
      console.log(`   Source: ${article.source}`);
      console.log(`   Title: "${article.title.substring(0, 60)}..."`);
      console.log(
        `   Similar to: "${matchedTitle.substring(0, 60)}..."`
      );
      console.log(`   Similarity: ${(maxSimilarity * 100).toFixed(1)}%\n`);
    } else {
      console.log(`✅ UNIQUE ARTICLE`);
      console.log(`   Source: ${article.source}`);
      console.log(`   Title: "${article.title.substring(0, 60)}..."`);
      if (seenTitles.length > 0) {
        console.log(`   Max similarity to existing: ${(maxSimilarity * 100).toFixed(1)}%`);
      }
      console.log('');
      uniqueArticles.push(article);
      seenTitles.push(article.title);
    }
  }

  return uniqueArticles;
}

/**
 * Run tests
 */
function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   SEMANTIC DUPLICATE DETECTION - MANUAL TEST                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  // Test 1: Apple Xcode articles (should detect 4 duplicates)
  console.log('\n📰 TEST 1: Apple Xcode Articles (Same Story, Different Sources)');
  console.log('═══════════════════════════════════════════════════════════════');

  const uniqueXcodeArticles = filterSemanticDuplicates(appleXcodeArticles);

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`📊 RESULTS:`);
  console.log(`   Total articles: ${appleXcodeArticles.length}`);
  console.log(`   Unique articles: ${uniqueXcodeArticles.length}`);
  console.log(`   Duplicates removed: ${appleXcodeArticles.length - uniqueXcodeArticles.length}`);
  console.log(`   First winner: ${uniqueXcodeArticles[0]?.source || 'None'}`);

  // Test 2: Add different story (should NOT be duplicate)
  console.log('\n\n📰 TEST 2: Mixed Stories (Apple Xcode + Google Gemini)');
  console.log('═══════════════════════════════════════════════════════════════');

  const mixedArticles = [...appleXcodeArticles, differentStory];
  const uniqueMixedArticles = filterSemanticDuplicates(mixedArticles);

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`📊 RESULTS:`);
  console.log(`   Total articles: ${mixedArticles.length}`);
  console.log(`   Unique articles: ${uniqueMixedArticles.length}`);
  console.log(`   Duplicates removed: ${mixedArticles.length - uniqueMixedArticles.length}`);
  console.log(`   Expected unique: 2 (1 Apple + 1 Google)`);
  console.log(`   Actual unique: ${uniqueMixedArticles.length}`);

  // Test 3: Similarity Matrix
  console.log('\n\n📊 TEST 3: Similarity Matrix (All Pairs)');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log('\nApple Xcode Articles:');
  for (let i = 0; i < appleXcodeArticles.length; i++) {
    for (let j = i + 1; j < appleXcodeArticles.length; j++) {
      const similarity = calculateTitleSimilarity(
        appleXcodeArticles[i].title,
        appleXcodeArticles[j].title
      );
      console.log(
        `${appleXcodeArticles[i].source} ↔ ${appleXcodeArticles[j].source}: ${(similarity * 100).toFixed(1)}%`
      );
    }
  }

  console.log('\nApple vs Google:');
  const crossSimilarity = calculateTitleSimilarity(
    appleXcodeArticles[0].title,
    differentStory.title
  );
  console.log(
    `${appleXcodeArticles[0].source} ↔ ${differentStory.source}: ${(crossSimilarity * 100).toFixed(1)}%`
  );

  // Final Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   TEST SUMMARY                                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const test1Pass = uniqueXcodeArticles.length === 1;
  const test2Pass = uniqueMixedArticles.length === 2;

  console.log(`\nTest 1 (Xcode duplicates): ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Expected: 1 unique article (first wins)`);
  console.log(`   Actual: ${uniqueXcodeArticles.length} unique article(s)`);

  console.log(`\nTest 2 (Mixed stories): ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Expected: 2 unique articles (1 Apple + 1 Google)`);
  console.log(`   Actual: ${uniqueMixedArticles.length} unique article(s)`);

  console.log(`\n${'═'.repeat(65)}`);
  console.log(
    `Overall: ${test1Pass && test2Pass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`
  );
  console.log(`${'═'.repeat(65)}\n`);
}

// Run the tests
runTests();
