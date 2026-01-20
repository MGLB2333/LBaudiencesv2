import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * API route for POI search using service role (bypasses RLS)
 * This is a fallback if client-side search fails due to RLS/auth issues
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const searchParams = request.nextUrl.searchParams;
    const brandQuery = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let query = supabase
      .from('store_pois')
      .select('*')
      .order('brand', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit);

    if (brandQuery.trim()) {
      const searchTerm = brandQuery.trim();
      query = query.or(`brand.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('POI search error:', error);
      return NextResponse.json(
        { error: 'Failed to search POIs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('POI search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
