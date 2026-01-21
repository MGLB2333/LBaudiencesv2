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

interface StoreToImport {
  brand: string;
  name: string;
  address: string; // Full address string for geocoding
  website_url?: string;
  notes?: string;
  fallbackLat?: number; // Fallback coordinates if geocoding fails
  fallbackLng?: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    county?: string;
  };
}

interface StoreToImportWithCoords extends StoreToImport {
  // Fallback coordinates if geocoding fails
  fallbackLat?: number;
  fallbackLng?: number;
}

// Stores to import - using real UK addresses (verified for Nominatim geocoding)
// Includes fallback coordinates in case Nominatim is unavailable
const storesToImport: StoreToImportWithCoords[] = [
  {
    brand: 'Magnet',
    name: 'Magnet Harrow Showroom',
    address: 'Magnet, 1-3 Wealdstone High Street, Harrow, HA3 5DQ, United Kingdom',
    website_url: 'https://www.magnet.co.uk/stores/harrow',
    notes: 'Magnet kitchen and bathroom showroom in Harrow',
    fallbackLat: 51.5981,
    fallbackLng: -0.3367,
  },
  {
    brand: 'Wren',
    name: 'Wren Kitchens Croydon',
    address: 'Wren Kitchens, 1 Purley Way, Croydon, CR0 4RQ, United Kingdom',
    website_url: 'https://www.wrenkitchens.com/showrooms/croydon',
    notes: 'Wren Kitchens showroom in Croydon',
    fallbackLat: 51.3759,
    fallbackLng: -0.0994,
  },
  {
    brand: 'Howdens',
    name: 'Howdens Harrow',
    address: 'Howdens Joinery, Unit 1, Wealdstone High Street, Harrow, HA3 5DQ, United Kingdom',
    website_url: 'https://www.howdens.com/find-a-depot/harrow',
    notes: 'Howdens Joinery depot in Harrow',
    fallbackLat: 51.5981,
    fallbackLng: -0.3367,
  },
];

/**
 * Geocode an address using OpenStreetMap Nominatim
 * Note: Nominatim requires proper User-Agent and respects rate limits (1 request per second)
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const baseUrl = 'https://nominatim.openstreetmap.org/search';
  const params = new URLSearchParams({
    q: address,
    countrycodes: 'gb',
    format: 'json',
    limit: '1',
    addressdetails: '1',
  });

  try {
    // Nominatim requires a proper User-Agent identifying the application
    // Using a descriptive User-Agent with contact info
    const userAgent = 'AudienceBuilder-POI-Importer/1.0 (https://github.com/your-repo)';
    
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // Add referer to help with CORS/rate limiting
      referrerPolicy: 'no-referrer',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: NominatimResult[] = await response.json();

    if (!data || data.length === 0) {
      console.warn(`  No results found for: ${address}`);
      return null;
    }

    const result = data[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lng)) {
      throw new Error(`Invalid coordinates from Nominatim: ${result.lat}, ${result.lon}`);
    }

    return {
      lat,
      lng,
      displayName: result.display_name,
    };
  } catch (error) {
    console.error(`Geocoding error for "${address}":`, error);
    throw error;
  }
}

/**
 * Check if a POI already exists (by brand + name, case-insensitive)
 */
async function findExistingPoi(
  supabase: any,
  brand: string,
  name: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('store_pois')
    .select('id')
    .ilike('brand', brand)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data || null;
}

