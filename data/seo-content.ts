/**
 * SEO-optimized content structures for AI Power Rankings
 */

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

// General AI Tool Rankings FAQs
export const generalFAQs: FAQItem[] = [
  {
    id: "what-are-ai-tool-rankings",
    question: "What are AI tool rankings?",
    answer:
      "AI tool rankings are comprehensive evaluations of artificial intelligence software tools based on performance, features, user adoption, and technical capabilities. Our rankings help developers and businesses choose the best AI tools for their specific needs.",
    category: "general",
  },
  {
    id: "how-are-rankings-calculated",
    question: "How are AI tool rankings calculated?",
    answer:
      "Our rankings use Algorithm v7.1, which evaluates 8 key factors: <strong>Agentic Capability</strong>, <strong>Innovation</strong>, <strong>Technical Performance</strong>, <strong>Developer Adoption</strong>, <strong>Market Traction</strong>, <strong>Business Sentiment</strong>, <strong>Development Velocity</strong>, and <strong>Platform Resilience</strong>. Each factor is weighted based on its importance to developers and businesses.",
    category: "methodology",
  },
  {
    id: "how-often-updated",
    question: "How often are the rankings updated?",
    answer:
      "Rankings are updated <strong>weekly</strong> with fresh data from multiple sources including GitHub statistics, user metrics, funding announcements, and technical benchmarks. This ensures our rankings reflect the latest developments in the AI tool landscape.",
    category: "updates",
  },
  {
    id: "what-makes-tool-rank-higher",
    question: "What makes an AI tool rank higher?",
    answer:
      "Tools rank higher based on strong performance across technical capabilities, user adoption, innovation metrics, and business success. Key factors include active development, user growth, technical benchmarks, community engagement, and market validation.",
    category: "methodology",
  },
  {
    id: "are-rankings-biased",
    question: "Are the rankings biased or sponsored?",
    answer:
      "No, our rankings are completely independent and data-driven. We do not accept payment for rankings placement. All evaluations are based on publicly available data, technical benchmarks, and objective metrics to ensure fairness and accuracy.",
    category: "methodology",
  },
  {
    id: "can-i-suggest-tool",
    question: "Can I suggest a tool for ranking?",
    answer:
      "Yes! We welcome suggestions for new AI tools to evaluate. Contact us through our website with information about the tool, and our team will review it for inclusion in future rankings.",
    category: "general",
  },
];

// Code Assistant specific FAQs
export const codeAssistantFAQs: FAQItem[] = [
  {
    id: "what-is-ai-code-assistant",
    question: "What is an AI code assistant?",
    answer:
      "An AI code assistant is software that uses artificial intelligence to help developers write, review, and improve code. These tools can autocomplete code, suggest improvements, detect bugs, and even generate entire functions based on natural language descriptions.",
    category: "definition",
  },
  {
    id: "best-ai-coding-tools",
    question: "What are the best AI coding tools?",
    answer:
      "Based on our latest rankings, the top AI coding tools include <strong>Cursor</strong>, <strong>GitHub Copilot</strong>, <strong>Claude</strong>, and <strong>Replit</strong>. Each excels in different areas - Cursor for IDE integration, Copilot for code completion, Claude for reasoning, and Replit for collaborative development.",
    category: "recommendations",
  },
  {
    id: "are-ai-code-tools-safe",
    question: "Are AI code tools safe to use?",
    answer:
      "Most reputable AI code tools are safe when used properly. However, always review generated code before using it in production, be cautious about sharing sensitive code, and follow your organization's security policies. Leading tools implement strong privacy protections and security measures.",
    category: "safety",
  },
];

// Quick answers for different tool categories
export const quickAnswers = {
  codeAssistant: {
    question: "What is the best AI code assistant?",
    answer:
      "Based on our comprehensive analysis, <strong>Cursor</strong> currently leads our rankings for AI code assistants, offering excellent IDE integration, intelligent code completion, and strong developer experience. However, the best choice depends on your specific needs and workflow.",
  },
  imageGeneration: {
    question: "What is the best AI image generator?",
    answer:
      "Leading AI image generation tools include <strong>Midjourney</strong>, <strong>DALL-E</strong>, and <strong>Stable Diffusion</strong>. Each excels in different areas - Midjourney for artistic quality, DALL-E for accuracy, and Stable Diffusion for customization and local deployment.",
  },
  textGeneration: {
    question: "What is the best AI text generator?",
    answer:
      "Top AI text generation tools include <strong>GPT-4</strong>, <strong>Claude</strong>, and <strong>Gemini</strong>. These tools excel at various writing tasks including content creation, code documentation, and conversational AI applications.",
  },
};

// Tool comparison data structures
export const toolComparisonData = {
  topCodeAssistants: [
    {
      name: "Cursor",
      category: "code-assistant",
      pricing: "Free / $20/mo",
      keyFeatures: ["IDE Integration", "Code Completion", "Chat Interface", "Code Generation"],
      pros: ["Excellent VS Code integration", "Fast and accurate", "Great UX"],
      cons: ["Limited to VS Code", "Newer tool"],
      rating: 94,
      users: 500000,
      website: "https://cursor.sh",
    },
    {
      name: "GitHub Copilot",
      category: "code-assistant",
      pricing: "Free / $10/mo",
      keyFeatures: ["Code Completion", "Multi-language", "IDE Support", "Enterprise Features"],
      pros: ["Wide IDE support", "Mature product", "Strong GitHub integration"],
      cons: ["Can be slow", "Sometimes inaccurate"],
      rating: 89,
      users: 1000000,
      website: "https://github.com/features/copilot",
    },
    {
      name: "Claude",
      category: "text-generation",
      pricing: "Free / $20/mo",
      keyFeatures: ["Reasoning", "Code Analysis", "Long Context", "Safety"],
      pros: ["Excellent reasoning", "Safe and helpful", "Long context window"],
      cons: ["Not IDE-integrated", "Rate limits"],
      rating: 87,
      users: 800000,
      website: "https://claude.ai",
    },
  ],
};

// Content templates for different page types
export const contentTemplates = {
  toolReview: {
    structure: [
      "Quick Answer Box - What is [Tool Name]?",
      "Tool Overview Cards",
      "Key Features Section",
      "Pros and Cons",
      "Pricing Information",
      "Comparison Table",
      "FAQ Section",
      "Call to Action",
    ],
  },
  categoryGuide: {
    structure: [
      "Quick Answer Box - What is [Category]?",
      "Top Tools in Category",
      "Comparison Table",
      "How to Choose Guide",
      "FAQ Section",
      "Related Categories",
    ],
  },
  rankingsPage: {
    structure: [
      "Rankings Overview",
      "Methodology Explanation",
      "Top Tools Highlight",
      "Category Breakdown",
      "FAQ Section",
      "Historical Trends",
    ],
  },
};
