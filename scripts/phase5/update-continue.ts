import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Continue - Open Source Copilot Alternative
 * Update comprehensive content for the leading open-source AI code assistant
 */

const continueData = {
  id: "continue",
  name: "Continue",
  company: "Continue (Open Source)",
  tagline: "Leading open-source AI code assistant for VS Code and JetBrains with model flexibility, local support, and 100% free",
  description: "Continue is the leading open-source AI code assistant that empowers developers to build custom autocomplete and chat experiences directly within VS Code and JetBrains IDEs with complete flexibility to use any AI model provider including cloud-based (Gemini, Mistral, ChatGPT, Claude Sonnet) and local models (LLaMA, Quen via Ollama). Unlike GitHub Copilot's single-provider lock-in, Continue is model-agnostic enabling developers to switch between free and paid LLMs, run models locally with Ollama for full control and zero dependency on cloud providers, and customize completion experience, chat integration, and context awareness to their specific needs. Continue provides intelligent code completion with inline suggestions and tab completion, streaming diff previews with highlight-and-edit functionality for easy acceptance or modification, integrated AI chat interface maintaining developer workflow with follow-up questions and iterative improvements, and robust context integration with customizable options for analyzing current files, related files, and project structure. The open-source nature allows developers and organizations that value customization, transparency, and control over their development tools to fine-tune context gathering and processing, making Continue perfect for self-hosting enthusiasts, developers who like tinkering with their AI stack, and teams requiring privacy-first solutions. As a frequently mentioned commercial alternative to GitHub Copilot and Codeium in 2025 comparisons with strong community support and continuous evolution, Continue delivers 100% free functionality while providing extensions for both VS Code and JetBrains for comprehensive IDE coverage.",
  overview: "Continue revolutionizes AI-assisted development by providing an open-source, model-agnostic platform that frees developers from vendor lock-in while delivering comprehensive autocomplete, chat, and context awareness capabilities customizable to any workflow or preference. Unlike proprietary AI coding tools that force developers into single-provider ecosystems, Continue's flexibility allows seamless switching between cloud-based models like Gemini, Mistral, ChatGPT, and Claude Sonnet using API keys, or running models locally with Ollama (LLaMA, Quen, etc.) for complete control where everything runs on your machine with no dependency on any cloud provider. The platform's intelligent code completion system delivers inline suggestions and tab completion with customizable completion experience, streaming diff previews that show code changes in real-time, and highlight-and-edit functionality making it easy to accept modifications or refine suggestions before application. Continue's chat integration maintains developer flow by providing an integrated AI interface within the IDE that supports follow-up questions and iterative improvements, allowing developers to refine queries without switching contexts while receiving real-time responses customized to work with different AI models based on project needs or personal preference. The robust context awareness analyzes current file, related files, and project structure to provide relevant suggestions, with open-source architecture allowing developers to fine-tune how context is gathered and processed for optimal results tailored to specific codebases and development patterns. Continue's appeal lies in its combination of zero cost (completely free and self-hostable), full customization (open-source nature enables modifications at every level), transparency (no black-box algorithms or hidden data collection), and control (developers own their AI stack and choose their models), making it particularly attractive for developers who value tinkering, self-hosting, or having complete control while organizations appreciate privacy-first approaches where code never leaves their infrastructure if using local models. As a top choice among open-source alternatives in 2025 with extensions for both VS Code and JetBrains providing comprehensive IDE coverage and strong community support driving continuous evolution, Continue represents the definitive open-source alternative to GitHub Copilot for developers and teams seeking flexibility, privacy, and control without sacrificing AI-assisted development capabilities.",
  website: "https://continue.dev/",
  website_url: "https://continue.dev/",
  launch_year: 2023,
  updated_2025: true,
  category: "open-source-framework",
  pricing_model: "free",

  features: [
    "Model-agnostic: Support for any AI model provider",
    "Cloud models: Gemini, Mistral, ChatGPT, Claude Sonnet",
    "Local models: LLaMA, Quen via Ollama",
    "100% self-hostable with full control",
    "Intelligent code completion with inline suggestions",
    "Tab completion support",
    "Streaming diff previews",
    "Highlight-and-edit functionality",
    "Integrated AI chat interface within IDE",
    "Follow-up questions and iterative improvements",
    "Robust context integration (current file, related files, project)",
    "Customizable context gathering and processing",
    "VS Code extension",
    "JetBrains extension (IntelliJ, PyCharm, WebStorm, etc.)",
    "Open-source for full transparency and customization",
    "Privacy-first with local model option",
    "No vendor lock-in or proprietary restrictions"
  ],

  use_cases: [
    "AI-assisted code completion without vendor lock-in",
    "Local AI coding with complete privacy (Ollama)",
    "Customizable autocomplete and chat workflows",
    "Self-hosted AI coding for enterprises",
    "Multi-model experimentation and optimization",
    "Privacy-first development with local inference",
    "Cost-effective AI coding with free models",
    "IDE-agnostic AI assistance (VS Code + JetBrains)",
    "Open-source customization for specific needs",
    "Team collaboration with shared AI configurations"
  ],

  integrations: [
    "VS Code (native extension)",
    "JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, etc.)",
    "Gemini (cloud model)",
    "Mistral (cloud model)",
    "ChatGPT (cloud model)",
    "Claude Sonnet (cloud model)",
    "Ollama (local model platform)",
    "LLaMA (local model)",
    "Quen (local model)",
    "Code Llama (local model)",
    "Custom API endpoints",
    "Self-hosted model servers"
  ],

  pricing: {
    model: "Free open-source with optional AI model costs",
    free_tier: true,
    tiers: [
      {
        name: "Free (Open Source)",
        price: "$0",
        billing: "Forever",
        target: "All developers and organizations",
        recommended: true,
        features: [
          "Complete Continue functionality",
          "VS Code and JetBrains extensions",
          "Model-agnostic AI support",
          "Cloud and local model options",
          "Code completion and chat",
          "Context awareness",
          "Customizable workflows",
          "Self-hosting capability",
          "100% open-source",
          "Community support"
        ]
      }
    ],
    ai_costs: {
      cloud_models: "Pay AI providers directly (Gemini, Mistral, ChatGPT, Claude)",
      local_models: "100% free with Ollama (LLaMA, Quen, Code Llama)",
      flexibility: "Mix and match cloud and local models",
      cost_control: "Complete transparency and control over AI spending"
    }
  },

  differentiators: [
    "Leading open-source AI code assistant",
    "100% free with no subscription fees",
    "Model-agnostic (not tied to single provider)",
    "Local model support via Ollama (100% private)",
    "VS Code and JetBrains extensions",
    "Self-hostable for complete control",
    "Customizable autocomplete and chat",
    "Fine-tunable context awareness",
    "Privacy-first architecture",
    "No vendor lock-in",
    "Strong community support and evolution",
    "Frequently mentioned alongside GitHub Copilot and Codeium",
    "Open-source transparency (no black-box algorithms)"
  ],

  target_audience: "Developers seeking GitHub Copilot alternatives; privacy-conscious engineers requiring local AI; organizations wanting self-hosted solutions; cost-conscious developers using free models; open-source enthusiasts valuing transparency; teams needing model flexibility; developers who enjoy customization and tinkering; and JetBrains users seeking AI assistance",

  recent_updates_2025: [
    "Expanded local model support with Ollama integration",
    "Enhanced VS Code extension capabilities",
    "Improved JetBrains IDE support",
    "Added streaming diff previews",
    "Enhanced context awareness customization",
    "Improved chat interface with iterative refinement",
    "Expanded cloud model provider support",
    "Strengthened community contributions",
    "Enhanced self-hosting documentation",
    "Improved highlight-and-edit functionality"
  ],

  compliance: [
    "Open-source transparency (public GitHub repository)",
    "100% local option for complete privacy",
    "No data collection or telemetry (user controlled)",
    "Self-hostable for enterprise compliance",
    "GDPR compliant when using local models"
  ],

  parent_company: "Open Source Community"
};

async function updateContinue() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Continue with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: continueData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'continue-dev'));

    console.log('✅ Continue updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Continue (Open Source)');
    console.log('   - Category: open-source-framework');
    console.log('   - Features: 17 comprehensive features');
    console.log('   - Pricing: Free open-source');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 12 platforms and AI models');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating Continue:', error);
    throw error;
  }
}

updateContinue();