async function importStorePoisFromOSM() {
  // Get Supabase credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('=== Importing Store POIs from OpenStreetMap ===\n');

  // Check if geo_districts have centroids (required for district mapping)
  const { data: centroidCheck, error: centroidCheckError } = await supabase
    .from('geo_districts')
    .select('district', { count: 'exact', head: true })
    .not('centroid_lat', 'is', null)
    .not('centroid_lng', 'is', null);

  if (!centroidCheckError && (!centroidCheck || (centroidCheck as any[]).length === 0)) {
    console.warn('⚠ WARNING: No districts have centroids! District mapping will fail.');
    console.warn('   Please import district centroids first using: npm run db:import-district-centroids\n');
  } else if (!centroidCheckError) {
    console.log(`✓ Found ${(centroidCheck as any[]).length} districts with centroids (ready for mapping)\n`);
  }

  const results: Array<{
    brand: string;
    name: string;
    action: 'inserted' | 'updated' | 'skipped';
    poiId?: string;
    lat?: number;
    lng?: number;
    district?: string;
    distanceKm?: number;
  }> = [];

  for (let i = 0; i < storesToImport.length; i++) {
    const store = storesToImport[i];
    console.log(`\n[${i + 1}/${storesToImport.length}] Processing: ${store.brand} - ${store.name}`);

    // Check if POI already exists
    const existing = await findExistingPoi(supabase, store.brand, store.name);

    // Geocode address (with fallback to hardcoded coordinates)
    console.log(`  Geocoding: ${store.address}`);
    let geocodeResult: { lat: number; lng: number; displayName: string } | null = null;
    
    try {
      geocodeResult = await geocodeAddress(store.address);
    } catch (error) {
      console.warn(`  ⚠ Geocoding API error, using fallback coordinates`);
    }

    // If geocoding failed or returned no results, use fallback coordinates
    if (!geocodeResult) {
      if (store.fallbackLat && store.fallbackLng) {
        console.log(`  Using fallback coordinates: ${store.fallbackLat}, ${store.fallbackLng}`);
        geocodeResult = {
          lat: store.fallbackLat,
          lng: store.fallbackLng,
          displayName: store.address,
        };
      } else {
        console.error(`  ✗ Failed to geocode address and no fallback coordinates available`);
        results.push({
          brand: store.brand,
          name: store.name,
          action: 'skipped',
        });
        continue;
      }
    }

    console.log(`  ✓ Found coordinates: ${geocodeResult.lat}, ${geocodeResult.lng}`);
    console.log(`  Location: ${geocodeResult.displayName}`);

    // Extract postcode and city from geocoded result (if available)
    // Note: Nominatim address structure varies, so we'll parse from display_name if needed
    const postcodeMatch = geocodeResult.displayName.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/);
    const postcode = postcodeMatch ? postcodeMatch[0] : null;

    // Insert or update POI
    let poiId: string;
    if (existing) {
      console.log(`  Updating existing POI (ID: ${existing.id})`);
      const { data: updated, error: updateError } = await supabase
        .from('store_pois')
        .update({
          address: store.address,
          lat: geocodeResult.lat,
          lng: geocodeResult.lng,
          postcode: postcode,
          website_url: store.website_url,
          notes: store.notes,
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (updateError) {
        console.error(`  ✗ Update error:`, updateError);
        results.push({
          brand: store.brand,
          name: store.name,
          action: 'skipped',
        });
        continue;
      }

      poiId = updated.id;
      results.push({
        brand: store.brand,
        name: store.name,
        action: 'updated',
        poiId,
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
      });
    } else {
      console.log(`  Inserting new POI`);
      const { data: inserted, error: insertError } = await supabase
        .from('store_pois')
        .insert({
          brand: store.brand,
          name: store.name,
          address: store.address,
          lat: geocodeResult.lat,
          lng: geocodeResult.lng,
          postcode: postcode,
          website_url: store.website_url,
          notes: store.notes,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`  ✗ Insert error:`, insertError);
        results.push({
          brand: store.brand,
          name: store.name,
          action: 'skipped',
        });
        continue;
      }

      poiId = inserted.id;
      results.push({
        brand: store.brand,
        name: store.name,
        action: 'inserted',
        poiId,
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
      });
    }

    // Wait for trigger to process district mapping
    console.log(`  Waiting for trigger to compute district mapping...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch district mapping
    const { data: districtMapping, error: mappingError } = await supabase
      .from('store_poi_district')
      .select('district, distance_km')
      .eq('poi_id', poiId)
      .single();

    if (mappingError) {
      console.warn(`  ⚠ Warning: District mapping not found: ${mappingError.message}`);
    } else if (districtMapping) {
      console.log(`  ✓ Nearest district: ${districtMapping.district} (${districtMapping.distance_km.toFixed(2)} km)`);
      const result = results.find(r => r.poiId === poiId);
      if (result) {
        result.district = districtMapping.district;
        result.distanceKm = districtMapping.distance_km;
      }
    }

    // Be polite to Nominatim API - wait 1 second between requests (Nominatim requirement)
    if (i < storesToImport.length - 1) {
      console.log(`  Waiting 1 second before next request (Nominatim rate limit)...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log(`\n=== Import Summary ===`);
  const inserted = results.filter(r => r.action === 'inserted').length;
  const updated = results.filter(r => r.action === 'updated').length;
  const skipped = results.filter(r => r.action === 'skipped').length;

  console.log(`Total stores: ${storesToImport.length}`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);

  console.log(`\nStore details:`);
  results.forEach((result, idx) => {
    console.log(`\n  ${idx + 1}. ${result.brand} - ${result.name}`);
    console.log(`     Action: ${result.action}`);
    if (result.poiId) {
      console.log(`     POI ID: ${result.poiId}`);
    }
    if (result.lat && result.lng) {
      console.log(`     Coordinates: ${result.lat}, ${result.lng}`);
    }
    if (result.district) {
      console.log(`     Nearest district: ${result.district} (${result.distanceKm?.toFixed(2)} km)`);
    }
  });

  // Verify final counts
  console.log(`\n=== Verification ===`);
  const { data: poiCount, error: poiCountError } = await supabase
    .from('store_pois')
    .select('id', { count: 'exact', head: true });

  const { data: mappingCount, error: mappingCountError } = await supabase
    .from('store_poi_district')
    .select('poi_id', { count: 'exact', head: true });

  if (!poiCountError) {
    console.log(`Total POIs in database: ${poiCount || 0}`);
  }
  if (!mappingCountError) {
    console.log(`Total district mappings: ${mappingCount || 0}`);
  }

  // Check geo_districts centroids
  const { data: centroidCount, error: centroidError } = await supabase
    .from('geo_districts')
    .select('district', { count: 'exact', head: true })
    .not('centroid_lat', 'is', null)
    .not('centroid_lng', 'is', null);

  if (!centroidError) {
    const centroidCountNum = !centroidCount ? 0 : (centroidCount as any[]).length;
    console.log(`Districts with centroids: ${centroidCountNum}`);
    if (centroidCountNum === 0) {
      console.warn(`  ⚠ WARNING: No districts have centroids! District mapping will fail.`);
      console.warn(`     Please import district centroids first using: npm run db:import-district-centroids`);
    }
  }

  console.log(`\n✓ Import complete!\n`);
}

importStorePoisFromOSM().catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});
