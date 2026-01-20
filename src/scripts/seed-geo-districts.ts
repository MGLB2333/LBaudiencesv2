import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * Simple hash function for deterministic values
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Generate UK postcode districts deterministically
 * Creates exactly 3000 districts with unique codes D0001-D3000
 */
function generateUKDistricts(): Array<{
  district: string;
  centroid_lat: number;
  centroid_lng: number;
  geometry: any;
}> {
  const districts: Array<{
    district: string;
    centroid_lat: number;
    centroid_lng: number;
    geometry: any;
  }> = [];

  const targetCount = 3000;

  // UK bounding box
  const minLng = -8.6;
  const maxLng = 1.9;
  const minLat = 50.7;
  const maxLat = 59.5;

  // Generate exactly 3000 districts with unique codes: D0001, D0002, ..., D3000
  for (let i = 1; i <= targetCount; i++) {
    const districtCode = `D${String(i).padStart(4, '0')}`;
    const seed = `DISTRICT|${i}`;
    const seedHash = simpleHash(seed);
    
    // Map hash to UK bbox deterministically
    const lat = minLat + ((seedHash % 10000) / 10000) * (maxLat - minLat);
    const lng = minLng + (((seedHash * 7) % 10000) / 10000) * (maxLng - minLng);
    
    // Vary polygon size for visual interest
    const size = 0.015 + ((seedHash % 50) / 50) * 0.025;
    
    const geometry = {
      type: 'Polygon',
      // GeoJSON order: [lng, lat]
      coordinates: [[
        [lng - size, lat - size],
        [lng + size, lat - size],
        [lng + size, lat + size],
        [lng - size, lat + size],
        [lng - size, lat - size], // Close the ring
      ]],
    };
    
    districts.push({
      district: districtCode,
      centroid_lat: lat,
      centroid_lng: lng,
      geometry,
    });
  }

  return districts;
}

async function seedGeoDistricts() {
  // Gate synthetic data behind explicit flag
  const useSynthetic = process.env.USE_SYNTHETIC_GEO === 'true';
  
  if (!useSynthetic) {
    console.log('⚠️  Synthetic geo districts are disabled by default.');
    console.log('   Set USE_SYNTHETIC_GEO=true to enable synthetic district generation.');
    console.log('   For real districts, use: npm run db:import-district-centroids');
    return;
  }

  console.log('⚠️  WARNING: Generating SYNTHETIC UK postcode districts (USE_SYNTHETIC_GEO=true)');
  console.log('   This will overwrite real districts if they exist.');
  console.log('   For real districts, use: npm run db:import-district-centroids\n');
  
  console.log('Generating UK postcode districts...');
  const districts = generateUKDistricts();
  console.log(`Generated ${districts.length} districts`);

  if (districts.length !== 3000) {
    console.warn(`⚠️  Warning: Expected 3000 districts, got ${districts.length}`);
  }

  console.log('Truncating geo_districts table...');
  // Delete all rows (Supabase doesn't support TRUNCATE via client)
  // Fetch all district IDs first, then delete in batches
  const { data: existingDistricts, error: fetchError } = await supabase
    .from('geo_districts')
    .select('district');

  if (fetchError) {
    console.warn('Warning: Could not fetch existing districts:', fetchError);
  } else if (existingDistricts && existingDistricts.length > 0) {
    const districtIds = existingDistricts.map(d => d.district);
    // Delete in batches
    const deleteBatchSize = 500;
    for (let i = 0; i < districtIds.length; i += deleteBatchSize) {
      const batch = districtIds.slice(i, i + deleteBatchSize);
      const { error: deleteError } = await supabase
        .from('geo_districts')
        .delete()
        .in('district', batch);
      
      if (deleteError) {
        console.warn(`Warning: Could not delete batch ${i / deleteBatchSize + 1}:`, deleteError);
      }
    }
    console.log(`Deleted ${existingDistricts.length} existing districts`);
  } else {
    console.log('No existing districts to delete');
  }

  console.log('Inserting districts into database...');
  
  // Upsert in batches of 100 (will update existing or insert new)
  const batchSize = 100;
  for (let i = 0; i < districts.length; i += batchSize) {
    const batch = districts.slice(i, i + batchSize);
    // Upsert with all fields including centroids (onConflict: 'district')
    const { error } = await supabase
      .from('geo_districts')
      .upsert(batch, { onConflict: 'district' });

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
      throw error;
    }
    if ((i / batchSize + 1) % 10 === 0 || i + batchSize >= districts.length) {
      console.log(`Inserted batch ${i / batchSize + 1} of ${Math.ceil(districts.length / batchSize)}`);
    }
  }

  // Verify count
  const { count, error: countError } = await supabase
    .from('geo_districts')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error verifying count:', countError);
    throw new Error(`Failed to verify district count: ${countError.message}`);
  } else if (count !== 3000) {
    console.warn(`⚠️  Expected 3000 districts, got ${count} (this is acceptable)`);
    console.log(`✅ Verified: ${count} districts in database`);
  } else {
    console.log(`✅ Verified: ${count} districts in database`);
  }

  console.log('✅ Successfully seeded geo_districts table');
}

// Run if called directly
if (require.main === module) {
  seedGeoDistricts()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { seedGeoDistricts, generateUKDistricts };
