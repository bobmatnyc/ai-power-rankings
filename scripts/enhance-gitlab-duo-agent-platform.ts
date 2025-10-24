#!/usr/bin/env tsx

/**
 * Enhance GitLab Duo with Agent Platform Information
 *
 * Updates GitLab Duo tool data with comprehensive Agent Platform details
 * from October 2025 research, including 5 agent types and platform features.
 *
 * Agent Platform launched July 17, 2025 in Public Beta
 * Latest updates: October 2025 (GitLab 18.5) - Planner Agent & Security Analyst Agent
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function enhanceGitLabDuo() {
  const db = getDb();
  console.log("🚀 Enhancing GitLab Duo with Agent Platform Information\n");
  console.log("=".repeat(80));

  try {
    // 1. Query existing GitLab Duo data
    console.log("\n📋 Step 1: Loading existing GitLab Duo data...");
    const existing = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, "gitlab-duo"))
      .limit(1);

    if (existing.length === 0) {
      console.error("❌ GitLab Duo not found in database");
      process.exit(1);
    }

    const tool = existing[0];
    const existingData = tool.data as any;

    console.log(`✅ GitLab Duo found (ID: ${tool.id})`);
    console.log(`   Current Score: ${(tool.currentScore as any)?.overallScore || "N/A"}/100`);
    console.log(`   Rank: ${existingData.latest_ranking?.rank || "N/A"}`);

    // 2. Prepare Agent Platform enhancements
    console.log("\n📝 Step 2: Preparing Agent Platform data...");

    const agentPlatformData = {
      agent_platform: {
        launch_date: "July 17, 2025",
        status: "Public Beta",
        latest_version: "GitLab 18.5 (October 16, 2025)",
        description: "Multi-agent orchestration platform enabling specialized AI agents to automate complex DevSecOps workflows with human oversight.",

        agents: {
          software_development_agent: {
            name: "Software Development Agent",
            launch_date: "July 2025",
            status: "Active",
            target_users: "Developers, Engineers",
            capabilities: [
              "Creates code changes in virtual development environments",
              "Opens merge requests automatically",
              "Gathers comprehensive context from codebase",
              "Executes strategic implementation plans",
              "Autonomous code generation and modification",
              "Full repository awareness and navigation"
            ],
            use_cases: [
              "Feature implementation from requirements",
              "Bug fix automation",
              "Code refactoring at scale",
              "Technical debt reduction"
            ]
          },

          chat_agent: {
            name: "Duo Chat Agent",
            launch_date: "July 2025",
            status: "Active",
            target_users: "All developers",
            capabilities: [
              "Natural language code interaction",
              "Slash commands: /explain, /tests, /include",
              "IDE integration (VS Code, JetBrains)",
              "Iterative feedback with chat history",
              "Stateful conversations",
              "Context-aware responses"
            ],
            integrations: [
              "VS Code extension",
              "JetBrains IDEs suite",
              "GitLab Web UI",
              "CLI interface"
            ],
            use_cases: [
              "Code explanation and documentation",
              "Test generation requests",
              "Context gathering for complex tasks",
              "Interactive development assistance"
            ]
          },

          planner_agent: {
            name: "Duo Planner Agent",
            launch_date: "October 2025 (v18.5)",
            status: "NEW - Just Released",
            target_users: "Product Managers, Technical Leads",
            capabilities: [
              "Automates backlog analysis and prioritization",
              "Applies prioritization frameworks (RICE, MoSCoW)",
              "Read-only operations (planning/suggesting only)",
              "Issue analysis and categorization",
              "Strategic planning assistance",
              "Data-driven prioritization recommendations"
            ],
            frameworks_supported: [
              "RICE (Reach, Impact, Confidence, Effort)",
              "MoSCoW (Must, Should, Could, Won't)"
            ],
            use_cases: [
              "Sprint planning automation",
              "Backlog grooming and prioritization",
              "Strategic roadmap planning",
              "Issue triage and categorization",
              "Resource allocation optimization"
            ],
            limitations: [
              "Read-only mode (does not modify issues)",
              "Suggestions require human approval",
              "Planning and analysis focus only"
            ]
          },

          security_analyst_agent: {
            name: "Duo Security Analyst Agent",
            launch_date: "October 2025 (v18.5)",
            status: "NEW - Just Released",
            target_users: "Security teams, DevSecOps engineers",
            tier_requirement: "Ultimate tier + Duo add-on",
            capabilities: [
              "Lists vulnerabilities with CVE scores",
              "Provides EPSS (Exploit Prediction Scoring System) scores",
              "Automates vulnerability triage process",
              "Prioritizes security issues by risk",
              "Generates remediation recommendations",
              "Security posture analysis"
            ],
            metrics_provided: [
              "CVE (Common Vulnerabilities and Exposures) scores",
              "EPSS (Exploit Prediction Scoring System) scores",
              "Risk severity assessments",
              "Remediation complexity estimates"
            ],
            use_cases: [
              "Automated vulnerability scanning and triage",
              "Security backlog prioritization",
              "Risk assessment automation",
              "Compliance report generation",
              "Security debt tracking"
            ],
            pricing_note: "Requires GitLab Ultimate tier + Duo add-on subscription"
          },

          agents_in_development: {
            description: "Additional specialized agents currently in development roadmap",
            planned_agents: [
              {
                name: "Deep Research Agent",
                focus: "In-depth codebase analysis and research",
                status: "Development"
              },
              {
                name: "Product Planning Agent",
                focus: "Strategic product planning and roadmap generation",
                status: "Development"
              },
              {
                name: "Software Testing Agent",
                focus: "Comprehensive test generation and validation",
                status: "Development"
              },
              {
                name: "Code Review Agent",
                focus: "Automated code review and quality analysis",
                status: "Development"
              },
              {
                name: "Platform Engineering Agent",
                focus: "Infrastructure and platform automation",
                status: "Development"
              },
              {
                name: "Deployment Engineering Agent",
                focus: "CI/CD optimization and deployment automation",
                status: "Development"
              }
            ]
          }
        },

        platform_features: {
          orchestration: {
            description: "Advanced multi-agent coordination and workflow management",
            capabilities: [
              "Multi-agent workflows with parallel specialized roles",
              "Unified orchestration layer",
              "Asynchronous human-agent collaboration",
              "Knowledge graph beyond LLM context limits",
              "Agent task delegation and coordination",
              "Workflow state management"
            ]
          },

          customization: {
            description: "Flexible agent customization and configuration",
            capabilities: [
              "CLI agent creation tools",
              "Natural language agent rules",
              "Custom coding standards and preferences",
              "Organization-specific workflows",
              "Agent behavior configuration",
              "Team-specific customization"
            ]
          },

          integration: {
            description: "Extensive integration capabilities with external systems",
            capabilities: [
              "Model Context Protocol (MCP) support",
              "Third-party AI model integration",
              "External system connectivity",
              "IDE integrations: VS Code, JetBrains suite",
              "API-first architecture",
              "Webhook and event-driven workflows"
            ],
            supported_protocols: [
              "Model Context Protocol (MCP)",
              "REST API",
              "GraphQL",
              "Webhooks"
            ]
          },

          technical_infrastructure: {
            description: "Robust technical foundation for agent operations",
            capabilities: [
              "Virtual development environments",
              "Stateful conversations with history",
              "Agent API (in development)",
              "AI Agent Catalog (planned)",
              "Secure execution sandboxes",
              "Context persistence and retrieval"
            ],
            roadmap: [
              "Agent API for custom integrations",
              "AI Agent Catalog for agent discovery",
              "Enhanced customization options",
              "Additional agent specializations"
            ]
          }
        },

        recent_updates: {
          october_2025: {
            version: "GitLab 18.5",
            release_date: "October 16, 2025",
            new_features: [
              "Duo Planner Agent - Automated backlog analysis for Product Managers",
              "Duo Security Analyst Agent - Vulnerability triage with CVE/EPSS scoring",
              "Enhanced multi-agent orchestration",
              "Improved agent customization options",
              "Agent performance optimizations"
            ],
            focus_areas: [
              "Product management automation",
              "Security workflow automation",
              "Agent platform maturity",
              "Enterprise readiness"
            ]
          },

          july_2025: {
            version: "GitLab 18.0+",
            release_date: "July 17, 2025",
            initial_launch: [
              "Agent Platform Public Beta launch",
              "Software Development Agent",
              "Chat Agent with slash commands",
              "Multi-agent orchestration foundation",
              "Virtual development environments"
            ]
          }
        },

        competitive_advantages: [
          "Native integration with GitLab DevSecOps platform",
          "Multi-agent orchestration with unified platform",
          "Read-only agents for safe planning and analysis",
          "Specialized agents for different user personas",
          "Knowledge graph beyond LLM token limits",
          "MCP protocol support for extensibility",
          "Virtual development environments for safe execution",
          "Asynchronous human-agent collaboration model"
        ]
      }
    };

    // 3. Merge with existing data
    console.log("\n🔄 Step 3: Merging Agent Platform data with existing tool data...");

    // Update features list to include Agent Platform capabilities
    const updatedFeatures = [
      ...(existingData.features || []),
      "Agent Platform with multi-agent orchestration (July 2025)",
      "Software Development Agent for autonomous code changes",
      "Duo Chat Agent with slash commands and IDE integration",
      "Duo Planner Agent for backlog analysis (October 2025)",
      "Duo Security Analyst Agent with CVE/EPSS scoring (October 2025)",
      "6+ additional agents in development pipeline",
      "Model Context Protocol (MCP) integration",
      "Virtual development environments for agents",
      "Natural language agent customization",
      "Knowledge graph beyond LLM context limits"
    ];

    // Update differentiators
    const updatedDifferentiators = [
      ...(existingData.differentiators || []),
      "Agent Platform with 5+ specialized agents (industry-leading)",
      "Duo Planner Agent for Product Manager workflows (October 2025)",
      "Duo Security Analyst Agent with automated triage (October 2025)",
      "Multi-agent orchestration with unified platform",
      "MCP protocol support for third-party AI models",
      "Virtual development environments for safe agent execution"
    ];

    // Update use cases
    const updatedUseCases = [
      ...(existingData.use_cases || []),
      "Autonomous feature development with Software Development Agent",
      "Backlog analysis and prioritization with Planner Agent",
      "Automated vulnerability triage with Security Analyst Agent",
      "Multi-agent workflow orchestration",
      "Custom agent creation for organization-specific workflows"
    ];

    // Update enterprise features
    const updatedEnterpriseFeatures = [
      ...(existingData.enterprise_features || []),
      "Duo Planner Agent for strategic planning automation",
      "Duo Security Analyst Agent for advanced security workflows",
      "Agent Platform with multi-agent orchestration",
      "Custom agent creation and configuration",
      "MCP protocol integration for third-party models",
      "Virtual development environments"
    ];

    // Update metrics
    const updatedMetrics = {
      ...existingData.metrics,
      agent_platform_launch: "July 17, 2025",
      latest_version: "GitLab 18.5 (October 16, 2025)",
      total_agents: "5 active + 6 in development",
      recent_agent_releases: "Planner Agent & Security Analyst Agent (October 2025)"
    };

    // Update technical section
    const updatedTechnical = {
      ...existingData.technical,
      agent_platform: {
        status: "Public Beta",
        launch_date: "July 17, 2025",
        agents_count: "5 active agents",
        orchestration: "Multi-agent workflows",
        customization: "Natural language rules, CLI tools",
        protocols: ["Model Context Protocol (MCP)", "REST API", "GraphQL"],
        environments: "Virtual development environments"
      }
    };

    // Construct updated data object
    const updatedData = {
      ...existingData,
      ...agentPlatformData,
      features: updatedFeatures,
      differentiators: updatedDifferentiators,
      use_cases: updatedUseCases,
      enterprise_features: updatedEnterpriseFeatures,
      metrics: updatedMetrics,
      technical: updatedTechnical,
      last_enhanced: new Date().toISOString(),
      enhancement_version: "Agent Platform October 2025"
    };

    // 4. Update the database
    console.log("\n💾 Step 4: Updating database...");

    await db
      .update(tools)
      .set({
        data: updatedData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, "gitlab-duo"));

    console.log("✅ Database updated successfully");

    // 5. Verify the update
    console.log("\n🔍 Step 5: Verifying update...");

    const updated = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, "gitlab-duo"))
      .limit(1);

    if (updated.length > 0) {
      const verifiedData = updated[0].data as any;

      console.log("\n" + "=".repeat(80));
      console.log("✅ VERIFICATION SUCCESSFUL");
      console.log("=".repeat(80));

      console.log("\n📊 Updated Tool Information:");
      console.log(`   Name: ${updated[0].name}`);
      console.log(`   Slug: ${updated[0].slug}`);
      console.log(`   Score: ${(updated[0].currentScore as any)?.overallScore || "N/A"}/100`);
      console.log(`   Rank: ${verifiedData.latest_ranking?.rank || "N/A"}`);

      console.log("\n🤖 Agent Platform Status:");
      console.log(`   Launch Date: ${verifiedData.agent_platform?.launch_date}`);
      console.log(`   Latest Version: ${verifiedData.agent_platform?.latest_version}`);
      console.log(`   Status: ${verifiedData.agent_platform?.status}`);

      console.log("\n👥 Active Agents:");
      const agents = verifiedData.agent_platform?.agents || {};
      let agentCount = 0;
      for (const [key, agent] of Object.entries(agents)) {
        if (key !== "agents_in_development") {
          agentCount++;
          const agentData = agent as any;
          const statusBadge = agentData.status?.includes("NEW") ? " 🆕" : "";
          console.log(`   ${agentCount}. ${agentData.name}${statusBadge}`);
          console.log(`      Status: ${agentData.status}`);
          console.log(`      Target: ${agentData.target_users}`);
        }
      }

      console.log("\n🚧 Agents in Development:");
      const plannedAgents = verifiedData.agent_platform?.agents?.agents_in_development?.planned_agents || [];
      plannedAgents.forEach((agent: any, index: number) => {
        console.log(`   ${index + 1}. ${agent.name}`);
        console.log(`      Focus: ${agent.focus}`);
      });

      console.log("\n🎯 Platform Features:");
      const platformFeatures = verifiedData.agent_platform?.platform_features || {};
      console.log(`   - Orchestration: ${platformFeatures.orchestration?.capabilities?.length || 0} capabilities`);
      console.log(`   - Customization: ${platformFeatures.customization?.capabilities?.length || 0} capabilities`);
      console.log(`   - Integration: ${platformFeatures.integration?.capabilities?.length || 0} capabilities`);
      console.log(`   - Technical: ${platformFeatures.technical_infrastructure?.capabilities?.length || 0} capabilities`);

      console.log("\n📈 Recent Updates:");
      const recentUpdates = verifiedData.agent_platform?.recent_updates?.october_2025 || {};
      console.log(`   Version: ${recentUpdates.version}`);
      console.log(`   Release Date: ${recentUpdates.release_date}`);
      console.log(`   New Features: ${recentUpdates.new_features?.length || 0}`);

      console.log("\n📝 Data Structure Updates:");
      console.log(`   Total Features: ${verifiedData.features?.length || 0}`);
      console.log(`   Total Use Cases: ${verifiedData.use_cases?.length || 0}`);
      console.log(`   Total Differentiators: ${verifiedData.differentiators?.length || 0}`);
      console.log(`   Total Enterprise Features: ${verifiedData.enterprise_features?.length || 0}`);

      console.log("\n🔖 Enhancement Metadata:");
      console.log(`   Last Enhanced: ${verifiedData.last_enhanced}`);
      console.log(`   Enhancement Version: ${verifiedData.enhancement_version}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✨ GitLab Duo Agent Platform Enhancement Completed Successfully!");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n❌ Error enhancing GitLab Duo:", error);
    throw error;
  } finally {
    await closeDb();
  }
}

async function main() {
  try {
    await enhanceGitLabDuo();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
