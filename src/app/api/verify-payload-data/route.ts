import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config });
    
    const report = {
      collections: {} as Record<string, any>,
      relationships: {} as Record<string, any>,
      data_quality: {} as Record<string, any>,
      summary: {} as Record<string, any>,
    };
    
    // 1. Verify Companies Collection
    const { docs: companies, totalDocs: totalCompanies } = await payload.find({
      collection: "companies",
      limit: 1000,
    });
    
    const companiesIssues = [];
    const companyTypes = new Set();
    const companyYears = [];
    
    for (const company of companies) {
      // Check required fields
      if (!company['name'] || company['name'].includes('Unknown Company')) {
        companiesIssues.push({
          id: company.id,
          issue: 'Missing or invalid name',
          name: company['name'],
        });
      }
      
      if (!company['slug']) {
        companiesIssues.push({
          id: company.id,
          issue: 'Missing slug',
          name: company['name'],
        });
      }
      
      if (company['company_type']) {
        companyTypes.add(company['company_type']);
      }
      
      if (company['founded_year']) {
        companyYears.push(company['founded_year']);
      }
    }
    
    report.collections['companies'] = {
      total: totalCompanies,
      issues: companiesIssues,
      company_types: Array.from(companyTypes),
      founded_years: {
        min: Math.min(...companyYears),
        max: Math.max(...companyYears),
        count: companyYears.length,
      },
    };
    
    // 2. Verify Tools Collection
    const { docs: tools, totalDocs: totalTools } = await payload.find({
      collection: "tools",
      limit: 1000,
    });
    
    const toolsIssues = [];
    const toolsWithoutCompany = [];
    const toolCategories = new Set();
    
    for (const tool of tools) {
      // Check required fields
      if (!tool['name']) {
        toolsIssues.push({
          id: tool.id,
          issue: 'Missing name',
        });
      }
      
      if (!tool['slug']) {
        toolsIssues.push({
          id: tool.id,
          issue: 'Missing slug',
          name: tool['name'],
        });
      }
      
      if (!tool['company']) {
        toolsWithoutCompany.push({
          id: tool.id,
          name: tool['name'],
        });
      }
      
      if (tool['category']) {
        toolCategories.add(tool['category']);
      }
    }
    
    report.collections['tools'] = {
      total: totalTools,
      issues: toolsIssues,
      tools_without_company: toolsWithoutCompany,
      categories: Array.from(toolCategories),
    };
    
    // 3. Verify News Collection
    const { totalDocs: totalNews } = await payload.find({
      collection: "news",
      limit: 0,
    });
    
    const { docs: sampleNews } = await payload.find({
      collection: "news",
      limit: 5,
      sort: '-createdAt',
    });
    
    const newsIssues = [];
    for (const article of sampleNews) {
      if (!article['title']) {
        newsIssues.push({
          id: article.id,
          issue: 'Missing title',
        });
      }
      
      if (!article['url']) {
        newsIssues.push({
          id: article.id,
          issue: 'Missing URL',
          title: article['title'],
        });
      }
    }
    
    report.collections['news'] = {
      total: totalNews,
      sample_issues: newsIssues,
      latest_articles: sampleNews.map((article: any) => ({
        id: article.id,
        title: article['title'],
        url: article['url'],
        createdAt: article.createdAt,
      })),
    };
    
    // 4. Verify Users Collection
    const { totalDocs: totalUsers } = await payload.find({
      collection: "users",
      limit: 0,
    });
    
    report.collections['users'] = {
      total: totalUsers,
    };
    
    // 5. Check Relationships
    // Tools -> Companies relationship
    const orphanedTools = [];
    for (const tool of tools.slice(0, 20)) { // Check first 20 tools
      if (tool['company']) {
        const companyId = typeof tool['company'] === 'object' ? tool['company'].id : tool['company'];
        const companyExists = companies.some(c => c.id === companyId);
        if (!companyExists) {
          orphanedTools.push({
            tool_id: tool.id,
            tool_name: tool['name'],
            company_id: companyId,
          });
        }
      }
    }
    
    report.relationships['tools_companies'] = {
      orphaned_tools: orphanedTools,
      tools_with_companies: tools.filter(t => t['company']).length,
      tools_without_companies: tools.filter(t => !t['company']).length,
    };
    
    // 6. Data Quality Checks
    // Check for duplicate slugs in companies
    const companySlugs = companies.map(c => c['slug']).filter(Boolean);
    const duplicateCompanySlugs = companySlugs.filter((slug, index) => companySlugs.indexOf(slug) !== index);
    
    // Check for duplicate slugs in tools
    const toolSlugs = tools.map(t => t['slug']).filter(Boolean);
    const duplicateToolSlugs = toolSlugs.filter((slug, index) => toolSlugs.indexOf(slug) !== index);
    
    report.data_quality = {
      duplicate_company_slugs: [...new Set(duplicateCompanySlugs)],
      duplicate_tool_slugs: [...new Set(duplicateToolSlugs)],
      companies_missing_required_fields: companiesIssues.length,
      tools_missing_required_fields: toolsIssues.length,
    };
    
    // 7. Summary
    const totalIssues = companiesIssues.length + toolsIssues.length + orphanedTools.length + 
                       duplicateCompanySlugs.length + duplicateToolSlugs.length;
    
    report.summary = {
      total_collections: 4,
      total_records: totalCompanies + totalTools + totalNews + totalUsers,
      total_issues_found: totalIssues,
      data_integrity_score: totalIssues === 0 ? 100 : Math.max(0, 100 - (totalIssues * 2)),
      recommendations: totalIssues === 0 ? 
        ["Data integrity is excellent"] : 
        [
          companiesIssues.length > 0 && "Fix company data issues",
          toolsIssues.length > 0 && "Fix tool data issues", 
          orphanedTools.length > 0 && "Fix orphaned tool relationships",
          duplicateCompanySlugs.length > 0 && "Fix duplicate company slugs",
          duplicateToolSlugs.length > 0 && "Fix duplicate tool slugs",
        ].filter(Boolean),
    };
    
    loggers.api.info("Payload data verification complete", {
      totalRecords: report.summary['total_records'],
      totalIssues: totalIssues,
      score: report.summary['data_integrity_score'],
    });
    
    return NextResponse.json({
      message: "Payload data verification complete",
      timestamp: new Date().toISOString(),
      report,
    });
    
  } catch (error) {
    loggers.api.error("Failed to verify Payload data", { error });
    return NextResponse.json(
      { 
        error: "Failed to verify Payload data",
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}