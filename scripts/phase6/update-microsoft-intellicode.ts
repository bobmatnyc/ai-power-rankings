import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 6: Microsoft IntelliCode - Pioneering Free AI Code Completion
 * Complete content creation from 20% to 100%
 */

const intelliCodeData = {
  id: "microsoft-intellicode",
  name: "Microsoft IntelliCode",
  company: "Microsoft Corporation",
  tagline: "Pioneering 100% free AI code completion default in Visual Studio 2022 serving 10M+ users, trained on 2,000+ GitHub repos and 500K open source projects, compatible with GitHub Copilot",
  description: "Microsoft IntelliCode is the pioneering AI-assisted development tool that brought intelligent code completion to mainstream development when launched in 2017, now included by default in Visual Studio 2022 serving 10+ million developers worldwide with 100% free access establishing the foundation for modern AI coding assistants like GitHub Copilot which evolved from IntelliCode's innovative approach. The platform delivers context-aware code autocompletions leveraging machine learning models trained on over 2,000 highly-rated GitHub repositories (100+ stars each) and approximately 500,000 open source projects ensuring recommendations reflect industry best practices and common patterns, with whole-line completions in Visual Studio 2022 for C# developers predicting the next chunk of code based on current context using large-scale transformer models trained on around 500,000 public repos from GitHub. IntelliCode enhances developer productivity through intelligent IntelliSense that surfaces most relevant API suggestions at the top of completion lists starred for visibility, whole-line autocompletions appearing as inline gray text predictions developers accept with Tab, AI-assisted IntelliSense for team's private codebases through custom models analyzing organizational coding patterns, context-aware recommendations based on thousands of open source projects, runs completely on local machine ensuring code privacy without cloud transmission, and seamlessly integrates with GitHub Copilot enabling developers to use both tools together without choosing between them. Available for Visual Studio 2022 supporting C#, C++, Java, SQL, XAML languages with Visual Studio Code extension supporting Python, TypeScript/JavaScript, Java through separate installation, IntelliCode represents Microsoft's foundational contribution to AI-powered development tools pioneering interfaces now industry standard including inline-diff view, copy-paste-update automation, and agentic coding through Copilot Edits built upon IntelliCode's innovation. Completely free for all Visual Studio users included by default in most workloads through Visual Studio installer with no subscription fees, privacy-preserving local execution, compatibility with GitHub Copilot for complementary AI assistance, and deep integration into Visual Studio 2022 and VS Code ecosystems serving millions of developers daily, Microsoft IntelliCode delivers the definitive free AI code completion experience combining pioneering innovation from 2017 with modern transformer-based whole-line predictions, team-specific custom model training, and seamless coexistence with advanced tools like GitHub Copilot establishing IntelliCode as essential foundation for AI-assisted development workflows.",
  overview: "Microsoft IntelliCode revolutionized software development by pioneering AI-powered code completion in 2017, establishing patterns and interfaces that became industry standard including inline-diff view, copy-paste-update automation, and foundational approaches later evolved into GitHub Copilot and agentic coding through Copilot Edits. Unlike modern AI assistants requiring paid subscriptions, IntelliCode provides 100% free AI code completion included by default in Visual Studio 2022 serving 10+ million developers, trained on over 2,000 highly-rated GitHub repositories (100+ stars minimum) and approximately 500,000 public open source projects ensuring recommendations reflect proven best practices and common patterns observed across massive real-world codebases. The platform delivers intelligent IntelliSense that analyzes developer's current code context and patterns from thousands of open source projects to surface most relevant API suggestions at the top of completion lists marked with distinctive stars, while whole-line autocompletions in Visual Studio 2022 for C# developers predict complete lines of code based on current context appearing as inline gray text predictions accepted via Tab key, powered by large-scale transformer models trained on around 500,000 public GitHub repositories. IntelliCode's AI-assisted IntelliSense for team codebases enables organizations to train custom models on their private code, analyzing organizational patterns to provide tailored recommendations reflecting team-specific best practices and coding standards without transmitting code to cloud services since IntelliCode runs entirely on local machines preserving code privacy. The platform pioneered user interfaces now considered industry standard: inline-diff view showing AI suggestions contextually within code, copy-paste-update automation reducing boilerplate coding, and fundamental patterns later evolved into agentic coding capabilities through GitHub Copilot Edits, with Aaron (Product Manager on Visual Studio IDE team) leading IntelliCode development and pioneering these transformative interfaces. IntelliCode seamlessly coexists with GitHub Copilot allowing developers to use both tools together without choosing, where IntelliCode provides quick context-aware completions while Copilot offers more extensive code generation, creating complementary AI assistance that enhances productivity across different coding scenarios from rapid API completion to complex function generation. Supported in Visual Studio 2022 for C#, C++, Java, SQL, XAML languages included by default in most workloads through Visual Studio installer, plus Visual Studio Code extension supporting Python, TypeScript/JavaScript, Java through marketplace installation, IntelliCode serves diverse development ecosystems with proven reliability and extensive language coverage. Since Visual Studio 2022 release (version 17.0+), IntelliCode evolved to include deep learning neural encoder models that rank candidates provided by static analyzer, delivering completions even for unseen libraries like private user code not present in training sets, significantly improving relevance and accuracy through advanced AI techniques. Microsoft's commitment to free AI coding assistance through IntelliCode established accessibility precedent enabling millions of developers to experience AI-powered productivity improvements without financial barriers, while pioneering innovation continues through GitHub Copilot evolution building upon IntelliCode's foundational work. Available 100% free for all Visual Studio and VS Code users, privacy-preserving with local execution, compatible with GitHub Copilot for complementary assistance, serving 10+ million developers across Visual Studio ecosystem, Microsoft IntelliCode represents the pioneering free AI code completion platform that established modern AI coding assistant interfaces, demonstrated feasibility of AI-powered development tools at massive scale, and continues delivering essential productivity enhancements to millions while seamlessly integrating with advanced tools like GitHub Copilot for comprehensive AI-assisted development workflows.",
  website: "https://visualstudio.microsoft.com/services/intellicode/",
  website_url: "https://visualstudio.microsoft.com/services/intellicode/",
  launch_year: 2017,
  updated_2025: true,
  category: "ide-assistant",
  pricing_model: "free",

  features: [
    "100% free AI code completion (no subscription required)",
    "Included by default in Visual Studio 2022",
    "Intelligent IntelliSense with starred API suggestions",
    "Whole-line autocompletions (Visual Studio 2022 C#)",
    "Large-scale transformer models (trained on 500K repos)",
    "Trained on 2,000+ highly-rated GitHub repos (100+ stars)",
    "AI-assisted IntelliSense for team's private codebases",
    "Custom model training on organizational code patterns",
    "Privacy-preserving local execution (no cloud transmission)",
    "Compatible with GitHub Copilot (use both together)",
    "Context-aware recommendations from open source patterns",
    "Deep learning neural encoder models (Visual Studio 2022)",
    "Completions for unseen libraries and private code",
    "Supports C#, C++, Java, SQL, XAML (Visual Studio 2022)",
    "Supports Python, TypeScript/JavaScript, Java (VS Code)",
    "Pioneered inline-diff view interface",
    "Copy-paste-update automation",
    "Foundation for GitHub Copilot and agentic coding"
  ],

  use_cases: [
    "Free AI code completion for budget-conscious developers",
    "Visual Studio 2022 default productivity enhancement (10M+ users)",
    "C# development with whole-line predictions",
    "Enterprise development with custom team models",
    "Privacy-sensitive projects requiring local execution",
    "Complementary AI assistance with GitHub Copilot",
    "Rapid API completion with intelligent IntelliSense",
    "Team-specific coding standard enforcement via custom models",
    "Open source development leveraging community patterns",
    "Educational coding with free AI assistance",
    "C++, Java, SQL, XAML development acceleration",
    "Python, TypeScript/JavaScript projects (VS Code extension)",
    "Organizations requiring code privacy (local execution)",
    "Developers exploring AI coding tools without subscription fees"
  ],

  integrations: [
    "Visual Studio 2022 (default installation)",
    "Visual Studio 2019",
    "Visual Studio 2017",
    "Visual Studio Code (extension)",
    "GitHub Copilot (complementary usage)",
    "Visual Studio Installer (most workloads)",
    "C# development tools",
    "C++ development tools",
    "Java development tools",
    "SQL Server Data Tools",
    "XAML designer",
    "Python extension (VS Code)",
    "TypeScript/JavaScript tools (VS Code)",
    "Team custom model training infrastructure",
    "Git and version control systems"
  ],

  pricing: {
    model: "100% Free for all users",
    free_tier: true,
    tiers: [
      {
        name: "Free (Visual Studio)",
        price: "$0",
        billing: "Forever",
        target: "All Visual Studio users",
        recommended: true,
        features: [
          "Included by default in Visual Studio 2022",
          "Available in Visual Studio 2019 and 2017",
          "Intelligent IntelliSense with starred suggestions",
          "Whole-line autocompletions (C# in VS 2022)",
          "Context-aware recommendations",
          "Privacy-preserving local execution",
          "Compatible with GitHub Copilot",
          "C#, C++, Java, SQL, XAML support",
          "AI-assisted IntelliSense for team codebases",
          "Custom model training on organizational code",
          "Deep learning neural encoder models (VS 2022+)",
          "No subscription fees ever",
          "Unlimited usage"
        ]
      },
      {
        name: "Free (VS Code)",
        price: "$0",
        billing: "Forever",
        target: "All VS Code users",
        features: [
          "Install from Visual Studio Code Marketplace",
          "Python support",
          "TypeScript/JavaScript support",
          "Java support",
          "Context-aware completions",
          "Privacy-preserving local execution",
          "Compatible with GitHub Copilot",
          "No subscription fees",
          "Unlimited usage"
        ]
      }
    ]
  },

  differentiators: [
    "100% free AI code completion (pioneering accessibility)",
    "Launched 2017 (pioneered AI coding assistants)",
    "10+ million users (Visual Studio 2022 default)",
    "Trained on 2,000+ highly-rated GitHub repos",
    "Trained on ~500K open source projects",
    "Whole-line predictions (transformer models, 500K repos)",
    "Privacy-preserving local execution",
    "Compatible with GitHub Copilot (use both together)",
    "Pioneered inline-diff view (now industry standard)",
    "Foundation for GitHub Copilot evolution",
    "Custom team models for private codebases",
    "Deep learning neural encoders (VS 2022+)",
    "No subscription fees or usage limits"
  ],

  target_audience: "Visual Studio 2022 users seeking default AI productivity (10M+ developers); budget-conscious developers requiring free AI coding tools; C# developers leveraging whole-line predictions; enterprises needing privacy-preserving local AI execution; teams training custom models on organizational codebases; developers using GitHub Copilot seeking complementary free AI assistance; educational institutions teaching with AI coding tools; open source projects adopting AI productivity without costs; and privacy-sensitive organizations requiring code to never leave local machines",

  recent_updates_2025: [
    "Continued default integration in Visual Studio 2022",
    "Deep learning neural encoder improvements",
    "Enhanced whole-line completion accuracy",
    "Improved custom team model training",
    "Expanded language support refinements",
    "GitHub Copilot compatibility enhancements",
    "Visual Studio 2022 performance optimizations",
    "VS Code extension stability improvements",
    "Context-aware recommendation enhancements",
    "Privacy and local execution reinforcement"
  ],

  compliance: [
    "100% local execution (no cloud data transmission)",
    "Code privacy preservation",
    "No data collection or telemetry",
    "GDPR compliance (Microsoft)",
    "Enterprise data sovereignty",
    "SOC 2 compliance (Microsoft)",
    "Custom model training stays within organization"
  ],

  parent_company: "Microsoft Corporation",
  headquarters: "Redmond, Washington, USA",

  historical_significance: {
    launch_year: 2017,
    pioneering_achievement: "First mainstream AI code completion tool",
    training_foundation: "2,000+ GitHub repos (100+ stars), ~500K open source projects",
    user_base: "10+ million developers (Visual Studio 2022 default)",
    industry_impact: [
      "Pioneered inline-diff view (now industry standard)",
      "Established copy-paste-update automation",
      "Foundation for GitHub Copilot development",
      "Enabled agentic coding through Copilot Edits",
      "Demonstrated feasibility of AI coding at scale"
    ]
  },

  technical_evolution: {
    "2017": "Initial launch with machine learning models",
    "2019": "Trained on 2,000+ GitHub repos",
    "2022": "Visual Studio 2022 with whole-line completions",
    "2022+": "Deep learning neural encoder models",
    "2025": "Seamless GitHub Copilot compatibility"
  },

  product_manager_leadership: {
    name: "Aaron (Visual Studio IDE team)",
    contributions: [
      "Pioneered inline-diff view interface",
      "Created copy-paste-update automation",
      "Led development of agentic coding (Copilot Edits)",
      "Established industry-standard AI coding interfaces"
    ]
  }
};

async function updateMicrosoftIntelliCode() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Microsoft IntelliCode with Phase 6 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: intelliCodeData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'microsoft-intellicode'));

    console.log('✅ Microsoft IntelliCode updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Microsoft Corporation');
    console.log('   - Category: ide-assistant');
    console.log('   - Features: 18 comprehensive features');
    console.log('   - Pricing: 100% FREE (no subscription ever)');
    console.log('   - Use Cases: 14 specialized scenarios');
    console.log('   - Integrations: 15 platforms and tools');
    console.log('   - User Base: 10+ million developers');
    console.log('   - Historical: Launched 2017 (pioneering AI coding)');
    console.log('   - Training: 2,000+ GitHub repos, 500K open source projects');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 continuous improvements');

  } catch (error) {
    console.error('❌ Error updating Microsoft IntelliCode:', error);
    throw error;
  }
}

updateMicrosoftIntelliCode();
