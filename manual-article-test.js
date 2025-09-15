/**
 * Manual Article Analysis Test - Focused on Model Indicator
 * Tests the specific functionality of the AI model indicator
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

// Test the analysis API directly
async function testAnalysisAPI() {
    console.log('🔗 Testing Analysis API directly...');

    try {
        // Create the request payload
        const payload = {
            content: TEST_ARTICLE_CONTENT,
            author: 'Test Author',
            category: 'AI News',
            tags: ['AI', 'Development', 'Tools']
        };

        console.log('📡 Making POST request to /api/admin/news/analyze...');

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
            console.log('📝 Response data:', JSON.stringify(result, null, 2));

            // Check for model information in the response
            if (result.metadata && result.metadata.model) {
                console.log('🤖 Model information found:', result.metadata.model);
                return { success: true, model: result.metadata.model, result };
            } else {
                console.log('⚠️ No model information in response');
                return { success: true, model: null, result };
            }
        } else {
            const error = await response.text();
            console.log('❌ Analysis failed:', error);
            return { success: false, error };
        }
    } catch (error) {
        console.log('❌ API test error:', error.message);
        return { success: false, error: error.message };
    }
}

// Test using Node.js fetch (available in Node 18+)
testAnalysisAPI().then(result => {
    console.log('\n🏁 Test complete');
    console.log('Result:', result);
}).catch(error => {
    console.log('❌ Test failed:', error);
});