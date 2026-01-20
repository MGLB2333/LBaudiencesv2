import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const storagePath = searchParams.get('path');

    if (!storagePath) {
      return NextResponse.json({ error: 'Missing storage path' }, { status: 400 });
    }

    // Verify ownership via exports table
    const { data: exportRecord, error: exportError } = await supabase
      .from('exports')
      .select('id, user_id, storage_path')
      .eq('storage_path', storagePath)
      .eq('user_id', user.id)
      .single();

    if (exportError || !exportRecord) {
      return NextResponse.json({ error: 'Export not found or access denied' }, { status: 403 });
    }

    // Generate signed URL with short expiry (15 minutes)
    const { data, error } = await supabase.storage
      .from('audience-exports')
      .createSignedUrl(storagePath, 900); // 15 minutes

    if (error) {
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    console.error('Download URL generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
