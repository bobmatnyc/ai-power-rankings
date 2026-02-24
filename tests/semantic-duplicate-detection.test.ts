/**
 * Test semantic duplicate detection
 *
 * This test verifies that the "first wins" semantic duplicate detection
 * correctly identifies articles about the same story from different sources.
 */

import { describe, it, expect } from '@jest/globals';

// Mock search results for testing
interface MockSearchResult {
  url: string;
  title: string;
  description: string;
  source: string;
  publishedDate: string | null;
}

/**
 * Normalize a title for similarity comparison
 */
function normalizeTitle(title: string): string {
  const stopWords = new Set([
    "the", "a", "an", "in", "on", "at", "to", "for", "of", "with", "by",
    "is", "are", "was", "were", "be", "been", "being", "has", "have", "had",
    "do", "does", "did", "will", "would", "should", "could", "may", "might",
    "and", "or", "but", "if", "then", "than", "as", "from", "into", "about",
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word)) // Remove short words and stop words
    .join(' ')
    .trim();
}

/**
 * Calculate Jaccard similarity between two titles
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);

  if (!normalized1 || !normalized2) {
    return 0;
  }

  const words1 = new Set(normalized1.split(' '));
  const words2 = new Set(normalized2.split(' '));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

describe('Semantic Duplicate Detection', () => {
  describe('Title Normalization', () => {
    it('should lowercase titles', () => {
      const result = normalizeTitle('Apple Releases NEW Xcode Agent');
      expect(result).not.toMatch(/[A-Z]/);
    });

    it('should remove punctuation', () => {
      const result = normalizeTitle('Apple, Inc. Releases "Xcode Agent" (Beta)');
      expect(result).not.toMatch(/[,."()]/);
    });

    it('should remove stop words', () => {
      const result = normalizeTitle('The Apple is in the box');
      expect(result).not.toContain('the');
      expect(result).not.toContain('is');
      expect(result).not.toContain('in');
      expect(result).toContain('apple');
      expect(result).toContain('box');
    });

    it('should handle empty strings', () => {
      const result = normalizeTitle('');
      expect(result).toBe('');
    });
  });

  describe('Jaccard Similarity', () => {
    it('should return 1.0 for identical titles', () => {
      const similarity = calculateTitleSimilarity(
        'Apple Announces Xcode Coding Agent',
        'Apple Announces Xcode Coding Agent'
      );
      expect(similarity).toBe(1.0);
    });

    it('should return high similarity for same story, different wording', () => {
      const similarity = calculateTitleSimilarity(
        'Apple Announces Xcode Agent for Developers',
        'Apple Unveils New Xcode Coding Agent'
      );
      // Should be >0.6 due to shared words: apple, xcode, agent
      expect(similarity).toBeGreaterThan(0.6);
    });

    it('should detect duplicates from different sources', () => {
      const titles = [
        'Apple Announces AI-Powered Xcode Agent for Developers',
        'Apple Unveils Xcode Agent: AI Coding Assistant for iOS',
        'New Apple Xcode Agent Brings AI to iOS Development',
        'Apple Launches Agentic Coding Tool in Xcode',
        'Apple Xcode Gets New AI Agent Feature'
      ];

      // All these should be similar to each other (>0.6 threshold)
      for (let i = 0; i < titles.length; i++) {
        for (let j = i + 1; j < titles.length; j++) {
          const similarity = calculateTitleSimilarity(titles[i], titles[j]);
          expect(similarity).toBeGreaterThan(0.5); // At least 50% overlap
        }
      }
    });

    it('should return low similarity for different stories', () => {
      const similarity = calculateTitleSimilarity(
        'Apple Announces Xcode Agent for Developers',
        'Google Releases New Gemini Model'
      );
      expect(similarity).toBeLessThan(0.3);
    });

    it('should handle empty strings gracefully', () => {
      const similarity = calculateTitleSimilarity('', 'Some Title');
      expect(similarity).toBe(0);
    });
  });

  describe('Real-World Examples', () => {
    const appleXcodeArticles: MockSearchResult[] = [
      {
        url: 'https://techcrunch.com/apple-xcode-agent',
        title: 'Apple Announces AI-Powered Xcode Agent for Developers',
        description: 'Apple today announced...',
        source: 'TechCrunch',
        publishedDate: '2025-02-05',
      },
      {
        url: 'https://theverge.com/apple-xcode-ai',
        title: 'Apple Unveils Xcode Agent: New AI Coding Assistant',
        description: 'At its developer event...',
        source: 'The Verge',
        publishedDate: '2025-02-05',
      },
      {
        url: 'https://arstechnica.com/apple-xcode',
        title: 'Apple Launches Agentic Coding Tool in Xcode',
        description: 'Apple has introduced...',
        source: 'Ars Technica',
        publishedDate: '2025-02-05',
      },
      {
        url: 'https://macrumors.com/apple-xcode-agent',
        title: 'Apple Xcode Gets New AI Agent Feature for iOS Development',
        description: 'Apple announced today...',
        source: 'MacRumors',
        publishedDate: '2025-02-05',
      },
      {
        url: 'https://9to5mac.com/apple-xcode',
        title: 'New Apple Xcode Agent Brings AI-Powered Coding',
        description: 'Apple today revealed...',
        source: '9to5Mac',
        publishedDate: '2025-02-05',
      },
    ];

    it('should detect all 5 Apple Xcode articles as duplicates', () => {
      const threshold = 0.65;
      const similarities: number[] = [];

      // Compare first article with all others
      for (let i = 1; i < appleXcodeArticles.length; i++) {
        const similarity = calculateTitleSimilarity(
          appleXcodeArticles[0].title,
          appleXcodeArticles[i].title
        );
        similarities.push(similarity);
      }

      // All should be above threshold
      similarities.forEach((sim, index) => {
        expect(sim).toBeGreaterThan(threshold);
        console.log(
          `Article ${index + 1} similarity to first: ${(sim * 100).toFixed(1)}%`
        );
      });
    });

    it('should keep first article and reject others in batch', () => {
      const threshold = 0.65;
      const uniqueArticles: MockSearchResult[] = [];
      const seenTitles: string[] = [];

      for (const article of appleXcodeArticles) {
        let isDuplicate = false;

        for (const seenTitle of seenTitles) {
          const similarity = calculateTitleSimilarity(article.title, seenTitle);
          if (similarity >= threshold) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          uniqueArticles.push(article);
          seenTitles.push(article.title);
        }
      }

      // Should only keep the first article
      expect(uniqueArticles.length).toBe(1);
      expect(uniqueArticles[0].source).toBe('TechCrunch'); // First one wins
    });
  });
});
