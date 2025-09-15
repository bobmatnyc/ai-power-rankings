/**
 * Corrected Article Analysis Test
 * Uses the proper API schema from the route
 */

const TEST_ARTICLE_CONTENT = `# AI Development Tools Update: Codeium, Magic, and Nvidia NIM

## Codeium Advances AI Code Completion

Codeium has announced significant improvements to their AI-powered code completion platform. The company's latest models show enhanced accuracy in multi-language codebases and better context understanding for large projects.

Key improvements include:
- 40% faster code suggestion generation
- Support for 70+ programming languages
- Enhanced security with local processing options
- Integration with popular IDEs including VSCode, IntelliJ, and Vim

## Magic Raises $320M for AI Software Engineering

Magic, the startup focused on building AI software engineers, has secured $320 million in Series B funding. The company aims to create AI agents capable of understanding and modifying large codebases autonomously.

The funding will accelerate development of:
- Advanced code understanding models
- Automated refactoring capabilities
- Multi-repository project management
- Enterprise-grade security and compliance features

## Nvidia NIM Expands Inference Capabilities

Nvidia's NIM (Nvidia Inference Microservices) platform has introduced new capabilities for deploying AI models at scale. The latest updates focus on improved performance for code generation and analysis tasks.

New features include:
- Optimized inference for transformer models
- Support for custom fine-tuned models
- Enhanced containerization options
- Integration with major cloud platforms

## Industry Impact

These developments represent significant progress in AI-assisted software development. The combination of improved code completion, autonomous software engineering, and scalable inference infrastructure is reshaping how developers approach complex projects.

The trend toward more sophisticated AI development tools suggests we're entering a new phase where AI becomes an integral part of the software development lifecycle, from initial coding to deployment and maintenance.`;

// Test with correct API schema
async function testCorrectAnalysisAPI() {
    console.log('🔗 Testing Analysis API with correct schema...');

    try {
        // Create the request payload using the correct schema
        const payload = {
            input: TEST_ARTICLE_CONTENT,  // The content
            type: "text",                 // Required enum: "url" | "text" | "file"
            verbose: true,                // Optional: enable verbose logging
            saveAsArticle: false          // Optional: don't save as article for testing
        };

        console.log('📡 Making POST request to /api/admin/news/analyze...');
        console.log('📋 Payload structure:', {
            inputLength: payload.input.length,
            type: payload.type,
            verbose: payload.verbose,
            saveAsArticle: payload.saveAsArticle
        });

        const response = await fetch('http://localhost:3001/api/admin/news/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        console.log('📊 Response status:', response.status);
        console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Analysis successful!');
            console.log('📝 Response structure keys:', Object.keys(result));

            // Check for analysis and model information
            if (result.analysis) {
                console.log('🤖 Analysis found!');
                console.log('📊 Analysis keys:', Object.keys(result.analysis));

                // Check for model information
                if (result.analysis.model) {
                    console.log('🎯 Model information found:', result.analysis.model);
                } else {
                    console.log('⚠️ No model information in analysis');
                }

                // Show key analysis fields
                console.log('📰 Article analysis preview:');
                console.log('  Title:', result.analysis.title);
                console.log('  Source:', result.analysis.source);
                console.log('  Tool mentions count:', result.analysis.tool_mentions?.length || 0);
                console.log('  Sentiment:', result.analysis.overall_sentiment);
                console.log('  Importance:', result.analysis.importance_score);

                if (result.analysis.tool_mentions && result.analysis.tool_mentions.length > 0) {
                    console.log('🛠️ Tools mentioned:');
                    result.analysis.tool_mentions.forEach((tool, idx) => {
                        console.log(`  ${idx + 1}. ${tool.tool} (sentiment: ${tool.sentiment})`);
                    });
                }
            }

            return {
                success: true,
                model: result.analysis?.model,
                analysis: result.analysis,
                debug: result.debug
            };
        } else {
            const error = await response.text();
            console.log('❌ Analysis failed:', error);
            return { success: false, error, status: response.status };
        }
    } catch (error) {
        console.log('❌ API test error:', error.message);
        return { success: false, error: error.message };
    }
}

