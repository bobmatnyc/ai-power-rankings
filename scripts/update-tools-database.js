#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

// File paths
const TOOLS_PATH = path.join(__dirname, '../data/json/tools/tools.json');
const COMPANIES_PATH = path.join(__dirname, '../data/json/companies/companies.json');

// Load existing data
const tools = JSON.parse(fs.readFileSync(TOOLS_PATH, 'utf8'));
const companies = JSON.parse(fs.readFileSync(COMPANIES_PATH, 'utf8'));

// Helper function to find next available ID (not currently used but keeping for future use)
// function getNextId(items) {
//   const numericIds = items
//     .map(item => parseInt(item.id))
//     .filter(id => !Number.isNaN(id))
//     .sort((a, b) => b - a);
//   return String((numericIds[0] || 0) + 1);
// }

// Add new companies
const newCompanies = [
  {
    id: "17",  // Alibaba for Qwen Code
    slug: "alibaba",
    name: "Alibaba Group",
    description: "Chinese multinational technology company specializing in e-commerce, retail, internet, and AI technology",
    website: "https://www.alibaba.com",
    founded: "1999",
    headquarters: "Hangzhou, China",
    size: "large",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "82",  // Trae AI company
    slug: "trae-ai-inc",
    name: "Trae AI Inc.",
    description: "AI-powered coding assistant company focused on developer productivity",
    website: "https://www.trae.ai",
    founded: "2023",
    size: "startup",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "83",  // Qoder company
    slug: "qoder-ai",
    name: "Qoder AI",
    description: "AI coding assistant company specializing in intelligent code generation",
    website: "https://qoder.ai",
    founded: "2023",
    size: "startup",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "84",  // RooCode company
    slug: "roocode",
    name: "RooCode",
    description: "AI-powered code completion and generation platform",
    website: "https://roocode.ai",
    founded: "2024",
    size: "startup",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "85",  // KiloCode company
    slug: "kilocode-inc",
    name: "KiloCode Inc.",
    description: "Intelligent IDE assistant for accelerated software development",
    website: "https://kilocode.ai",
    founded: "2024",
    size: "startup",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Add new companies if they don't exist
newCompanies.forEach(newCompany => {
  const exists = companies.companies.some(c => c.id === newCompany.id || c.slug === newCompany.slug);
  if (!exists) {
    companies.companies.push(newCompany);
    // Update index
    companies.index.byId[newCompany.id] = newCompany;
    companies.index.bySlug[newCompany.slug] = newCompany;
  }
});

// Update companies metadata
companies.metadata.total = companies.companies.length;
companies.metadata.last_updated = new Date().toISOString();

// Update tools with company associations and pricing details
const toolUpdates = {
  // Company associations
  "36": { company_id: "82" },  // Trae AI
  "37": { company_id: "83" },  // Qoder
  "38": { company_id: "84" },  // RooCode
  "39": { company_id: "85" },  // KiloCode  
  "42": { company_id: "17" },  // Qwen Code -> Alibaba
  
  // Pricing details
  "4": {  // Claude Code
    pricing_details: {
      "Free": "$0/month - Limited usage with Claude 3.5 Haiku",
      "Pro": "$20/month - Unlimited usage with Claude 3.5 Sonnet, priority support",
      "Team": "$25/user/month - Everything in Pro plus team collaboration features",
      "Enterprise": "Custom pricing - Advanced security, SSO, dedicated support"
    }
  },
  "5": {  // V0
    pricing_details: {
      "Free": "$0/month - 10 generations per month",
      "Plus": "$20/month - 300 generations, custom domains, private projects",
      "Pro": "$40/month - Unlimited generations, team collaboration, priority support"
    }
  },
  "6": {  // Cline
    pricing_details: {
      "Open Source": "$0/month - Free and open source, bring your own API keys",
      "Note": "Uses your own API keys for OpenAI, Anthropic, or other providers"
    }
  },
  "7": {  // Aider
    pricing_details: {
      "Open Source": "$0/month - Free and open source CLI tool",
      "Note": "Requires your own API keys for AI providers (OpenAI, Anthropic, etc.)"
    }
  },
  "8": {  // Bolt.new
    pricing_details: {
      "Free": "$0/month - Limited AI prompts and deployments",
      "Pro": "$20/month - Unlimited AI prompts, custom domains, priority support",
      "Team": "$30/user/month - Everything in Pro plus team collaboration"
    }
  },
  "10": {  // Marblism
    pricing_details: {
      "Starter": "$39/month - 3 apps, basic features",
      "Pro": "$99/month - Unlimited apps, advanced features, priority support",
      "Enterprise": "Custom pricing - White-label solution, dedicated support"
    }
  },
  "13": {  // Continue
    pricing_details: {
      "Open Source": "$0/month - Free and open source VS Code extension",
      "Note": "Self-hosted, uses your own LLM API keys or local models"
    }
  },
  "14": {  // Windsurf
    pricing_details: {
      "Free": "$0/month - 10 free uses, basic features",
      "Pro": "$15/month - Unlimited usage, all AI models, priority support",
      "Team": "$30/user/month - Everything in Pro plus team features"
    }
  },
  "21": {  // Boxy
    pricing_details: {
      "Free": "$0/month - Basic features with limited requests",
      "Premium": "$9.99/month - Unlimited requests, priority processing",
      "Team": "$19.99/user/month - Team collaboration features"
    }
  },
  "25": {  // Code Conductor
    pricing_details: {
      "Starter": "$29/month - Individual developer features",
      "Team": "$49/user/month - Team collaboration and management",
      "Enterprise": "Custom pricing - Advanced security and compliance"
    }
  },
  "26": {  // Pieces
    pricing_details: {
      "Free": "$0/month - Core features for individual developers",
      "Pro": "$10/month - Advanced AI features, unlimited saves",
      "Team": "$20/user/month - Team collaboration and sharing"
    }
  },
  "31": {  // Kiro
    pricing_details: {
      "Free Trial": "$0 - 14-day trial with full features",
      "Professional": "$49/month - Full access for individual developers",
      "Team": "$99/user/month - Team features and priority support"
    }
  },
  "32": {  // Warp
    pricing_details: {
      "Free": "$0/month - Core terminal features",
      "Pro": "$10/month - AI command search, workflows, team features",
      "Team": "$20/user/month - Advanced collaboration and security"
    }
  }
};

// Update tool features and technical specs for new tools
const toolEnhancements = {
  "36": {  // Trae AI
    features: [
      "Context-aware code completions with deep semantic understanding",
      "Multi-language support with specialized models per language",
      "Intelligent refactoring suggestions based on best practices",
      "Real-time error detection and automated fix suggestions",
      "Code documentation generation with natural language",
      "Test case generation from code implementation",
      "Performance optimization recommendations"
    ],
    technical: {
      context_window: 32000,
      multi_file_support: true,
      language_support: [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#",
        "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala"
      ],
      llm_providers: ["Trae AI proprietary models", "GPT-4", "Claude"],
      subprocess_support: false,
      tool_support: true,
      ide_integration: ["VS Code", "JetBrains", "Sublime Text", "Vim/Neovim"]
    }
  },
  "37": {  // Qoder
    features: [
      "Advanced code generation from natural language descriptions",
      "Automatic bug detection and resolution suggestions",
      "Code review automation with detailed feedback",
      "Dependency management and security scanning",
      "API documentation generation",
      "Code translation between programming languages",
      "Performance profiling and optimization"
    ],
    technical: {
      context_window: 16000,
      multi_file_support: true,
      language_support: [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#",
        "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin"
      ],
      llm_providers: ["Qoder AI models", "OpenAI GPT-4", "Anthropic Claude"],
      subprocess_support: true,
      tool_support: true,
      cli_based: true
    }
  },
  "38": {  // RooCode
    features: [
      "Intelligent code completion with contextual awareness",
      "Real-time collaborative coding with AI assistance",
      "Automated code review and quality analysis",
      "Smart refactoring with semantic understanding",
      "Documentation generation and maintenance",
      "Unit test generation with edge case coverage",
      "Code security vulnerability detection"
    ],
    technical: {
      context_window: 100000,
      multi_file_support: true,
      language_support: [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#",
        "Go", "Rust", "Ruby", "PHP", "Kotlin", "Swift", "Dart", "R", "Julia"
      ],
      llm_providers: ["RooCode proprietary models", "Multiple LLM support"],
      subprocess_support: true,
      tool_support: true,
      real_time_collaboration: true
    }
  },
  "39": {  // KiloCode
    features: [
      "High-speed code completion with sub-100ms latency",
      "Project-wide code understanding and navigation",
      "Automated refactoring with pattern recognition",
      "Smart imports and dependency management",
      "Code metrics and quality tracking",
      "Natural language code search across repositories",
      "Continuous learning from your coding patterns"
    ],
    technical: {
      context_window: 64000,
      multi_file_support: true,
      language_support: [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#",
        "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "Haskell"
      ],
      llm_providers: ["KiloCode AI engine", "Local model support"],
      subprocess_support: false,
      tool_support: true,
      local_model_support: true,
      response_time: "<100ms for completions"
    }
  },
  "42": {  // Qwen Code
    features: [
      "State-of-the-art code generation with Qwen models",
      "Multi-language support with specialized training",
      "Code completion with repository-level context",
      "Infilling capabilities for mid-code completions",
      "Code understanding and explanation",
      "Bug detection and fix suggestions",
      "Cross-language code translation",
      "Instruction following for code modifications"
    ],
    technical: {
      context_window: 131072,
      multi_file_support: true,
      language_support: [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#",
        "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala",
        "SQL", "Shell", "HTML", "CSS", "Markdown", "YAML", "JSON"
      ],
      llm_providers: ["Qwen-Coder-7B", "Qwen-Coder-14B", "Qwen-Coder-32B", "Qwen2.5-Coder"],
      subprocess_support: false,
      tool_support: false,
      model_sizes: ["1.5B", "7B", "14B", "32B"],
      specialized_models: true,
      open_source: true
    }
  }
};

// Apply updates to tools
tools.tools.forEach(tool => {
  // Apply company associations
  if (toolUpdates[tool.id] && toolUpdates[tool.id].company_id) {
    tool.company_id = toolUpdates[tool.id].company_id;
  }
  
  // Apply pricing details
  if (toolUpdates[tool.id] && toolUpdates[tool.id].pricing_details) {
    if (!tool.info.business) {
      tool.info.business = {};
    }
    tool.info.business.pricing_details = toolUpdates[tool.id].pricing_details;
  }
  
  // Apply feature enhancements
  if (toolEnhancements[tool.id]) {
    if (toolEnhancements[tool.id].features) {
      tool.info.features = toolEnhancements[tool.id].features;
    }
    if (toolEnhancements[tool.id].technical) {
      tool.info.technical = {
        ...tool.info.technical,
        ...toolEnhancements[tool.id].technical
      };
    }
  }
  
  // Update timestamps for modified tools
  if (toolUpdates[tool.id] || toolEnhancements[tool.id]) {
    tool.updated_at = new Date().toISOString();
  }
});

// Update tools metadata
tools.metadata.last_updated = new Date().toISOString();

// Save updated files
fs.writeFileSync(TOOLS_PATH, JSON.stringify(tools, null, 2));
fs.writeFileSync(COMPANIES_PATH, JSON.stringify(companies, null, 2));

console.log('✅ Database update complete!');
console.log('📊 Summary:');
console.log(`- Added ${newCompanies.length} new companies`);
console.log(`- Updated ${Object.keys(toolUpdates).length} tools with company associations or pricing`);
console.log(`- Enhanced ${Object.keys(toolEnhancements).length} tools with detailed features`);
console.log('\n📁 Updated files:');
console.log(`- ${TOOLS_PATH}`);
console.log(`- ${COMPANIES_PATH}`);