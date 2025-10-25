import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 6: Zed - High-Performance Multiplayer Code Editor
 * Complete content creation from 20% to 100%
 */

const zedData = {
  id: "zed",
  name: "Zed",
  company: "Zed Industries",
  tagline: "High-performance multiplayer code editor from Atom and Tree-sitter creators with Rust+GPU architecture delivering 58ms edit response (2x faster AI completions), $42M funding, and Windows launch 2025",
  description: "Zed is the high-performance, multiplayer-first code editor from the creators of Atom, Electron, and Tree-sitter (Nathan Sobo, Max Brunsfeld, Antonio Scandurra) representing 15+ years industry-leading developer tools experience, built from scratch in Rust with GPU acceleration through custom GPUI framework delivering exceptional 58ms edit response times (vs 75ms Sublime Text, 97ms VS Code), 2x faster AI code completions, and native multiplayer collaboration without extensions through CRDTs and team channels. The platform leverages breakthrough Rust+GPU architecture where GPUI custom hardware-accelerated UI framework rasterizes entire window on GPU like 3D video game enabling unprecedented performance and responsiveness impossible with traditional UI frameworks, multicore CPU optimization extracting maximum performance from modern processors, and Tree-sitter incremental parsing framework (created by Zed co-founder Max Brunsfeld, powering GitHub's code analysis) delivering blazing-fast syntax highlighting and code intelligence across all supported languages. Zed delivers comprehensive features including native multiplayer collaboration as first-class feature enabling real-time pair programming without plugin installation, AI integration with Claude Code beta providing context-aware suggestions via new Agent Client Protocol, 58ms edit response benchmarks demonstrating superior performance over established editors, CRDT-based conflict-free collaborative editing, team channels for persistent collaboration spaces, Rust programming language for memory safety and concurrency, custom GPUI GPU-accelerated UI framework, Tree-sitter parsing for fast accurate syntax analysis, cross-platform support (macOS, Linux, Windows with February 2025 launch adapting Rust architecture to DirectX 11), Vim mode for modal editing enthusiasts, extensions and theming customization, and AI-optional philosophy treating AI as enhancement rather than requirement. Backed by $42 million total funding including $32 million Series B (August 2025) led by Redpoint Ventures following $10 million Series A (2023), with founders bringing proven track record creating Atom (hackable text editor serving millions), Electron (desktop app platform launching new generation of applications), and Tree-sitter (incremental parsing framework powering GitHub code analysis globally), Zed represents next-generation editor evolution prioritizing performance through systems programming (Rust), hardware acceleration (GPU), and collaboration-first design philosophy. Available 100% free as open source project on GitHub (zed-industries/zed) with optional paid services for cloud features, supporting macOS, Linux, and Windows (February 2025 launch overcoming DirectX 11 graphics stack challenges) with comprehensive language support powered by Tree-sitter, Zed delivers the definitive high-performance collaborative code editing experience combining Atom creators' 15+ years expertise with modern Rust+GPU architecture achieving 2x faster AI completions, 58ms edit response industry leadership, and native multiplayer collaboration transforming pair programming and team development workflows without sacrificing extensibility or customization freedom developers expect from modern editors.",
  overview: "Zed revolutionizes code editing by combining breakthrough Rust+GPU architecture with native multiplayer collaboration and AI integration, created by industry veterans (Nathan Sobo, Max Brunsfeld, Antonio Scandurra) who built Atom, Electron, and Tree-sitter representing 15+ years developing tools serving millions of developers globally. Unlike traditional editors built on JavaScript/Electron architectures introducing performance overhead, Zed leverages Rust programming language for memory safety and fearless concurrency, custom GPUI hardware-accelerated UI framework rasterizing entire interface on GPU like 3D video game, and multicore CPU optimization extracting maximum performance from modern processors, delivering measurable performance advantages including 58ms edit response time (vs 75ms Sublime Text, 97ms VS Code) and 2x faster AI code completions critical for AI-assisted development workflows. The platform treats collaboration as first-class feature rather than afterthought, providing native multiplayer editing through CRDT (Conflict-free Replicated Data Types) algorithms enabling seamless real-time pair programming without plugin installation, team channels creating persistent collaboration spaces, and call functionality allowing developers to instantly connect with colleagues and start live editing same project together—capabilities requiring complex third-party extensions in competing editors now built directly into Zed's core architecture. Zed's GPUI custom framework represents fundamental innovation in editor architecture, rasterizing entire window on GPU using techniques from 3D game development, enabling fluid animations, instant visual feedback, and responsive interface even with large files or complex syntax highlighting where traditional CPU-bound rendering struggles, while Rust's memory safety and concurrency primitives ensure stability and performance scalability as codebases and collaboration sessions grow. Tree-sitter incremental parsing framework (created by Zed co-founder Max Brunsfeld, currently powering all code analysis at GitHub) provides blazing-fast and expressive syntax highlighting, code folding, and language intelligence that updates incrementally as developers type rather than reparsing entire files, supporting comprehensive language coverage while maintaining consistent performance regardless of file size or complexity. AI integration through Claude Code beta (announced September 2025) enables context-aware code suggestions leveraging new Agent Client Protocol, treating AI as powerful optional enhancement rather than mandatory dependency, allowing developers to enable AI assistance when beneficial while preserving core editor performance and usability for developers preferring traditional workflows or working in AI-restricted environments. The Windows launch in February 2025 required Zed team to adapt Rust-based architecture to Windows graphics stack, ultimately selecting DirectX 11 for smoother rendering, demonstrating commitment to cross-platform excellence while maintaining performance characteristics that differentiate Zed from electron-based alternatives compromising native platform integration for development convenience. Backed by $42 million total funding including $32 million Series B led by Redpoint Ventures (August 2025) and $10 million Series A (2023), Zed demonstrates strong investor confidence in performance-focused, collaboration-first editor approach differentiating from established market dominated by VS Code, while founders' proven track record creating widely-adopted developer tools (Atom serving millions, Electron launching new generation of desktop apps, Tree-sitter powering GitHub globally) validates team's capability executing ambitious technical vision. Available 100% free as open source project on GitHub (zed-industries/zed) with transparent development and community contributions, supporting macOS, Linux, and Windows (February 2025) with comprehensive language support through Tree-sitter, Vim mode for modal editing enthusiasts, extensions and themes for customization, and optional paid cloud services for advanced collaboration features, Zed represents next-generation code editor evolution combining Atom creators' 15+ years expertise with modern systems programming (Rust), hardware acceleration (GPU), native collaboration (CRDTs), and AI integration (Claude Code beta) delivering measurable performance advantages (58ms edit response, 2x faster AI) essential for productive modern development workflows emphasizing speed, collaboration, and AI assistance without compromising stability, extensibility, or developer choice.",
  website: "https://zed.dev/",
  website_url: "https://zed.dev/",
  launch_year: 2022,
  updated_2025: true,
  category: "code-editor",
  pricing_model: "free",

  features: [
    "Rust+GPU architecture for exceptional performance",
    "Custom GPUI hardware-accelerated UI framework",
    "58ms edit response (vs 75ms Sublime, 97ms VS Code)",
    "2x faster AI code completions",
    "Native multiplayer collaboration (no extensions)",
    "CRDT-based conflict-free collaborative editing",
    "Team channels for persistent collaboration spaces",
    "Call functionality for instant pair programming",
    "AI integration: Claude Code beta (Agent Client Protocol)",
    "Tree-sitter incremental parsing (created by co-founder)",
    "Multicore CPU optimization",
    "GPU-accelerated rendering (3D game techniques)",
    "Cross-platform: macOS, Linux, Windows (Feb 2025)",
    "100% free and open source (GitHub: zed-industries/zed)",
    "Vim mode for modal editing",
    "Extensions and themes customization",
    "AI-optional philosophy (enhancement, not requirement)",
    "DirectX 11 rendering on Windows"
  ],

  use_cases: [
    "High-performance code editing with 58ms response",
    "Real-time multiplayer pair programming",
    "AI-assisted development with 2x faster completions",
    "Team collaboration through persistent channels",
    "Large codebase editing with GPU acceleration",
    "Remote collaboration without third-party tools",
    "Rust development with native toolchain integration",
    "Systems programming requiring fast editor response",
    "Open source development with transparent tooling",
    "Cross-platform development (macOS, Linux, Windows)",
    "Vim enthusiasts seeking modern multiplayer editor",
    "Performance-critical workflows where editor lag impacts productivity",
    "Educational pair programming and code reviews",
    "Distributed team real-time collaboration"
  ],

  integrations: [
    "Claude Code (beta AI integration)",
    "Agent Client Protocol (AI suggestions)",
    "Tree-sitter (syntax parsing)",
    "Git and version control systems",
    "macOS (native support)",
    "Linux (native support)",
    "Windows (DirectX 11, launched Feb 2025)",
    "GitHub (open source repository)",
    "Vim keybindings and modal editing",
    "Language servers (LSP)",
    "Extensions marketplace",
    "Themes and customization",
    "Terminal integration",
    "Debugger protocols"
  ],

  pricing: {
    model: "100% Free and Open Source with optional paid cloud services",
    free_tier: true,
    tiers: [
      {
        name: "Free (Open Source)",
        price: "$0",
        billing: "Forever",
        target: "All developers",
        recommended: true,
        features: [
          "100% free and open source",
          "Full editor capabilities",
          "Native multiplayer collaboration",
          "CRDT-based collaborative editing",
          "Team channels",
          "Call functionality for pair programming",
          "AI integration: Claude Code beta",
          "58ms edit response performance",
          "2x faster AI completions",
          "GPU-accelerated rendering",
          "Tree-sitter parsing",
          "Vim mode",
          "Extensions and themes",
          "macOS, Linux, Windows support",
          "Community support via GitHub"
        ]
      },
      {
        name: "Cloud Services (Optional)",
        price: "TBD",
        billing: "Future paid services",
        target: "Teams requiring advanced cloud features",
        features: [
          "Enhanced cloud collaboration features",
          "Advanced team management",
          "Cloud-based project sync",
          "Enterprise support options",
          "Pricing to be announced"
        ]
      }
    ]
  },

  differentiators: [
    "Created by Atom, Electron, Tree-sitter pioneers (15+ years experience)",
    "Rust+GPU architecture (custom GPUI framework)",
    "58ms edit response (vs 75ms Sublime, 97ms VS Code)",
    "2x faster AI code completions",
    "Native multiplayer (CRDT-based, no extensions)",
    "GPU rasterization (3D game rendering techniques)",
    "Tree-sitter parsing by original creator (Max Brunsfeld)",
    "$42M total funding ($32M Series B Aug 2025)",
    "100% free and open source",
    "Windows launch Feb 2025 (DirectX 11 adaptation)",
    "AI-optional philosophy (enhancement not requirement)",
    "First-class collaboration (not afterthought)",
    "Multicore CPU optimization"
  ],

  target_audience: "Performance-focused developers requiring 58ms edit response and 2x faster AI completions; remote and distributed teams needing native multiplayer collaboration; Rust developers seeking native toolchain integration; Vim users wanting modern collaborative editor; systems programmers requiring editor responsiveness; pair programmers and educators conducting real-time code sessions; open source enthusiasts preferring transparent development; cross-platform teams working across macOS, Linux, Windows (Feb 2025); and AI-assisted developers seeking optional AI integration without mandatory cloud dependencies",

  recent_updates_2025: [
    "Windows launch February 2025 with DirectX 11 rendering",
    "$32 million Series B funding (August 2025)",
    "Claude Code beta AI integration announced",
    "Agent Client Protocol support for AI suggestions",
    "Enhanced multiplayer collaboration features",
    "Performance optimizations (58ms edit response maintained)",
    "2x faster AI completion improvements",
    "Cross-platform Windows support completed",
    "GPU rendering optimizations",
    "Tree-sitter parsing enhancements",
    "Extended language support",
    "Vim mode improvements",
    "Extensions marketplace expansion"
  ],

  compliance: [
    "100% open source (transparent security audit)",
    "Code available on GitHub (zed-industries/zed)",
    "Community-driven development",
    "No mandatory cloud dependencies",
    "Local-first architecture",
    "Optional cloud services (future)"
  ],

  parent_company: "Zed Industries",
  headquarters: "San Francisco, California, USA",

  founders: [
    {
      name: "Nathan Sobo",
      background: "Atom co-creator, Electron co-creator"
    },
    {
      name: "Max Brunsfeld",
      background: "Tree-sitter creator (powers GitHub code analysis), Atom co-creator"
    },
    {
      name: "Antonio Scandurra",
      background: "Atom co-creator, Electron contributor"
    }
  ],

  funding_history: {
    series_a: "$10M (2023) led by Redpoint Ventures",
    series_b: "$32M (August 2025) led by Redpoint Ventures",
    total_funding: "$42M"
  },

  technical_architecture: {
    language: "Rust (memory safety, fearless concurrency)",
    ui_framework: "GPUI (custom GPU-accelerated framework)",
    rendering: "GPU rasterization (3D game techniques)",
    parsing: "Tree-sitter (incremental, created by co-founder)",
    collaboration: "CRDTs (Conflict-free Replicated Data Types)",
    windows_graphics: "DirectX 11 (Feb 2025 adaptation)",
    cpu: "Multicore optimization"
  },

  performance_benchmarks: {
    edit_response: "58ms (vs 75ms Sublime Text, 97ms VS Code)",
    ai_completions: "2x faster than competitors",
    rendering: "GPU-accelerated (60fps+ sustained)",
    parsing: "Incremental via Tree-sitter"
  },

  historical_impact: {
    atom: "Hackable text editor serving millions of developers",
    electron: "Desktop app platform launching new generation of applications",
    tree_sitter: "Powers all code analysis at GitHub globally",
    combined_experience: "15+ years industry-leading developer tools"
  }
};

async function updateZed() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Zed with Phase 6 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: zedData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'zed'));

    console.log('✅ Zed updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Zed Industries');
    console.log('   - Category: code-editor');
    console.log('   - Features: 18 comprehensive features');
    console.log('   - Pricing: 100% FREE and open source');
    console.log('   - Use Cases: 14 specialized scenarios');
    console.log('   - Integrations: 14 platforms and tools');
    console.log('   - Founders: Atom, Electron, Tree-sitter creators');
    console.log('   - Performance: 58ms edit response (2x faster AI)');
    console.log('   - Funding: $42M total ($32M Series B Aug 2025)');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 13 major enhancements');

  } catch (error) {
    console.error('❌ Error updating Zed:', error);
    throw error;
  }
}

updateZed();
