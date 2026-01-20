import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run seed logic (simplified version)
    const { data: audience, error: audienceError } = await supabase
      .from('audiences')
      .insert({
        user_id: user.id,
        name: 'Demo Audience - Families with Children over 11',
        description: 'Targeting families with older children for educational and entertainment products',
        target_reach: 5000000,
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        budget_total: 500000,
      } as any)
      .select()
      .single();

    if (audienceError) {
      return NextResponse.json({ error: 'Failed to create audience' }, { status: 500 });
    }

    // Create segments
    const audienceId = (audience as any).id;
    const segments = [
      {
        audience_id: audienceId,
        segment_type: 'primary' as const,
        construction_mode: 'extension' as const,
        provider: 'ONS',
        segment_key: 'older_school_age_families',
        segment_label: 'Older School-Age Families',
        description: 'Households with children aged 11-17, based on census-reported household composition.',
        is_selected: true,
        weight: 1,
      },
      {
        audience_id: audienceId,
        segment_type: 'primary' as const,
        construction_mode: 'extension' as const,
        provider: 'Experian',
        segment_key: 'growing_independence',
        segment_label: 'Growing Independence',
        description: 'Families with older children starting secondary or further education.',
        is_selected: true,
        weight: 1,
      },
      {
        audience_id: audienceId,
        segment_type: 'primary' as const,
        construction_mode: 'extension' as const,
        provider: 'CCS',
        segment_key: 'tech_savvy_family_units',
        segment_label: 'Tech-Savvy Family Units',
        description: 'Households with teenagers where media consumption is shared across connected devices.',
        is_selected: true,
        weight: 1,
      },
    ];

    await supabase.from('audience_segments').insert(segments as any);

    // Create profile settings
    await supabase.from('audience_profile_settings').insert({
      audience_id: audienceId,
      scale_accuracy: 50,
      reach_mode: 'balanced',
      derived_audience_size: 5050000,
      confidence_high: 0.6,
      confidence_medium: 0.3,
      confidence_low: 0.1,
    } as any);

    return NextResponse.json({ success: true, audienceId: audienceId });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
