/**
 * Comprehensive Test for Article Analysis UI with AI Model Indicator
 * Tests the complete flow of article analysis including the Claude 4 Sonnet indicator
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Test article content about AI tools (same content we used in previous tests)
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

async function testArticleAnalysisUI() {
    let browser;
    let testResults = {
        serverAccessible: false,
        adminPanelLoaded: false,
        articleManagementVisible: false,
        contentInputWorking: false,
        analyzeButtonVisible: false,
        analysisExecuted: false,
        modelIndicatorVisible: false,
        claudeSonnetDisplayed: false,
        botIconVisible: false,
        previewGenerated: false,
        errors: []
    };

    try {
        console.log('🚀 Starting Article Analysis UI Test...');

        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1400, height: 900 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Enable console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ Console Error:', msg.text());
                testResults.errors.push(`Console Error: ${msg.text()}`);
            }
        });

        page.on('pageerror', error => {
            console.log('❌ Page Error:', error.message);
            testResults.errors.push(`Page Error: ${error.message}`);
        });

        // Test 1: Access the development server
        console.log('📡 Testing server accessibility...');
        try {
            await page.goto('http://localhost:3001', { waitUntil: 'networkidle2', timeout: 10000 });
            testResults.serverAccessible = true;
            console.log('✅ Server accessible');
        } catch (error) {
            testResults.errors.push(`Server access failed: ${error.message}`);
            throw error;
        }

        // Test 2: Navigate to admin panel
        console.log('🔐 Navigating to admin panel...');
        try {
            await page.goto('http://localhost:3001/admin', { waitUntil: 'networkidle2', timeout: 10000 });

            // Wait for admin panel to load
            await page.waitForSelector('h1', { timeout: 5000 });
            const heading = await page.$eval('h1', el => el.textContent);

            if (heading.includes('Admin') || heading.includes('Dashboard')) {
                testResults.adminPanelLoaded = true;
                console.log('✅ Admin panel loaded');
            }
        } catch (error) {
            testResults.errors.push(`Admin panel access failed: ${error.message}`);
            console.log('❌ Admin panel access failed:', error.message);
        }

        // Test 3: Check for Article Management section
        console.log('📝 Looking for Article Management section...');
        try {
            // Look for Article Management tab or section
            const articleManagementElements = await page.$x("//h2[contains(text(), 'Article Management')] | //h3[contains(text(), 'Article Management')] | //button[contains(text(), 'Article Management')] | //div[contains(text(), 'Article Management')]");

            if (articleManagementElements.length > 0) {
                testResults.articleManagementVisible = true;
                console.log('✅ Article Management section found');

                // Click on it if it's a button/tab
                const element = articleManagementElements[0];
                const tagName = await element.evaluate(el => el.tagName.toLowerCase());
                if (tagName === 'button') {
                    await element.click();
                    await page.waitForTimeout(1000);
                }
            } else {
                // Look for any form or textarea that might be the article input
                const textareaExists = await page.$('textarea');
                if (textareaExists) {
                    testResults.articleManagementVisible = true;
                    console.log('✅ Article input form found');
                }
            }
        } catch (error) {
            testResults.errors.push(`Article Management section not found: ${error.message}`);
            console.log('❌ Article Management section not found:', error.message);
        }

        // Test 4: Test content input
        console.log('✏️  Testing content input...');
        try {
            // Look for textarea or content input field
            const contentInput = await page.$('textarea') || await page.$('input[type="text"]') || await page.$('.content-input');

            if (contentInput) {
                await contentInput.click();
                await contentInput.clear();
                await contentInput.type(TEST_ARTICLE_CONTENT);
                testResults.contentInputWorking = true;
                console.log('✅ Content input working');

                // Wait a moment for any real-time updates
                await page.waitForTimeout(1000);
            }
        } catch (error) {
            testResults.errors.push(`Content input failed: ${error.message}`);
            console.log('❌ Content input failed:', error.message);
        }

        // Test 5: Look for and test Analyze button
        console.log('🔍 Looking for Analyze button...');
        try {
            const analyzeButton = await page.$x("//button[contains(text(), 'Analyze') or contains(text(), 'Process') or contains(text(), 'Submit')]");

            if (analyzeButton.length > 0) {
                testResults.analyzeButtonVisible = true;
                console.log('✅ Analyze button found');

                // Click the analyze button
                console.log('🎯 Clicking analyze button...');
                await analyzeButton[0].click();

                // Wait for analysis to complete (with timeout)
                console.log('⏳ Waiting for analysis to complete...');
                await page.waitForTimeout(3000);

                // Look for loading states or completion indicators
                const loadingElements = await page.$x("//*[contains(text(), 'Analyzing') or contains(text(), 'Processing') or contains(text(), 'Loading')]");
                const completedElements = await page.$x("//*[contains(text(), 'Analysis complete') or contains(text(), 'Processed') or contains(text(), 'Generated')]");

                if (loadingElements.length > 0 || completedElements.length > 0) {
                    testResults.analysisExecuted = true;
                    console.log('✅ Analysis executed');
                }

                // Wait for potential API call completion
                await page.waitForTimeout(5000);

            }
        } catch (error) {
            testResults.errors.push(`Analyze button test failed: ${error.message}`);
            console.log('❌ Analyze button test failed:', error.message);
        }

        // Test 6: Check for AI Model Indicator
        console.log('🤖 Checking for AI Model Indicator...');
        try {
            // Look for model indicator text
            const modelIndicatorElements = await page.$x("//*[contains(text(), 'Claude') or contains(text(), 'Model') or contains(text(), 'AI Model')]");

            if (modelIndicatorElements.length > 0) {
                testResults.modelIndicatorVisible = true;
                console.log('✅ Model indicator found');

                // Check specifically for "Claude 4 Sonnet" or "Claude Sonnet"
                const claudeElements = await page.$x("//*[contains(text(), 'Claude') and (contains(text(), 'Sonnet') or contains(text(), '4'))]");
                if (claudeElements.length > 0) {
                    testResults.claudeSonnetDisplayed = true;
                    console.log('✅ Claude Sonnet indicator found');

                    // Get the exact text
                    const claudeText = await claudeElements[0].evaluate(el => el.textContent);
                    console.log('📝 Model text:', claudeText);
                }
            }

            // Look for Bot icon (could be an SVG, span with icon class, or emoji)
            const botIconElements = await page.$x("//*[contains(@class, 'bot') or contains(@class, 'robot') or contains(text(), '🤖')]");
            if (botIconElements.length > 0) {
                testResults.botIconVisible = true;
                console.log('✅ Bot icon found');
            }

        } catch (error) {
            testResults.errors.push(`Model indicator check failed: ${error.message}`);
            console.log('❌ Model indicator check failed:', error.message);
        }

        // Test 7: Check for generated preview
        console.log('📋 Checking for generated preview...');
        try {
            // Look for preview content or results
            const previewElements = await page.$x("//*[contains(text(), 'Preview') or contains(text(), 'Summary') or contains(text(), 'Result')]");

            if (previewElements.length > 0) {
                testResults.previewGenerated = true;
                console.log('✅ Preview content found');
            }

            // Look for any structured output that might be the analysis result
            const resultContainers = await page.$$('div[class*="result"], div[class*="preview"], div[class*="output"]');
            if (resultContainers.length > 0) {
                testResults.previewGenerated = true;
                console.log('✅ Analysis result container found');
            }

        } catch (error) {
            testResults.errors.push(`Preview check failed: ${error.message}`);
            console.log('❌ Preview check failed:', error.message);
        }

        // Take a screenshot for documentation
        console.log('📸 Taking screenshot...');
        await page.screenshot({
            path: '/Users/masa/Projects/managed/ai-power-ranking/article-analysis-test-screenshot.png',
            fullPage: true
        });

        // Get page HTML for analysis
        const pageHTML = await page.content();
        fs.writeFileSync('/Users/masa/Projects/managed/ai-power-ranking/article-analysis-page-content.html', pageHTML);

    } catch (error) {
        console.log('❌ Test execution error:', error.message);
        testResults.errors.push(`Test execution error: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    return testResults;
}

// Generate comprehensive test report
function generateTestReport(results) {
    const timestamp = new Date().toISOString();

    const report = `
# Article Analysis UI Test Report

**Test Execution Time:** ${timestamp}
**Test Environment:** Development Server (http://localhost:3001)

## Test Results Summary

### ✅ Successful Tests
${Object.entries(results)
    .filter(([key, value]) => key !== 'errors' && value === true)
    .map(([key]) => `- ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
    .join('\n')}

### ❌ Failed Tests
${Object.entries(results)
    .filter(([key, value]) => key !== 'errors' && value === false)
    .map(([key]) => `- ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
    .join('\n')}

### 🔍 Detailed Results

| Test Component | Status | Description |
|----------------|--------|-------------|
| Server Access | ${results.serverAccessible ? '✅ PASS' : '❌ FAIL'} | Development server accessibility |
| Admin Panel | ${results.adminPanelLoaded ? '✅ PASS' : '❌ FAIL'} | Admin dashboard loading |
| Article Management | ${results.articleManagementVisible ? '✅ PASS' : '❌ FAIL'} | Article management UI visibility |
| Content Input | ${results.contentInputWorking ? '✅ PASS' : '❌ FAIL'} | Text input functionality |
| Analyze Button | ${results.analyzeButtonVisible ? '✅ PASS' : '❌ FAIL'} | Analysis trigger button |
| Analysis Execution | ${results.analysisExecuted ? '✅ PASS' : '❌ FAIL'} | Analysis process execution |
| **Model Indicator** | ${results.modelIndicatorVisible ? '✅ PASS' : '❌ FAIL'} | **AI model indicator visibility** |
| **Claude Sonnet Display** | ${results.claudeSonnetDisplayed ? '✅ PASS' : '❌ FAIL'} | **Claude 4 Sonnet text display** |
| **Bot Icon** | ${results.botIconVisible ? '✅ PASS' : '❌ FAIL'} | **Bot icon in UI** |
| Preview Generation | ${results.previewGenerated ? '✅ PASS' : '❌ FAIL'} | Analysis result preview |

### 🚨 Errors Encountered

${results.errors.length > 0 ?
    results.errors.map(error => `- ${error}`).join('\n') :
    'No errors encountered during testing.'}

### 📊 Test Coverage Analysis

**Core Functionality:** ${results.serverAccessible && results.adminPanelLoaded ? '✅ WORKING' : '❌ ISSUES'}
**Article Management Flow:** ${results.articleManagementVisible && results.contentInputWorking ? '✅ WORKING' : '❌ ISSUES'}
**AI Analysis Pipeline:** ${results.analyzeButtonVisible && results.analysisExecuted ? '✅ WORKING' : '❌ ISSUES'}
**Model Indicator Feature:** ${results.modelIndicatorVisible && results.claudeSonnetDisplayed && results.botIconVisible ? '✅ WORKING' : '❌ ISSUES'}

### 🎯 Key Findings

#### AI Model Indicator Implementation
- Model indicator visibility: ${results.modelIndicatorVisible ? 'DETECTED' : 'NOT DETECTED'}
- Claude Sonnet text: ${results.claudeSonnetDisplayed ? 'DISPLAYED' : 'NOT DISPLAYED'}
- Bot icon presence: ${results.botIconVisible ? 'PRESENT' : 'MISSING'}

#### Recommendations

${results.modelIndicatorVisible && results.claudeSonnetDisplayed && results.botIconVisible ?
  '✅ **AI Model Indicator is working correctly**\n- All components are displaying as expected\n- No immediate action required' :
  '⚠️ **AI Model Indicator needs attention**\n' +
  (!results.modelIndicatorVisible ? '- Model indicator component not visible\n' : '') +
  (!results.claudeSonnetDisplayed ? '- Claude Sonnet text not displayed\n' : '') +
  (!results.botIconVisible ? '- Bot icon not present\n' : '') +
  '- Review component implementation and styling'
}

### 📝 Test Artifacts

- Screenshot: \`article-analysis-test-screenshot.png\`
- Page HTML: \`article-analysis-page-content.html\`
- Test execution logs: Available in console output

### 🔄 Next Steps

1. Review any failed test components
2. Verify API endpoint functionality if analysis failed
3. Check component styling and visibility
4. Validate model indicator implementation
5. Test with different article content types

---

*This test was executed using the AI-tools-research content sample covering Codeium, Magic, and Nvidia NIM developments.*
`;

    return report;
}

// Execute the test
async function runTest() {
    console.log('🧪 Executing Article Analysis UI Test Suite...\n');

    const results = await testArticleAnalysisUI();
    const report = generateTestReport(results);

    // Save the report
    fs.writeFileSync('/Users/masa/Projects/managed/ai-power-ranking/article-analysis-test-report.md', report);

    console.log('\n📋 Test Results Summary:');
    console.log('========================');
    console.log('Server Access:', results.serverAccessible ? '✅' : '❌');
    console.log('Admin Panel:', results.adminPanelLoaded ? '✅' : '❌');
    console.log('Article Management:', results.articleManagementVisible ? '✅' : '❌');
    console.log('Content Input:', results.contentInputWorking ? '✅' : '❌');
    console.log('Analyze Button:', results.analyzeButtonVisible ? '✅' : '❌');
    console.log('Analysis Execution:', results.analysisExecuted ? '✅' : '❌');
    console.log('Model Indicator:', results.modelIndicatorVisible ? '✅' : '❌');
    console.log('Claude Sonnet Display:', results.claudeSonnetDisplayed ? '✅' : '❌');
    console.log('Bot Icon:', results.botIconVisible ? '✅' : '❌');
    console.log('Preview Generation:', results.previewGenerated ? '✅' : '❌');

    if (results.errors.length > 0) {
        console.log('\n❌ Errors:');
        results.errors.forEach(error => console.log('  -', error));
    }

    console.log('\n📄 Detailed report saved to: article-analysis-test-report.md');
    console.log('📸 Screenshot saved to: article-analysis-test-screenshot.png');
}

// Check if puppeteer is available and run the test
(async () => {
    try {
        await runTest();
    } catch (error) {
        console.error('❌ Failed to run test:', error.message);
        console.log('💡 Please ensure puppeteer is installed: npm install puppeteer');
    }
})();