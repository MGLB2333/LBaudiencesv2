import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  console.log('Seeding database...');

  // Create a test user (you'll need to do this via Supabase Auth UI or API)
  // For now, we'll assume a user exists with email: test@example.com
  // You can create this user manually or via Supabase dashboard

  // Get the first user (or use a specific user ID)
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  
  if (userError || !users || users.users.length === 0) {
    console.log('No users found. Please create a user first via Supabase Auth.');
    return;
  }

  const testUserId = users.users[0].id;
  console.log(`Using user ID: ${testUserId}`);

  // Create a demo audience
  const { data: audience, error: audienceError } = await supabase
    .from('audiences')
    .insert({
      user_id: testUserId,
      name: 'Families with Children over 11 years old',
      description: 'Targeting families with older children for educational and entertainment products',
      target_reach: 5000000,
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      budget_total: 500000,
    })
    .select()
    .single();

  if (audienceError) {
    console.error('Error creating audience:', audienceError);
    return;
  }

  console.log('Created audience:', audience.id);

  // Create default segments
  const segments = [
    {
      audience_id: audience.id,
      segment_type: 'primary' as const,
      construction_mode: 'extension' as const,
      provider: 'ONS',
      segment_key: 'older_school_age_families',
      segment_label: 'Older School-Age Families',
      description: 'Households with children aged 11-17, based on census-reported household composition. Typically suburban or edge-of-town locations.',
      is_selected: true,
      weight: 1,
    },
    {
      audience_id: audience.id,
      segment_type: 'primary' as const,
      construction_mode: 'extension' as const,
      provider: 'Experian',
      segment_key: 'growing_independence',
      segment_label: 'Growing Independence',
      description: 'Families with older children starting secondary or further education, showing increased independence and digital engagement.',
      is_selected: true,
      weight: 1,
    },
    {
      audience_id: audience.id,
      segment_type: 'primary' as const,
      construction_mode: 'extension' as const,
      provider: 'CCS',
      segment_key: 'tech_savvy_family_units',
      segment_label: 'Tech-Savvy Family Units',
      description: 'Households with teenagers where media consumption is shared across connected devices, with high CTV and social usage.',
      is_selected: true,
      weight: 1,
    },
    {
      audience_id: audience.id,
      segment_type: 'primary' as const,
      construction_mode: 'extension' as const,
      provider: 'CCS',
      segment_key: 'weekend_activity_seekers',
      segment_label: 'Weekend Activity Seekers',
      description: 'Families that engage in weekend activities and outings, showing patterns of leisure and family time.',
      is_selected: true,
      weight: 1,
    },
  ];

  const { error: segmentsError } = await supabase
    .from('audience_segments')
    .insert(segments);

  if (segmentsError) {
    console.error('Error creating segments:', segmentsError);
    return;
  }

  console.log('Created segments');

  // Create profile settings
  const { error: profileError } = await supabase
    .from('audience_profile_settings')
    .insert({
      audience_id: audience.id,
      scale_accuracy: 50,
      reach_mode: 'balanced',
      derived_audience_size: 5050000,
      confidence_high: 0.6,
      confidence_medium: 0.3,
      confidence_low: 0.1,
    });

  if (profileError) {
    console.error('Error creating profile settings:', profileError);
    return;
  }

  console.log('Created profile settings');

  // Create demo geo units (fake H3 tiles for UK)
  const geoUnits = [];
  const ukLatLngs = [
    { lat: 51.5074, lng: -0.1278, name: 'London' },
    { lat: 53.4808, lng: -2.2426, name: 'Manchester' },
    { lat: 52.4862, lng: -1.8904, name: 'Birmingham' },
    { lat: 53.8008, lng: -1.5491, name: 'Leeds' },
    { lat: 55.9533, lng: -3.1883, name: 'Edinburgh' },
    { lat: 51.4816, lng: -3.1791, name: 'Cardiff' },
    { lat: 53.4084, lng: -2.9916, name: 'Liverpool' },
    { lat: 52.9548, lng: -1.1581, name: 'Nottingham' },
  ];

  for (let i = 0; i < 200; i++) {
    const base = ukLatLngs[i % ukLatLngs.length];
    const lat = base.lat + (Math.random() - 0.5) * 0.5;
    const lng = base.lng + (Math.random() - 0.5) * 0.5;
    const score = Math.random() * 100;
    const tier = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';

    geoUnits.push({
      audience_id: audience.id,
      geo_type: 'h3' as const,
      geo_id: `h3_${i}_${Date.now()}`,
      score,
      confidence_tier: tier as 'high' | 'medium' | 'low' | 'discarded',
      drivers: {
        top_segments: ['older_school_age_families', 'tech_savvy_family_units'],
        variables: ['household_size', 'age_range', 'media_consumption'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lng - 0.01, lat - 0.01],
          [lng + 0.01, lat - 0.01],
          [lng + 0.01, lat + 0.01],
          [lng - 0.01, lat + 0.01],
          [lng - 0.01, lat - 0.01],
        ]],
      },
    });
  }

  const { error: geoError } = await supabase
    .from('geo_units')
    .insert(geoUnits);

  if (geoError) {
    console.error('Error creating geo units:', geoError);
    return;
  }

  console.log('Created geo units');

  // Create demo POI layers
  const poiLayers = [
    {
      audience_id: audience.id,
      layer_name: 'Morrisons',
      layer_type: 'stores' as const,
      metadata: { count: 450, source: 'retail_data' },
      is_enabled: true,
    },
    {
      audience_id: audience.id,
      layer_name: 'Aldi',
      layer_type: 'stores' as const,
      metadata: { count: 380, source: 'retail_data' },
      is_enabled: false,
    },
    {
      audience_id: audience.id,
      layer_name: 'Asda',
      layer_type: 'stores' as const,
      metadata: { count: 520, source: 'retail_data' },
      is_enabled: false,
    },
  ];

  const { error: poiError } = await supabase
    .from('poi_layers')
    .insert(poiLayers);

  if (poiError) {
    console.error('Error creating POI layers:', poiError);
    return;
  }

  console.log('Created POI layers');
  console.log('Seeding complete!');
}

seed().catch(console.error);
