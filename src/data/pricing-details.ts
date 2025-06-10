export interface PricingPlan {
  name: string;
  price: string;
  billingCycle?: string;
  features: string[];
  limits?: string[];
}

export interface ToolPricingDetails {
  id: string;
  company: {
    name: string;
    url?: string;
    parentCompany?: string;
    headquarters?: string;
  };
  pricing: {
    model: "free" | "freemium" | "paid" | "enterprise" | "open-source";
    currency: string;
    plans: PricingPlan[];
    notes?: string;
  };
  users?: {
    count: number;
    asOf: string;
    source?: string;
  };
}

export const toolPricingDetails: Record<string, ToolPricingDetails> = {
  cursor: {
    id: "cursor",
    company: {
      name: "Anysphere Inc",
      url: "https://anysphere.inc",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "freemium",
      currency: "USD",
      plans: [
        {
          name: "Hobby",
          price: "Free",
          features: ["2000 AI completions/month", "Basic AI features", "VS Code compatible"],
          limits: ["Limited to 2000 completions"],
        },
        {
          name: "Pro",
          price: "$20",
          billingCycle: "per month",
          features: [
            "Unlimited AI completions",
            "Advanced AI features",
            "GPT-4 access",
            "Priority support",
          ],
        },
        {
          name: "Business",
          price: "$40",
          billingCycle: "per user/month",
          features: [
            "Everything in Pro",
            "Team management",
            "Centralized billing",
            "Admin controls",
          ],
        },
      ],
    },
    users: {
      count: 500000,
      asOf: "2025-01",
      source: "Company announcement",
    },
  },
  "github-copilot": {
    id: "github-copilot",
    company: {
      name: "GitHub Inc",
      url: "https://github.com",
      parentCompany: "Microsoft Corporation",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "paid",
      currency: "USD",
      plans: [
        {
          name: "Individual",
          price: "$10",
          billingCycle: "per month",
          features: [
            "AI code suggestions",
            "Works in VS Code, JetBrains, Neovim, etc.",
            "Blocks suggestions matching public code",
          ],
        },
        {
          name: "Business",
          price: "$19",
          billingCycle: "per user/month",
          features: [
            "Everything in Individual",
            "Organization-wide policy management",
            "Exclude specified files",
            "HTTP proxy support via certificate",
          ],
        },
        {
          name: "Enterprise",
          price: "$39",
          billingCycle: "per user/month",
          features: [
            "Everything in Business",
            "GitHub Copilot Chat in IDE",
            "CLI assistance",
            "Security vulnerability filter",
            "IP indemnity",
          ],
        },
      ],
      notes:
        "Free for verified students, teachers, and maintainers of popular open source projects",
    },
    users: {
      count: 1800000,
      asOf: "2024-10",
      source: "GitHub Universe 2024",
    },
  },
  windsurf: {
    id: "windsurf",
    company: {
      name: "Codeium Inc",
      url: "https://codeium.com",
      headquarters: "Mountain View, CA",
    },
    pricing: {
      model: "freemium",
      currency: "USD",
      plans: [
        {
          name: "Free",
          price: "Free",
          features: ["Unlimited AI autocompletions", "AI chat assistant", "Basic IDE support"],
        },
        {
          name: "Pro",
          price: "$12",
          billingCycle: "per month",
          features: [
            "Everything in Free",
            "Advanced AI models",
            "Unlimited usage",
            "Priority model routing",
          ],
        },
        {
          name: "Teams",
          price: "$20",
          billingCycle: "per seat/month",
          features: [
            "Everything in Pro",
            "Admin dashboard",
            "Usage analytics",
            "Org-wide policies",
          ],
        },
      ],
    },
    users: {
      count: 700000,
      asOf: "2024-12",
      source: "Company blog",
    },
  },
  "claude-artifacts": {
    id: "claude-artifacts",
    company: {
      name: "Anthropic",
      url: "https://anthropic.com",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "freemium",
      currency: "USD",
      plans: [
        {
          name: "Free",
          price: "Free",
          features: [
            "Limited Claude 3.5 Sonnet access",
            "Basic artifact creation",
            "Limited messages per day",
          ],
        },
        {
          name: "Pro",
          price: "$20",
          billingCycle: "per month",
          features: [
            "5x more usage vs Free",
            "Access to Claude 3 Opus",
            "Create Projects with artifacts",
            "Priority access during high traffic",
          ],
        },
        {
          name: "Team",
          price: "$30",
          billingCycle: "per user/month",
          features: [
            "Everything in Pro",
            "Central billing",
            "Early access to new features",
            "Team collaboration",
          ],
        },
      ],
    },
    users: {
      count: 2000000,
      asOf: "2024-11",
      source: "Estimated",
    },
  },
  v0: {
    id: "v0",
    company: {
      name: "Vercel Inc",
      url: "https://vercel.com",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "freemium",
      currency: "USD",
      plans: [
        {
          name: "Free",
          price: "Free",
          features: ["10 generations per month", "Basic UI components", "Public sharing"],
          limits: ["10 generations/month"],
        },
        {
          name: "Premium",
          price: "$20",
          billingCycle: "per month",
          features: [
            "500 generations per month",
            "Private projects",
            "Custom domains",
            "Advanced components",
          ],
        },
      ],
    },
    users: {
      count: 150000,
      asOf: "2024-11",
      source: "Estimated",
    },
  },
  "bolt-new": {
    id: "bolt-new",
    company: {
      name: "StackBlitz Inc",
      url: "https://stackblitz.com",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "freemium",
      currency: "USD",
      plans: [
        {
          name: "Free",
          price: "Free",
          features: ["Limited AI prompts", "Public projects only", "Basic deployment"],
        },
        {
          name: "Pro",
          price: "$20",
          billingCycle: "per month",
          features: [
            "Unlimited AI prompts",
            "Private projects",
            "Advanced deployment options",
            "Priority support",
          ],
        },
      ],
    },
    users: {
      count: 300000,
      asOf: "2024-12",
      source: "Estimated",
    },
  },
  devin: {
    id: "devin",
    company: {
      name: "Cognition AI",
      url: "https://cognition-labs.com",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "paid",
      currency: "USD",
      plans: [
        {
          name: "Standard",
          price: "$500",
          billingCycle: "per month",
          features: [
            "AI software engineer",
            "Autonomous coding",
            "Full repository access",
            "Slack integration",
          ],
        },
      ],
      notes: "Currently in limited access with waitlist",
    },
    users: {
      count: 5000,
      asOf: "2024-12",
      source: "Estimated (limited access)",
    },
  },
  cline: {
    id: "cline",
    company: {
      name: "Open Source Community",
      url: "https://github.com/cline/cline",
    },
    pricing: {
      model: "open-source",
      currency: "USD",
      plans: [
        {
          name: "Open Source",
          price: "Free",
          features: [
            "Full autonomous coding features",
            "VSCode extension",
            "Use with any LLM API",
            "Community support",
            "Requires your own LLM API keys",
          ],
        },
      ],
    },
    users: {
      count: 50000,
      asOf: "2024-12",
      source: "VSCode marketplace installs",
    },
  },
  aider: {
    id: "aider",
    company: {
      name: "Paul Gauthier (Individual)",
      url: "https://aider.chat",
    },
    pricing: {
      model: "open-source",
      currency: "USD",
      plans: [
        {
          name: "Open Source",
          price: "Free",
          features: [
            "Terminal-based AI pair programming",
            "Git integration",
            "Multi-file editing",
            "Works with multiple LLMs",
          ],
        },
      ],
      notes: "Requires your own LLM API keys",
    },
    users: {
      count: 40000,
      asOf: "2024-11",
      source: "GitHub stars estimate",
    },
  },
  zed: {
    id: "zed",
    company: {
      name: "Zed Industries",
      url: "https://zed.dev",
      headquarters: "Boulder, CO",
    },
    pricing: {
      model: "open-source",
      currency: "USD",
      plans: [
        {
          name: "Open Source",
          price: "Free",
          features: [
            "High-performance code editor",
            "AI assistant integration",
            "Real-time collaboration",
            "GPU-accelerated rendering",
          ],
        },
      ],
      notes: "Zed Cloud features may have pricing in the future",
    },
    users: {
      count: 100000,
      asOf: "2024-11",
      source: "Estimated",
    },
  },
  lovable: {
    id: "lovable",
    company: {
      name: "Lovable Inc",
      url: "https://lovable.dev",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "freemium",
      currency: "USD",
      plans: [
        {
          name: "Free",
          price: "Free",
          features: ["Limited app generations", "Basic templates", "Community support"],
        },
        {
          name: "Pro",
          price: "$29",
          billingCycle: "per month",
          features: [
            "Unlimited generations",
            "Custom domains",
            "Priority support",
            "Advanced integrations",
          ],
        },
      ],
    },
    users: {
      count: 25000,
      asOf: "2024-11",
      source: "Estimated",
    },
  },
  jules: {
    id: "jules",
    company: {
      name: "Sourcegraph Inc",
      url: "https://sourcegraph.com",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "enterprise",
      currency: "USD",
      plans: [
        {
          name: "Enterprise",
          price: "Custom",
          features: [
            "Autonomous PR creation",
            "Code review automation",
            "Integration with Sourcegraph",
            "Enterprise support",
          ],
        },
      ],
      notes: "Part of Sourcegraph Enterprise",
    },
    users: {
      count: 10000,
      asOf: "2024-11",
      source: "Estimated enterprise users",
    },
  },
  "chatgpt-canvas": {
    id: "chatgpt-canvas",
    company: {
      name: "OpenAI",
      url: "https://openai.com",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "paid",
      currency: "USD",
      plans: [
        {
          name: "ChatGPT Plus",
          price: "$20",
          billingCycle: "per month",
          features: [
            "Canvas for writing and coding",
            "GPT-4 access",
            "DALL-E image generation",
            "Advanced data analysis",
          ],
        },
        {
          name: "ChatGPT Team",
          price: "$30",
          billingCycle: "per user/month",
          features: [
            "Everything in Plus",
            "Higher message caps",
            "Admin console",
            "Team workspace",
          ],
        },
      ],
    },
    users: {
      count: 200000000,
      asOf: "2024-11",
      source: "OpenAI announcement (ChatGPT total)",
    },
  },
  openhands: {
    id: "openhands",
    company: {
      name: "All Hands AI",
      url: "https://all-hands.dev",
      headquarters: "Remote",
    },
    pricing: {
      model: "open-source",
      currency: "USD",
      plans: [
        {
          name: "Open Source",
          price: "Free",
          features: [
            "Autonomous AI developer",
            "Docker-based execution",
            "Multi-agent support",
            "Self-hosted",
          ],
        },
      ],
      notes: "Enterprise support available",
    },
    users: {
      count: 30000,
      asOf: "2024-11",
      source: "GitHub stars estimate",
    },
  },
  "diffblue-cover": {
    id: "diffblue-cover",
    company: {
      name: "Diffblue Ltd",
      url: "https://diffblue.com",
      headquarters: "Oxford, UK",
    },
    pricing: {
      model: "enterprise",
      currency: "USD",
      plans: [
        {
          name: "Enterprise",
          price: "Custom",
          features: [
            "Automated Java unit tests",
            "IntelliJ plugin",
            "CI/CD integration",
            "Enterprise support",
          ],
        },
      ],
      notes: "Pricing based on codebase size",
    },
    users: {
      count: 1000,
      asOf: "2024-11",
      source: "Enterprise customers estimate",
    },
  },
  "claude-code": {
    id: "claude-code",
    company: {
      name: "Anthropic",
      url: "https://anthropic.com",
      headquarters: "San Francisco, CA",
    },
    pricing: {
      model: "freemium",
      currency: "USD",
      plans: [
        {
          name: "Free",
          price: "Free",
          features: ["Claude Code in browser", "Limited daily usage", "Basic features"],
        },
        {
          name: "Pro",
          price: "$20",
          billingCycle: "per month",
          features: ["5x more usage", "Priority access", "Advanced features", "Project support"],
        },
      ],
      notes: "Part of Claude.ai subscription",
    },
    users: {
      count: 400000,
      asOf: "2025-01",
      source: "Estimated active Claude Code users",
    },
  },
};
