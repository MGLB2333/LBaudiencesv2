import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

interface StorePoi {
  brand: string;
  name: string;
  address?: string;
  city?: string;
  postcode?: string;
  lat: number;
  lng: number;
  website_url?: string;
  notes?: string;
}

// Sample stores with realistic UK locations
const sampleStores: StorePoi[] = [
  {
    brand: 'IKEA',
    name: 'IKEA Wembley',
    address: '2 Drury Way',
    city: 'London',
    postcode: 'NW10 0TH',
    lat: 51.5544,
    lng: -0.2964,
    website_url: 'https://www.ikea.com/gb/en/stores/wembley/',
    notes: 'Large IKEA store in North London',
  },
  {
    brand: 'Tesco',
    name: 'Tesco Extra Kingston',
    address: 'Clarence Street',
    city: 'Kingston upon Thames',
    postcode: 'KT1 1RB',
    lat: 51.4105,
    lng: -0.3034,
    website_url: 'https://www.tesco.com/store-locator/kingston',
    notes: 'Large Tesco Extra superstore',
  },
  {
    brand: 'Wickes',
    name: 'Wickes Croydon',
    address: 'Purley Way',
    city: 'Croydon',
    postcode: 'CR0 4RQ',
    lat: 51.3759,
    lng: -0.0994,
    website_url: 'https://www.wickes.co.uk/stores/croydon',
    notes: 'DIY and home improvement store',
  },
  {
    brand: 'B&Q',
    name: 'B&Q Wandsworth',
    address: 'Roehampton Vale',
    city: 'London',
    postcode: 'SW15 3DY',
    lat: 51.4417,
    lng: -0.2325,
    website_url: 'https://www.diy.com/store/wandsworth',
    notes: 'Large B&Q DIY store',
  },
  {
    brand: 'Magnet',
    name: 'Magnet Harrow',
    address: 'Wealdstone High Street',
    city: 'Harrow',
    postcode: 'HA3 5DQ',
    lat: 51.5981,
    lng: -0.3367,
    website_url: 'https://www.magnet.co.uk/stores/harrow',
    notes: 'Kitchen and bathroom showroom',
  },
];

async function seedStorePois() {
  // Get Supabase credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('Seeding store POIs...\n');

  const insertedPois: Array<{ id: string; brand: string; name: string }> = [];

  for (const store of sampleStores) {
    console.log(`Inserting: ${store.brand} - ${store.name}`);

    const { data: poi, error: insertError } = await supabase
      .from('store_pois')
      .insert({
        brand: store.brand,
        name: store.name,
        address: store.address,
        city: store.city,
        postcode: store.postcode,
        lat: store.lat,
        lng: store.lng,
        website_url: store.website_url,
        notes: store.notes,
      })
      .select('id, brand, name')
      .single();

    if (insertError) {
      console.error(`Error inserting ${store.name}:`, insertError);
      continue;
    }

    if (poi) {
      insertedPois.push(poi);

      // Wait a moment for the trigger to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the district mapping (created by trigger)
      const { data: districtMapping, error: mappingError } = await supabase
        .from('store_poi_district')
        .select('district, distance_km')
        .eq('poi_id', poi.id)
        .single();

      if (mappingError) {
        console.warn(`  Warning: Could not fetch district mapping: ${mappingError.message}`);
      } else if (districtMapping) {
        console.log(`  ✓ Nearest district: ${districtMapping.district} (${districtMapping.distance_km.toFixed(2)} km)`);
      }
    }
  }

  console.log(`\n=== Seed Summary ===`);
  console.log(`Stores inserted: ${insertedPois.length}`);
  console.log('\nInserted stores:');
  insertedPois.forEach((poi, idx) => {
    console.log(`  ${idx + 1}. ${poi.brand} - ${poi.name} (ID: ${poi.id})`);
  });

  // Verify all have district mappings
  const { data: mappings, error: mappingsError } = await supabase
    .from('store_poi_district')
    .select('poi_id, district, distance_km')
    .in('poi_id', insertedPois.map(p => p.id));

  if (mappingsError) {
    console.warn(`\nWarning: Could not verify district mappings: ${mappingsError.message}`);
  } else if (mappings) {
    console.log(`\nDistrict mappings: ${mappings.length}/${insertedPois.length}`);
    if (mappings.length < insertedPois.length) {
      console.warn('  ⚠ Some POIs are missing district mappings');
    }
  }

  console.log('\n✓ Seed complete!\n');
}

seedStorePois().catch(error => {
  console.error('Seed failed:', error);
  process.exit(1);
});
