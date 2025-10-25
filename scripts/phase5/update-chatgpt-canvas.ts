import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: ChatGPT Canvas - Collaborative Coding Interface
 * Update comprehensive content for OpenAI's collaborative coding feature
 */

const chatgptCanvasData = {
  id: "chatgpt-canvas",
  name: "ChatGPT Canvas",
  company: "OpenAI",
  tagline: "Collaborative coding interface in ChatGPT for 100M+ users with real-time Python execution and multi-language porting",
  description: "ChatGPT Canvas is OpenAI's collaborative coding interface that opens in a separate window alongside chat, allowing developers to work side-by-side with ChatGPT on projects through a new paradigm of human-AI collaboration. Available to all ChatGPT users (100M+ globally) across Free, Plus ($20/month), and Team tiers on Web, Windows, and macOS with mobile coming soon, Canvas provides specialized coding shortcuts including inline code review with suggestions, automatic print statement insertion for debugging, intelligent comment generation, bug detection and fixing, and one-click code porting to JavaScript, TypeScript, Python, Java, C++, or PHP. Canvas features built-in Python code execution with real-time text and graphics output, error detection and automatic fixing, and Custom GPT integration allowing users to infuse their tailored AI assistants with Canvas capabilities for personalized workflows. The interface enables targeted editing by highlighting specific sections to focus ChatGPT's attention, provides inline feedback and suggestions with entire project context awareness, and offers comment bubble interactions where developers can review specific suggestions and apply changes automatically or manually edit flagged items.",
  overview: "ChatGPT Canvas revolutionizes AI-assisted coding by transforming the traditional conversational interface into a true collaborative workspace where developers and AI work side-by-side on the same project, enabling iterative refinement through visual editing rather than just text-based exchanges. Unlike standard chat interfaces where code appears in messages, Canvas opens as a dedicated window providing persistent access to the project while maintaining conversational context, allowing developers to highlight specific code sections to direct ChatGPT's focus and receive inline feedback and suggestions that consider the entire project architecture rather than isolated snippets. The platform's coding shortcuts deliver instant capabilities including Review code for inline suggestions with comment bubbles showing specific improvements that can be applied automatically or edited manually, Add logs for automatic print statement insertion to debug code execution, Add comments for intelligent documentation generation that explains complex logic, Fix bugs for automatic detection and rewriting of problematic code, and Port to language for one-click translation to JavaScript, TypeScript, Python, Java, C++, or PHP. Canvas's breakthrough 2025 feature is built-in Python code execution that runs directly within the interface, displaying real-time outputs including text results and graphics visualizations while automatically detecting errors and suggesting fixes, eliminating context switching between IDE, terminal, and AI assistant. The Custom GPT integration enables developers to create specialized coding assistants with Canvas capabilities, infusing domain-specific knowledge and coding standards into the collaborative interface for truly personalized development workflows. Available to all ChatGPT users regardless of payment tier (democratizing advanced AI coding tools to 100M+ users) on Web, Windows, and macOS with mobile support coming soon, Canvas represents OpenAI's vision for the future of human-AI collaboration where AI acts as an intelligent pair programmer with visual, contextual understanding of the entire project rather than just a code snippet generator.",
  website: "https://openai.com/index/introducing-canvas/",
  website_url: "https://openai.com/index/introducing-canvas/",
  launch_year: 2024,
  updated_2025: true,
  category: "autonomous-agent",
  pricing_model: "freemium",

  features: [
    "Separate collaborative window alongside ChatGPT chat",
    "Side-by-side human-AI project workspace",
    "Inline code review with contextual suggestions",
    "Comment bubble interactions for targeted feedback",
    "Add print statements for debugging automatically",
    "Intelligent comment generation explaining complex logic",
    "Bug detection and automatic code fixing",
    "One-click code porting (JavaScript, TypeScript, Python, Java, C++, PHP)",
    "Built-in Python code execution with real-time output",
    "Text and graphics visualization in Canvas",
    "Automatic error detection and fix suggestions",
    "Highlight sections to focus ChatGPT attention",
    "Entire project context awareness for suggestions",
    "Custom GPT integration for personalized workflows",
    "Available on Web, Windows, macOS (mobile coming soon)",
    "Accessible to all ChatGPT tiers (Free, Plus, Team)"
  ],

  use_cases: [
    "Collaborative code review with AI pair programmer",
    "Real-time Python script development and testing",
    "Multi-language code translation and porting",
    "Bug fixing with contextual understanding",
    "Code documentation and comment generation",
    "Debugging with automatic log statement insertion",
    "Interactive data visualization development",
    "Learning programming through AI-guided iteration",
    "Prototype development with immediate execution",
    "Custom GPT-powered domain-specific coding assistants"
  ],

  integrations: [
    "ChatGPT (integrated feature)",
    "Custom GPTs (personalized AI assistants)",
    "Python runtime (built-in execution)",
    "JavaScript language support",
    "TypeScript language support",
    "Java language support",
    "C++ language support",
    "PHP language support",
    "Web platform (browser-based)",
    "Windows desktop app",
    "macOS desktop app"
  ],

  pricing: {
    model: "Freemium with Plus and Team tiers",
    free_tier: true,
    included_with_chatgpt: true,
    tiers: [
      {
        name: "Free",
        price: "$0",
        billing: "Forever",
        target: "All ChatGPT users",
        features: [
          "ChatGPT Canvas access",
          "Collaborative coding interface",
          "Code review and suggestions",
          "Bug detection and fixing",
          "Code porting to 6 languages",
          "Comment and log generation",
          "Python code execution",
          "Web, Windows, macOS access"
        ]
      },
      {
        name: "Plus",
        price: "$20/month",
        billing: "Monthly",
        target: "Power users and professionals",
        recommended: true,
        features: [
          "Everything in Free",
          "GPT-4 and advanced models access",
          "Faster response times",
          "Priority access during high demand",
          "Custom GPT creation with Canvas",
          "Higher usage limits",
          "Early access to new features"
        ]
      },
      {
        name: "Team",
        price: "$25/user/month",
        billing: "Annual ($30/month monthly)",
        target: "Development teams and organizations",
        features: [
          "Everything in Plus",
          "Team workspace and collaboration",
          "Admin controls and analytics",
          "Shared Custom GPTs with Canvas",
          "Centralized billing",
          "Team usage insights",
          "Priority support"
        ]
      }
    ]
  },

  differentiators: [
    "100M+ ChatGPT users have access",
    "Available on Free tier (democratized access)",
    "Built-in Python code execution with real-time output",
    "Separate collaborative window (not just chat)",
    "Custom GPT integration for personalized assistants",
    "One-click porting to 6 programming languages",
    "Inline code review with comment bubbles",
    "Entire project context awareness",
    "Highlight sections for targeted AI focus",
    "Automatic error detection and fixing",
    "Graphics visualization support",
    "Web, Windows, macOS availability",
    "No additional cost beyond ChatGPT subscription"
  ],

  target_audience: "ChatGPT users learning to code; professional developers seeking AI pair programming; data scientists prototyping Python scripts; educators teaching programming concepts; teams collaborating on code reviews; full-stack developers porting between languages; students debugging assignments; and developers creating Custom GPTs with coding capabilities",

  recent_updates_2025: [
    "Official launch to all ChatGPT users (Free, Plus, Team)",
    "Built-in Python code execution with real-time output",
    "Custom GPT integration for personalized workflows",
    "Graphics and visualization support in Canvas",
    "Automatic error detection and fix suggestions",
    "Comment bubble interactions for targeted feedback",
    "Windows and macOS desktop app support",
    "Enhanced code porting to 6 languages",
    "Improved entire project context awareness",
    "Mobile support (iOS/Android) announced as coming soon"
  ],

  compliance: [
    "OpenAI data privacy policies",
    "Enterprise-grade security (Team tier)",
    "No code used for model training (opt-out available)",
    "SOC 2 Type II certified (Enterprise)"
  ],

  parent_company: "OpenAI"
};

async function updateChatGPTCanvas() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating ChatGPT Canvas with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: chatgptCanvasData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'chatgpt-canvas'));

    console.log('✅ ChatGPT Canvas updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: OpenAI');
    console.log('   - Category: autonomous-agent');
    console.log('   - Features: 16 comprehensive features');
    console.log('   - Pricing: 3 tiers (Free $0, Plus $20, Team $25)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 11 platforms and languages');
    console.log('   - Metrics: 100M+ ChatGPT users have access');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating ChatGPT Canvas:', error);
    throw error;
  }
}

updateChatGPTCanvas();
