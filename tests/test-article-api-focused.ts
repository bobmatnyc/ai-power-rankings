#!/usr/bin/env tsx

/**
 * Focused Article API Test
 * Test the actual API response format and database insert functionality
 */

interface APIResponse {
  success: boolean;
  mode: 'dry_run' | 'complete';
  result: any;
  message: string;
  error?: string;
}

class FocusedArticleAPITest {
  private baseUrl = 'http://localhost:3001';

  async runTests(): Promise<void> {
    console.log('🧪 Testing Article API with Correct Response Format');
    console.log('=' .repeat(60));

    // Test 1: Dry Run Test
    console.log('\n📋 Test 1: Dry Run Analysis');
    await this.testDryRun();

    // Test 2: Complete Article Save
    console.log('\n📋 Test 2: Complete Article Save');
    await this.testCompleteArticleSave();

    // Test 3: Edge Case - Long Content
    console.log('\n📋 Test 3: Long Content Test');
    await this.testLongContent();

    // Test 4: Unicode and Special Characters
    console.log('\n📋 Test 4: Unicode and Special Characters');
    await this.testUnicodeContent();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All focused tests completed');
  }

  private async testDryRun(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/articles/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: 'Claude Code has revolutionized software development with its advanced reasoning capabilities. GitHub Copilot remains strong in autocomplete. Cursor offers excellent multi-file editing. The competition between these tools is driving innovation in the AI coding space.',
          type: 'text',
          dryRun: true,
          metadata: {
            author: 'Test Author',
            category: 'AI Development Tools'
          }
        })
      });

      const result: APIResponse = await response.json();

      console.log(`Response Status: ${response.status}`);
      console.log(`Success: ${result.success}`);
      console.log(`Mode: ${result.mode}`);

      if (result.success && result.result) {
        console.log('✅ Dry run successful');
        console.log(`Article Title: ${result.result.article?.title || 'N/A'}`);
        console.log(`Tools Affected: ${result.result.summary?.totalToolsAffected || 0}`);
        console.log(`New Tools: ${result.result.summary?.totalNewTools || 0}`);
        console.log(`Predicted Changes: ${result.result.predictedChanges?.length || 0}`);
      } else {
        console.log('❌ Dry run failed');
        console.log(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('❌ Dry run test failed:', error);
    }
  }

  private async testCompleteArticleSave(): Promise<void> {
    try {
      const testContent = `Breaking News: Claude Code Advances AI-Powered Development

The latest updates to Claude Code demonstrate significant improvements in multi-file editing and codebase understanding.
This positions it strongly against competitors like GitHub Copilot, Cursor, and newer entrants like Windsurf.

Key developments include:
- Enhanced reasoning across large codebases
- Improved integration with development workflows
- Better context awareness for complex refactoring tasks

Industry experts predict this will impact the AI coding assistant rankings significantly.`;

      const response = await fetch(`${this.baseUrl}/api/admin/articles/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: testContent,
          type: 'text',
          dryRun: false,
          metadata: {
            author: 'QA Tester',
            category: 'AI Tools',
            publishedDate: new Date().toISOString()
          }
        })
      });

      const result: APIResponse = await response.json();

      console.log(`Response Status: ${response.status}`);
      console.log(`Success: ${result.success}`);
      console.log(`Mode: ${result.mode}`);

      if (result.success && result.result) {
        console.log('✅ Article save successful');
        console.log(`Article ID: ${result.result.id}`);
        console.log(`Article Slug: ${result.result.slug}`);
        console.log(`Article Title: ${result.result.title}`);
        console.log(`Created At: ${result.result.createdAt}`);
        console.log(`Tool Mentions: ${result.result.toolMentions?.length || 0}`);
        console.log(`Company Mentions: ${result.result.companyMentions?.length || 0}`);
        console.log(`Importance Score: ${result.result.importanceScore}`);
        console.log(`Sentiment Score: ${result.result.sentimentScore}`);

        // Test database fields
        const requiredFields = ['id', 'slug', 'title', 'content', 'createdAt'];
        const missingFields = requiredFields.filter(field => !result.result[field]);

        if (missingFields.length === 0) {
          console.log('✅ All required fields present');
        } else {
          console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
        }

        // Test JSON fields
        if (Array.isArray(result.result.toolMentions)) {
          console.log('✅ Tool mentions is array');
        } else {
          console.log('❌ Tool mentions is not array');
        }

        if (Array.isArray(result.result.companyMentions)) {
          console.log('✅ Company mentions is array');
        } else {
          console.log('❌ Company mentions is not array');
        }

      } else {
        console.log('❌ Article save failed');
        console.log(`Error: ${result.error || 'Unknown error'}`);

        if (!response.ok) {
          const responseText = await response.text();
          console.log(`Response Text: ${responseText}`);
        }
      }
    } catch (error) {
      console.log('❌ Complete article save test failed:', error);
    }
  }

  private async testLongContent(): Promise<void> {
    try {
      // Generate long content with tool mentions
      const baseContent = `In-depth analysis of AI coding assistants. Claude Code excels at understanding complex codebases and providing intelligent suggestions. GitHub Copilot offers excellent autocomplete functionality. Cursor provides advanced editing features with AI assistance. `;
      const longContent = baseContent.repeat(200) +
        `\n\nConclusion: The landscape of AI development tools continues to evolve rapidly, with each tool offering unique strengths.`;

      console.log(`Testing with content length: ${longContent.length} characters`);

      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/api/admin/articles/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: longContent,
          type: 'text',
          dryRun: false,
          metadata: {
            author: 'Performance Tester',
            category: 'Performance Test'
          }
        })
      });
      const duration = Date.now() - startTime;

      const result: APIResponse = await response.json();

      console.log(`Response Status: ${response.status}`);
      console.log(`Duration: ${duration}ms`);
      console.log(`Success: ${result.success}`);

      if (result.success) {
        console.log('✅ Long content test successful');
        console.log(`Article ID: ${result.result.id}`);
        console.log(`Content Length Stored: ${result.result.content?.length || 0}`);

        // Performance check
        if (duration < 30000) {
          console.log('✅ Performance within acceptable range');
        } else {
          console.log('⚠️  Performance slower than expected');
        }
      } else {
        console.log('❌ Long content test failed');
        console.log(`Error: ${result.error}`);
      }
    } catch (error) {
      console.log('❌ Long content test failed:', error);
    }
  }

  private async testUnicodeContent(): Promise<void> {
    try {
      const unicodeContent = `AI Tools Global Analysis 🌍

Claude Code 🤖 has gained significant traction among developers worldwide.
The tool supports multiple languages including:
- English development workflows
- 中文编程支持 (Chinese programming support)
- 日本語での開発 (Japanese development)
- Programmation en français (French programming)
- Desarrollo en español (Spanish development)

Special characters and symbols: @#$%^&*()[]{}|\\;:'"<>?/\`~
Mathematical symbols: ∑∏∫∆∇∂∞±≤≥≠≈√

GitHub Copilot 💻 and Cursor ⚡ also provide excellent international support.

The competition between these tools (Claude Code vs. GitHub Copilot vs. Cursor)
is driving innovation in the AI coding space 🚀.`;

      const response = await fetch(`${this.baseUrl}/api/admin/articles/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: unicodeContent,
          type: 'text',
          dryRun: false,
          metadata: {
            author: 'Unicode Tester 测试员',
            category: 'Unicode Test テスト'
          }
        })
      });

      const result: APIResponse = await response.json();

      console.log(`Response Status: ${response.status}`);
      console.log(`Success: ${result.success}`);

      if (result.success) {
        console.log('✅ Unicode content test successful');
        console.log(`Article ID: ${result.result.id}`);
        console.log(`Author preserved: ${result.result.author}`);
        console.log(`Category preserved: ${result.result.category}`);

        // Check if unicode content is preserved
        if (result.result.content?.includes('🌍') && result.result.content?.includes('中文')) {
          console.log('✅ Unicode characters preserved correctly');
        } else {
          console.log('⚠️  Unicode characters may not be preserved correctly');
        }
      } else {
        console.log('❌ Unicode content test failed');
        console.log(`Error: ${result.error}`);
      }
    } catch (error) {
      console.log('❌ Unicode content test failed:', error);
    }
  }
}

// Run the focused tests
async function main() {
  const tester = new FocusedArticleAPITest();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}