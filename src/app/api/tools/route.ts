import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || ''
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(): Promise<NextResponse> {
  try {
    const { data: tools, error } = await supabase
      .from('tools')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching tools:', error)
      return NextResponse.json(
        { error: 'Failed to fetch tools' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tools: tools || [] })
  } catch (error) {
    console.error('Error in tools API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}