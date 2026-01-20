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

/**
 * Normalize district code: trim, uppercase, remove spaces
 * Must match validationResults.ts normalizeDistrict function exactly
 */
function normalizeDistrict(district: string): string {
  return district
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Generate deterministic centroid from district code using MD5 hash
 * UK bbox: minLng=-8.6, maxLng=1.9, minLat=50.7, maxLat=59.5
 */
function generateCentroid(district: string): { lat: number; lng: number } {
  // Simple hash function
  let hashLat = 0;
  let hashLng = 0;
  const seedLat = district + ':lat';
  const seedLng = district + ':lng';
  
  for (let i = 0; i < seedLat.length; i++) {
    hashLat = ((hashLat << 5) - hashLat) + seedLat.charCodeAt(i);
    hashLat = hashLat & hashLat;
  }
  
  for (let i = 0; i < seedLng.length; i++) {
    hashLng = ((hashLng << 5) - hashLng) + seedLng.charCodeAt(i);
    hashLng = hashLng & hashLng;
  }
  
  const uLat = Math.abs(hashLat) % 10000 / 10000.0;
  const uLng = Math.abs(hashLng) % 10000 / 10000.0;
  
  const minLat = 50.7;
  const maxLat = 59.5;
  const minLng = -8.6;
  const maxLng = 1.9;
  
  return {
    lat: minLat + uLat * (maxLat - minLat),
    lng: minLng + uLng * (maxLng - minLng),
  };
}

async function syncMissingDistricts() {
  console.log('\n=== Syncing Missing Districts from Signals ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Get all distinct districts from signals (for home_movers segment to match validationResults)
  console.log('Fetching districts from geo_district_signals for segment_key=home_movers...');
  const { data: signalDistricts, error: signalError } = await supabase
    .from('geo_district_signals')
    .select('district')
    .eq('segment_key', 'home_movers')
    .not('district', 'is', null);

  if (signalError) {
    throw new Error(`Failed to fetch signal districts: ${signalError.message}`);
  }

  const uniqueSignalDistricts = new Set<string>();
  for (const row of signalDistricts || []) {
    const normalized = normalizeDistrict(row.district);
    if (normalized) {
      uniqueSignalDistricts.add(normalized);
    }
  }

  console.log(`Found ${uniqueSignalDistricts.size} unique districts in signals`);

  // Get existing districts from geo_districts (normalize for comparison)
  console.log('Fetching existing districts from geo_districts...');
  const { data: existingDistricts, error: existingError } = await supabase
    .from('geo_districts')
    .select('district');

  if (existingError) {
    throw new Error(`Failed to fetch existing districts: ${existingError.message}`);
  }

  const existingDistrictSet = new Set<string>();
  for (const row of existingDistricts || []) {
    existingDistrictSet.add(normalizeDistrict(row.district));
  }

  console.log(`Found ${existingDistrictSet.size} existing districts in geo_districts`);

  // Find missing districts
  const missingDistricts: string[] = [];
  for (const district of uniqueSignalDistricts) {
    if (!existingDistrictSet.has(district)) {
      missingDistricts.push(district);
    }
  }

  console.log(`\nFound ${missingDistricts.length} missing districts`);

  if (missingDistricts.length === 0) {
    console.log('✅ All districts already have centroids!');
    console.log('\nNote: If UI still shows missing districts, check:');
    console.log('  1. Browser console for sample missing district codes');
    console.log('  2. Run check_missing_districts.sql in Supabase SQL Editor');
    console.log('  3. Verify normalization matches between sync script and validationResults');
    return;
  }

  // Show sample missing districts
  console.log(`\nSample missing districts (first 20):`);
  missingDistricts.slice(0, 20).forEach((d, i) => {
    console.log(`  ${i + 1}. ${d}`);
  });

  // Generate centroids for missing districts
  console.log('\nGenerating centroids for missing districts...');
  const districtsToInsert = missingDistricts.map(district => {
    const centroid = generateCentroid(district);
    return {
      district,
      centroid_lat: centroid.lat,
      centroid_lng: centroid.lng,
      source: 'sync_from_signals',
    };
  });

  // Upsert in batches
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < districtsToInsert.length; i += batchSize) {
    const batch = districtsToInsert.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('geo_districts')
      .upsert(batch, {
        onConflict: 'district',
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Failed to upsert batch ${i / batchSize + 1}: ${error.message}`);
    }

    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${districtsToInsert.length}...`);
  }

  console.log(`\n✅ Successfully synced ${inserted} missing districts!`);
  console.log(`   Source: sync_from_signals (deterministic fallback centroids)`);
  console.log(`   These districts are in signals but weren't in district_latLong.csv`);
  
  // Verify
  const { count, error: countError } = await supabase
    .from('geo_districts')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.warn(`Warning: Could not verify count: ${countError.message}`);
  } else {
    console.log(`\nTotal districts in geo_districts: ${count}`);
  }

  console.log('\n=== Sync Complete ===\n');
}

// Run sync
syncMissingDistricts()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  });