// Generate a test report
function generateAnalysisTestReport(result) {
    const timestamp = new Date().toISOString();

    const report = `
# Article Analysis API Test Report

**Test Execution Time:** ${timestamp}
**Test Environment:** Development Server (http://localhost:3001)
**Test Content:** AI Development Tools Update (Codeium, Magic, Nvidia NIM)

## Test Results

### API Call Result
- **Status:** ${result.success ? '✅ SUCCESS' : '❌ FAILED'}
- **Response Time:** ${result.debug?.processingTime || 'N/A'}
- **Analysis Method:** ${result.debug?.method || 'N/A'}

### AI Model Information
- **Model Used:** ${result.model || 'NOT DETECTED'}
- **Expected Model:** anthropic/claude-sonnet-4
- **Model Detection:** ${result.model ? '✅ SUCCESS' : '❌ FAILED'}

### Analysis Quality
${result.analysis ? `
- **Title Generated:** ${result.analysis.title ? '✅ YES' : '❌ NO'}
- **Summary Generated:** ${result.analysis.summary ? '✅ YES' : '❌ NO'}
- **Tools Extracted:** ${result.analysis.tool_mentions?.length || 0} tools
- **Key Topics:** ${result.analysis.key_topics?.length || 0} topics
- **Sentiment Score:** ${result.analysis.overall_sentiment || 'N/A'}
- **Importance Score:** ${result.analysis.importance_score || 'N/A'}

#### Tools Detected:
${result.analysis.tool_mentions?.map(tool => `- ${tool.tool} (context: ${tool.context})`).join('\n') || 'None detected'}

#### Key Topics:
${result.analysis.key_topics?.map(topic => `- ${topic}`).join('\n') || 'None extracted'}
` : 'No analysis data available'}

### Error Information
${result.error ? `
**Error Details:** ${result.error}
**Status Code:** ${result.status || 'N/A'}
` : 'No errors encountered'}

## Key Findings

### ✅ Model Indicator Test
- The API uses **${result.model || 'UNKNOWN MODEL'}**
- This should be displayed in the UI as **"Claude 4 Sonnet"**
- Model information is ${result.model ? 'properly included' : 'MISSING'} in the response

### 🎯 Recommendations

${result.success && result.model ? `
✅ **API is working correctly**
- Model indicator data is available in response.analysis.model
- UI should display: "${result.model}" as "Claude 4 Sonnet"
- Bot icon should accompany the model indicator
` : `
⚠️ **Issues detected**
${!result.success ? '- API call failed - check authentication and API key\n' : ''}
${!result.model ? '- Model information not included in response\n' : ''}
- Review API response structure and UI implementation
`}

### 🔍 Next Steps for UI Testing

1. **Frontend Integration Test:**
   - Verify UI displays model indicator when analysis completes
   - Confirm "Claude 4 Sonnet" text appears
   - Validate bot icon is rendered
   - Test with the working API response structure

2. **End-to-End Validation:**
   - Test complete workflow: input → analyze → display results
   - Verify model indicator appears in preview section
   - Confirm consistent styling and positioning

---

*This test validates the backend API functionality that powers the article analysis UI model indicator feature.*
`;

    return report;
}

// Execute the test
async function runAPITest() {
    console.log('🧪 Executing Corrected Article Analysis API Test...\n');

    const result = await testCorrectAnalysisAPI();
    const report = generateAnalysisTestReport(result);

    // Save the report
    const fs = require('fs');
    fs.writeFileSync('/Users/masa/Projects/managed/ai-power-ranking/article-analysis-api-test-report.md', report);

    console.log('\n📋 API Test Summary:');
    console.log('====================');
    console.log('API Call Success:', result.success ? '✅' : '❌');
    console.log('Model Detected:', result.model ? `✅ ${result.model}` : '❌');
    console.log('Analysis Generated:', result.analysis ? '✅' : '❌');
    console.log('Processing Time:', result.debug?.processingTime || 'N/A');

    if (result.analysis) {
        console.log('\n📊 Analysis Results:');
        console.log('Title:', result.analysis.title);
        console.log('Tools Found:', result.analysis.tool_mentions?.length || 0);
        console.log('Sentiment:', result.analysis.overall_sentiment);
        console.log('Importance:', result.analysis.importance_score);
    }

    if (result.error) {
        console.log('\n❌ Error Details:');
        console.log(result.error);
    }

    console.log('\n📄 Detailed report saved to: article-analysis-api-test-report.md');
}

// Run the test
runAPITest().catch(console.error);