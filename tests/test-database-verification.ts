#!/usr/bin/env tsx

/**
 * Database Storage Verification Test
 * Verify that articles are being correctly stored in the database
 */

import { getDb } from '@/lib/db/connection';
import { articles, articleRankingsChanges, articleProcessingLogs } from '@/lib/db/article-schema';
import { desc, eq } from 'drizzle-orm';

class DatabaseVerificationTest {
  private db: ReturnType<typeof getDb>;

  constructor() {
    this.db = getDb();
    if (!this.db) {
      throw new Error('Database connection not available');
    }
  }

  async runVerification(): Promise<void> {
    console.log('🗃️  Database Storage Verification');
    console.log('=' .repeat(60));

    // Test 1: Check recent articles
    await this.checkRecentArticles();

    // Test 2: Verify article data integrity
    await this.verifyArticleDataIntegrity();

    // Test 3: Check ranking changes
    await this.checkRankingChanges();

    // Test 4: Check processing logs
    await this.checkProcessingLogs();

    // Test 5: Verify JSON field storage
    await this.verifyJSONFields();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Database verification completed');
  }

  private async checkRecentArticles(): Promise<void> {
    console.log('\n📋 Test 1: Recent Articles Check');

    try {
      const recentArticles = await this.db
        .select()
        .from(articles)
        .orderBy(desc(articles.createdAt))
        .limit(10);

      console.log(`Found ${recentArticles.length} recent articles`);

      if (recentArticles.length === 0) {
        console.log('❌ No articles found in database');
        return;
      }

      console.log('\nRecent articles:');
      recentArticles.forEach((article: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${article.id}`);
        console.log(`     Title: ${article.title}`);
        console.log(`     Slug: ${article.slug}`);
        console.log(`     Status: ${article.status}`);
        console.log(`     Created: ${article.createdAt}`);
        console.log(`     Content Length: ${article.content?.length || 0}`);
        console.log(`     Tool Mentions: ${Array.isArray(article.toolMentions) ? article.toolMentions.length : 'Invalid'}`);
        console.log('');
      });

      console.log('✅ Recent articles check completed');
    } catch (error) {
      console.log('❌ Recent articles check failed:', error);
    }
  }

  private async verifyArticleDataIntegrity(): Promise<void> {
    console.log('\n📋 Test 2: Article Data Integrity');

    try {
      const testArticles = await this.db
        .select()
        .from(articles)
        .where(eq(articles.status, 'active'))
        .orderBy(desc(articles.createdAt))
        .limit(5);

      if (testArticles.length === 0) {
        console.log('❌ No active articles found');
        return;
      }

      let integrityIssues = 0;

      for (const article of testArticles) {
        console.log(`\nChecking article: ${article.title}`);

        // Check required fields
        const requiredFields = {
          id: article.id,
          slug: article.slug,
          title: article.title,
          content: article.content,
          createdAt: article.createdAt
        };

        const missingFields = Object.entries(requiredFields)
          .filter(([_, value]) => !value)
          .map(([key, _]) => key);

        if (missingFields.length > 0) {
          console.log(`  ❌ Missing required fields: ${missingFields.join(', ')}`);
          integrityIssues++;
        } else {
          console.log('  ✅ All required fields present');
        }

        // Check data types
        if (typeof article.id !== 'string') {
          console.log('  ❌ ID is not string');
          integrityIssues++;
        }

        if (typeof article.title !== 'string') {
          console.log('  ❌ Title is not string');
          integrityIssues++;
        }

        if (typeof article.content !== 'string') {
          console.log('  ❌ Content is not string');
          integrityIssues++;
        }

        // Check JSON fields
        if (article.toolMentions !== null && !Array.isArray(article.toolMentions)) {
          console.log('  ❌ Tool mentions is not array');
          integrityIssues++;
        } else if (Array.isArray(article.toolMentions)) {
          console.log(`  ✅ Tool mentions array with ${article.toolMentions.length} items`);
        }

        if (article.companyMentions !== null && !Array.isArray(article.companyMentions)) {
          console.log('  ❌ Company mentions is not array');
          integrityIssues++;
        } else if (Array.isArray(article.companyMentions)) {
          console.log(`  ✅ Company mentions array with ${article.companyMentions.length} items`);
        }

        if (article.tags !== null && !Array.isArray(article.tags)) {
          console.log('  ❌ Tags is not array');
          integrityIssues++;
        } else if (Array.isArray(article.tags)) {
          console.log(`  ✅ Tags array with ${article.tags.length} items`);
        }

        // Check numeric fields
        if (typeof article.importanceScore === 'number') {
          if (article.importanceScore >= 1 && article.importanceScore <= 10) {
            console.log(`  ✅ Importance score valid: ${article.importanceScore}`);
          } else {
            console.log(`  ⚠️  Importance score out of range: ${article.importanceScore}`);
          }
        } else {
          console.log(`  ❌ Importance score is not number: ${typeof article.importanceScore}`);
          integrityIssues++;
        }

        // Check sentiment score
        if (typeof article.sentimentScore === 'string') {
          const sentimentNum = parseFloat(article.sentimentScore);
          if (!isNaN(sentimentNum) && sentimentNum >= -1 && sentimentNum <= 1) {
            console.log(`  ✅ Sentiment score valid: ${article.sentimentScore}`);
          } else {
            console.log(`  ⚠️  Sentiment score out of range: ${article.sentimentScore}`);
          }
        } else {
          console.log(`  ❌ Sentiment score is not string: ${typeof article.sentimentScore}`);
          integrityIssues++;
        }
      }

      if (integrityIssues === 0) {
        console.log('\n✅ All articles passed integrity checks');
      } else {
        console.log(`\n⚠️  Found ${integrityIssues} integrity issues`);
      }

    } catch (error) {
      console.log('❌ Article data integrity check failed:', error);
    }
  }

  private async checkRankingChanges(): Promise<void> {
    console.log('\n📋 Test 3: Ranking Changes Check');

    try {
      const recentChanges = await this.db
        .select()
        .from(articleRankingsChanges)
        .orderBy(desc(articleRankingsChanges.createdAt))
        .limit(10);

      console.log(`Found ${recentChanges.length} recent ranking changes`);

      if (recentChanges.length > 0) {
        console.log('\nRecent ranking changes:');
        recentChanges.forEach((change: any, index: number) => {
          console.log(`  ${index + 1}. Tool: ${change.toolName}`);
          console.log(`     Article ID: ${change.articleId}`);
          console.log(`     Rank Change: ${change.oldRank} → ${change.newRank} (${change.rankChange > 0 ? '+' : ''}${change.rankChange})`);
          console.log(`     Score Change: ${change.oldScore} → ${change.newScore}`);
          console.log(`     Change Type: ${change.changeType}`);
          console.log(`     Applied: ${change.isApplied}`);
          console.log('');
        });
        console.log('✅ Ranking changes are being recorded');
      } else {
        console.log('⚠️  No ranking changes found (this might be expected for dry runs)');
      }

    } catch (error) {
      console.log('❌ Ranking changes check failed:', error);
    }
  }

  private async checkProcessingLogs(): Promise<void> {
    console.log('\n📋 Test 4: Processing Logs Check');

    try {
      const recentLogs = await this.db
        .select()
        .from(articleProcessingLogs)
        .orderBy(desc(articleProcessingLogs.createdAt))
        .limit(10);

      console.log(`Found ${recentLogs.length} recent processing logs`);

      if (recentLogs.length > 0) {
        console.log('\nRecent processing logs:');
        recentLogs.forEach((log: any, index: number) => {
          console.log(`  ${index + 1}. Action: ${log.action}`);
          console.log(`     Status: ${log.status}`);
          console.log(`     Article ID: ${log.articleId}`);
          console.log(`     Duration: ${log.durationMs || 'N/A'}ms`);
          console.log(`     Performed By: ${log.performedBy}`);
          console.log(`     Created: ${log.createdAt}`);
          if (log.errorMessage) {
            console.log(`     Error: ${log.errorMessage}`);
          }
          console.log('');
        });
        console.log('✅ Processing logs are being recorded');
      } else {
        console.log('⚠️  No processing logs found');
      }

    } catch (error) {
      console.log('❌ Processing logs check failed:', error);
    }
  }

  private async verifyJSONFields(): Promise<void> {
    console.log('\n📋 Test 5: JSON Fields Verification');

    try {
      const articlesWithJSON = await this.db
        .select()
        .from(articles)
        .where(eq(articles.status, 'active'))
        .orderBy(desc(articles.createdAt))
        .limit(3);

      if (articlesWithJSON.length === 0) {
        console.log('❌ No articles found for JSON verification');
        return;
      }

      for (const article of articlesWithJSON) {
        console.log(`\nVerifying JSON fields for: ${article.title}`);

        // Check tool mentions structure
        if (Array.isArray(article.toolMentions) && article.toolMentions.length > 0) {
          const firstMention = article.toolMentions[0];
          const expectedFields = ['tool', 'context', 'sentiment', 'relevance'];
          const hasAllFields = expectedFields.every(field => field in firstMention);

          if (hasAllFields) {
            console.log('  ✅ Tool mentions have correct structure');
            console.log(`     Sample: ${JSON.stringify(firstMention, null, 2).replace(/\n/g, '\n     ')}`);
          } else {
            console.log('  ⚠️  Tool mentions missing some expected fields');
            console.log(`     Available fields: ${Object.keys(firstMention).join(', ')}`);
          }
        } else {
          console.log('  ℹ️  No tool mentions found');
        }

        // Check company mentions structure
        if (Array.isArray(article.companyMentions) && article.companyMentions.length > 0) {
          const firstMention = article.companyMentions[0];
          console.log('  ✅ Company mentions found');
          console.log(`     Sample: ${JSON.stringify(firstMention, null, 2).replace(/\n/g, '\n     ')}`);
        } else {
          console.log('  ℹ️  No company mentions found');
        }

        // Check rankings snapshot
        if (article.rankingsSnapshot && typeof article.rankingsSnapshot === 'object') {
          console.log('  ✅ Rankings snapshot is valid JSON object');
          if ('timestamp' in article.rankingsSnapshot) {
            console.log(`     Snapshot timestamp: ${article.rankingsSnapshot.timestamp}`);
          }
        } else {
          console.log('  ⚠️  No rankings snapshot found');
        }
      }

      console.log('\n✅ JSON fields verification completed');

    } catch (error) {
      console.log('❌ JSON fields verification failed:', error);
    }
  }
}

// Run the verification
async function main() {
  try {
    const verifier = new DatabaseVerificationTest();
    await verifier.runVerification();
  } catch (error) {
    console.error('Database verification failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}