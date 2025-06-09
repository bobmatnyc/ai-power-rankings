import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_KEY = process.env.MCP_API_KEY!;

// Auth check
function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  return authHeader.substring(7) === API_KEY;
}

export async function POST(request: NextRequest) {
  // Check authentication
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, name, company_name, category, description, website_url, pricing_model } = await request.json();
    
    // Validate required fields
    if (!id || !name || !company_name || !category || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, company_name, category, description' },
        { status: 400 }
      );
    }

    // First ensure company exists
    let companyId;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', company_name)
      .single();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const slug = company_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: company_name,
          slug: slug,
          website_url: website_url || `https://${slug}.com`,
          company_size: 'startup',
          company_type: 'private',
          description: `${company_name} - AI coding tools company`
        })
        .select('id')
        .single();

      if (companyError) {
        return NextResponse.json({ error: companyError.message }, { status: 500 });
      }
      companyId = newCompany.id;
    }

    // Add the tool
    const { data, error } = await supabase
      .from('tools')
      .insert({
        id,
        name,
        slug: id,
        company_id: companyId,
        category,
        subcategory: category,
        description,
        tagline: description.substring(0, 100) + '...',
        website_url: website_url || `https://${id}.com`,
        founded_date: new Date().toISOString().split('T')[0],
        first_tracked_date: new Date().toISOString().split('T')[0],
        pricing_model: pricing_model || 'freemium',
        license_type: 'proprietary',
        status: 'active',
        logo_url: `https://${id}.com/favicon.ico`
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} - ADD_TOOL:`, {
      tool_id: id,
      name,
      company: company_name,
      category
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}