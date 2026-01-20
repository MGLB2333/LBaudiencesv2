import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

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
 * Normalize district code: trim, uppercase, remove spaces, keep alphanumeric only
 */
function normalizeDistrict(district: string): string {
  return district
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Validate coordinates are within UK bounds
 */
function isValidUKCoordinate(lat: number, lng: number): boolean {
  return (
    lat >= 49 && lat <= 61 &&
    lng >= -9 && lng <= 3
  );
}

interface DistrictRow {
  'Postcode District': string;
  'Latitude': string;
  'Longitude': string;
}

async function importRealDistrictCentroids() {
  console.log('\n=== Importing Real UK Postcode District Centroids ===\n');

  // Get Supabase credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing required environment variables:\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL\n' +
      '  - SUPABASE_SERVICE_ROLE_KEY\n' +
      '\nPlease set these in your .env.local file.'
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Find CSV file (try project root first, then /mnt/data)
  const csvPath = fs.existsSync(path.join(process.cwd(), 'district_latLong.csv'))
    ? path.join(process.cwd(), 'district_latLong.csv')
    : path.join(process.cwd(), 'district_latLong.csv'); // Fallback to same location
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `CSV file not found at: ${csvPath}\n` +
      'Please ensure district_latLong.csv is in the project root directory.'
    );
  }

  console.log(`Reading CSV from: ${csvPath}`);

  // Read and parse CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const parseResult = Papa.parse<DistrictRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => {
      // Normalize header names (case-insensitive)
      const normalized = header.trim().toLowerCase();
      if (normalized.includes('postcode') && normalized.includes('district')) {
        return 'Postcode District';
      }
      if (normalized === 'latitude' || normalized === 'lat') {
        return 'Latitude';
      }
      if (normalized === 'longitude' || normalized === 'lng' || normalized === 'lon') {
        return 'Longitude';
      }
      return header;
    },
  });

  if (parseResult.errors.length > 0) {
    console.warn('CSV parsing warnings:', parseResult.errors);
  }

  const rows = parseResult.data;
  console.log(`Read ${rows.length} rows from CSV`);

  // Process and validate rows
  const districts = new Map<string, { lat: number; lng: number }>();
  let skipped = 0;
  let duplicates = 0;

  for (const row of rows) {
    const rawDistrict = row['Postcode District'];
    if (!rawDistrict) {
      skipped++;
      continue;
    }

    const district = normalizeDistrict(rawDistrict);
    if (!district) {
      skipped++;
      continue;
    }

    // Parse coordinates
    const lat = parseFloat(row['Latitude']);
    const lng = parseFloat(row['Longitude']);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn(`Skipping row with invalid coordinates: ${rawDistrict}`);
      skipped++;
      continue;
    }

    // Validate UK bounds
    if (!isValidUKCoordinate(lat, lng)) {
      console.warn(
        `Skipping row with coordinates outside UK bounds: ${rawDistrict} (${lat}, ${lng})`
      );
      skipped++;
      continue;
    }

    // Check for duplicates (normalized)
    if (districts.has(district)) {
      duplicates++;
      // Keep first occurrence
      continue;
    }

    districts.set(district, { lat, lng });
  }

  console.log(`\nProcessed districts:`);
  console.log(`  Valid: ${districts.size}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Duplicates: ${duplicates}`);

  if (districts.size === 0) {
    throw new Error('No valid districts found in CSV');
  }

  // Calculate bounds
  const lats = Array.from(districts.values()).map(d => d.lat);
  const lngs = Array.from(districts.values()).map(d => d.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  console.log(`\nBounds:`);
  console.log(`  Lat: ${minLat.toFixed(4)} to ${maxLat.toFixed(4)}`);
  console.log(`  Lng: ${minLng.toFixed(4)} to ${maxLng.toFixed(4)}`);

  // Upsert into Supabase
  console.log(`\nUpserting ${districts.size} districts into geo_districts...`);

  const districtsArray = Array.from(districts.entries()).map(([district, coords]) => ({
    district,
    centroid_lat: coords.lat,
    centroid_lng: coords.lng,
    source: 'district_latLong.csv',
  }));

  // Upsert in batches of 500
  const batchSize = 500;
  let upserted = 0;

  for (let i = 0; i < districtsArray.length; i += batchSize) {
    const batch = districtsArray.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('geo_districts')
      .upsert(batch, {
        onConflict: 'district',
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Failed to upsert batch ${i / batchSize + 1}: ${error.message}`);
    }

    upserted += batch.length;
    console.log(`  Upserted ${upserted}/${districtsArray.length}...`);
  }

  console.log(`\n✅ Successfully imported ${upserted} districts!`);

  // Verify count
  const { count, error: countError } = await supabase
    .from('geo_districts')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.warn(`Warning: Could not verify count: ${countError.message}`);
  } else {
    console.log(`\nTotal districts in geo_districts: ${count}`);
  }

  console.log('\n=== Import Complete ===\n');
}

// Run import
importRealDistrictCentroids()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
