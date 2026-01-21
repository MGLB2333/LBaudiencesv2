import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
 * Normalize district code (trim, upper, remove spaces)
 */
function normalizeDistrict(district: string): string {
  return district.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Generate deterministic centroid from district code using MD5 hash
 * UK bbox: minLng=-8.6, maxLng=1.9, minLat=50.7, maxLat=59.5
 */
function generateCentroid(district: string): { lat: number; lng: number } {
  const hashLat = crypto.createHash('md5').update(district + ':lat').digest('hex');
  const hashLng = crypto.createHash('md5').update(district + ':lng').digest('hex');
  
  // Convert first 8 hex chars to int, divide by 2^32 to get [0,1)
  const uLat = parseInt(hashLat.substring(0, 8), 16) / 4294967296.0;
  const uLng = parseInt(hashLng.substring(0, 8), 16) / 4294967296.0;
  
  const minLat = 50.7;
  const maxLat = 59.5;
  const minLng = -8.6;
  const maxLng = 1.9;
  
  return {
    lat: minLat + uLat * (maxLat - minLat),
    lng: minLng + uLng * (maxLng - minLng),
  };
}

/**
 * Sync geo_districts from geo_district_signals
 */
async function syncGeoDistrictsFromSignals() {
  console.log('\n=== Syncing geo_districts from geo_district_signals ===\n');
  
  // Fetch all distinct districts from geo_district_signals
  const { data: districtSignals, error: fetchError } = await supabase
    .from('geo_district_signals')
    .select('district')
    .not('district', 'is', null)
    .neq('district', '');

  if (fetchError) {
    throw new Error(`Failed to fetch districts from geo_district_signals: ${fetchError.message}`);
  }

  if (!districtSignals || districtSignals.length === 0) {
    console.log('No districts found in geo_district_signals');
    return;
  }

  // Get unique normalized districts
  const uniqueDistricts = Array.from(
    new Set(districtSignals.map(s => normalizeDistrict(s.district)))
  ).filter(d => d.length > 0);

  console.log(`Found ${uniqueDistricts.length} unique districts in geo_district_signals`);

  // Generate districts with centroids
  const districtsToUpsert = uniqueDistricts.map(district => {
    const centroid = generateCentroid(district);
    return {
      district,
      centroid_lat: centroid.lat,
      centroid_lng: centroid.lng,
      geometry: null,
      created_at: new Date().toISOString(),
    };
  });

  // Upsert in batches
  const batchSize = 500;
  let upserted = 0;

  for (let i = 0; i < districtsToUpsert.length; i += batchSize) {
    const batch = districtsToUpsert.slice(i, i + batchSize);
    const { error } = await supabase
      .from('geo_districts')
      .upsert(batch, { onConflict: 'district' });

    if (error) {
      console.error(`Error upserting batch ${i / batchSize + 1}:`, error);
      throw error;
    }

    upserted += batch.length;
    if ((i / batchSize + 1) % 10 === 0 || i + batchSize >= districtsToUpsert.length) {
      console.log(`Upserted ${upserted} of ${districtsToUpsert.length} districts`);
    }
  }

  // Verify count
  const { count, error: countError } = await supabase
    .from('geo_districts')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error verifying count:', countError);
  } else {
    console.log(`\n✅ Successfully synced ${count} districts in geo_districts`);
    console.log(`   Expected: ${uniqueDistricts.length} unique districts`);
  }

  // Check for missing joins
  let missingJoins: any = null;
  let joinError: any = null;
  try {
    const result = await supabase
      .rpc('check_missing_joins', { segment_key: 'home_movers' } as any);
    missingJoins = result.data;
    joinError = result.error;
  } catch (e) {
    // If RPC doesn't exist, do manual check
    const { data: signalData } = await supabase
      .from('geo_district_signals')
      .select('district')
      .eq('segment_key', 'home_movers');
    
    if (!signalData) {
      missingJoins = [];
      joinError = null;
    } else {
      const unique = Array.from(new Set((signalData as any[]).map((s: any) => normalizeDistrict(s.district))));
      const { data: geoData } = await supabase
        .from('geo_districts')
        .select('district')
        .in('district', unique);
      
      const foundSet = new Set(((geoData as any[]) || []).map((d: any) => d.district));
      const missing = unique.filter(d => !foundSet.has(d));
      missingJoins = missing;
      joinError = null;
    }
  }

  if (!joinError && missingJoins && Array.isArray(missingJoins) && missingJoins.length > 0) {
    console.warn(`⚠️  ${missingJoins.length} districts in signals not found in geo_districts`);
  } else if (!joinError) {
    console.log('✅ All districts from signals have matching entries in geo_districts');
  }
}

// Run if called directly
if (require.main === module) {
  syncGeoDistrictsFromSignals()
    .then(() => {
      console.log('\nDone');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nError:', error);
      process.exit(1);
    });
}

export { syncGeoDistrictsFromSignals };
