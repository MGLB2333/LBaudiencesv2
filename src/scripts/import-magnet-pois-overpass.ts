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

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags: {
    name?: string;
    brand?: string;
    operator?: string;
    shop?: string;
    website?: string;
    'addr:housenumber'?: string;
    'addr:street'?: string;
    'addr:city'?: string;
    'addr:postcode'?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * Build address string from OSM tags
 */
function buildAddress(tags: OverpassElement['tags']): string | null {
  const parts: string[] = [];
  
  if (tags['addr:housenumber']) {
    parts.push(tags['addr:housenumber']);
  }
  if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  if (tags['addr:city']) {
    parts.push(tags['addr:city']);
  }
  if (tags['addr:postcode']) {
    parts.push(tags['addr:postcode']);
  }
  
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Check if an element is likely a Magnet store
 */
function isMagnetStore(element: OverpassElement): boolean {
  const { tags } = element;
  const nameLower = (tags.name || '').toLowerCase();
  const brandLower = (tags.brand || '').toLowerCase();
  const operatorLower = (tags.operator || '').toLowerCase();
  
  // Must have "magnet" in name, brand, or operator (case-insensitive, word boundary preferred)
  const hasMagnet = 
    /\bmagnet\b/i.test(nameLower) ||
    /\bmagnet\b/i.test(brandLower) ||
    /\bmagnet\b/i.test(operatorLower) ||
    brandLower === 'magnet' ||
    operatorLower === 'magnet';
  
  if (!hasMagnet) {
    return false;
  }
  
  // Additional confidence checks (at least one should be true for high confidence)
  const shopTags = ['furniture', 'kitchen', 'doityourself', 'home_improvement', 'interior_decoration'];
  const hasRelevantShop = tags.shop && shopTags.includes(tags.shop);
  const hasMagnetWebsite = tags.website && tags.website.toLowerCase().includes('magnet.co.uk');
  const hasBrandOrOperator = !!(tags.brand || tags.operator);
  
  // If it has magnet in name/brand/operator AND (relevant shop OR magnet website OR brand/operator tag), it's likely a Magnet store
  // If it has "Magnet" as exact brand/operator match, accept it even without shop tag
  const isExactMatch = brandLower === 'magnet' || operatorLower === 'magnet';
  
  return isExactMatch || hasRelevantShop || hasMagnetWebsite || hasBrandOrOperator;
}

/**
 * Query Overpass API for Magnet stores in UK
 */
async function queryOverpass(retries = 2): Promise<OverpassElement[]> {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  
  // Overpass query for Magnet stores in UK
  // Optimized: query by tag first, then filter by UK bounding box
  // UK bounding box: lat 49.5-60.9, lon -8.2 to 1.8
  const query = `
    [out:json][timeout:60];
    (
      nwr["brand"="Magnet"](49.5,-8.2,60.9,1.8);
      nwr["brand"="magnet"](49.5,-8.2,60.9,1.8);
      nwr["operator"="Magnet"](49.5,-8.2,60.9,1.8);
      nwr["operator"="magnet"](49.5,-8.2,60.9,1.8);
      nwr["name"~"\\bMagnet\\b",i](49.5,-8.2,60.9,1.8);
    );
    out center tags;
  `;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Querying Overpass API (attempt ${attempt + 1}/${retries + 1})...`);
      
      const response = await fetch(overpassUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      
      // Save raw response for debugging
      const debugPath = path.join(process.cwd(), 'tmp', 'magnet_overpass.json');
      const tmpDir = path.dirname(debugPath);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      fs.writeFileSync(debugPath, responseText);
      console.log(`  ✓ Saved raw response to: ${debugPath}`);
      
      // Parse JSON
      let data: OverpassResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('  ✗ Failed to parse JSON response');
        console.error('  Response preview:', responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Overpass API`);
      }
      
      // Check for Overpass errors or timeouts
      if (data.elements === undefined) {
        console.warn('  ⚠ Response structure unexpected, checking for errors...');
        if (responseText.includes('error') || responseText.includes('timeout')) {
          console.error('  Overpass error/timeout in response');
          const errorMatch = responseText.match(/"remark":\s*"([^"]+)"/);
          if (errorMatch) {
            console.error(`  Error: ${errorMatch[1]}`);
          }
        }
        return [];
      }
      
      // Check for timeout remark
      if ((data as any).remark && (data as any).remark.includes('timeout')) {
        console.error(`  ✗ Query timed out: ${(data as any).remark}`);
        throw new Error('Overpass query timed out - try a more specific query');
      }
      
      return data.elements || [];
    } catch (error) {
      if (attempt < retries) {
        const backoff = (attempt + 1) * 2000; // 2s, 4s, 6s
        console.warn(`  ⚠ Request failed, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        throw error;
      }
    }
  }
  
  return [];
}

async function importMagnetPoisFromOverpass() {
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

  console.log('=== Importing Magnet Stores from OpenStreetMap (Overpass API) ===\n');

  // Check if geo_districts have centroids (required for district mapping)
  const { data: centroidCheck, error: centroidCheckError } = await supabase
    .from('geo_districts')
    .select('district', { count: 'exact', head: true })
    .not('centroid_lat', 'is', null)
    .not('centroid_lng', 'is', null);

  if (!centroidCheckError && (centroidCheck || 0) === 0) {
    console.warn('⚠ WARNING: No districts have centroids! District mapping will fail.');
    console.warn('   Please import district centroids first using: npm run db:import-district-centroids\n');
  } else if (!centroidCheckError) {
    console.log(`✓ Found ${centroidCheck} districts with centroids (ready for mapping)\n`);
  }

  // Query Overpass
  let elements: OverpassElement[];
  try {
    elements = await queryOverpass();
    console.log(`\n✓ Fetched ${elements.length} elements from Overpass\n`);
  } catch (error) {
    console.error('Failed to query Overpass API:', error);
    process.exit(1);
  }

  // Filter to Magnet stores
  const magnetStores = elements.filter(isMagnetStore);
  console.log(`Filtered to ${magnetStores.length} likely Magnet stores\n`);

  const stats = {
    total: magnetStores.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    noCoords: 0,
    mapped: 0,
  };

  // Process each store
  for (let i = 0; i < magnetStores.length; i++) {
    const element = magnetStores[i];
    const progress = `[${i + 1}/${magnetStores.length}]`;
    
    // Get coordinates
    let lat: number | undefined;
    let lng: number | undefined;
    
    if (element.type === 'node') {
      lat = element.lat;
      lng = element.lon;
    } else if (element.center) {
      lat = element.center.lat;
      lng = element.center.lon;
    }

    if (!lat || !lng) {
      console.log(`${progress} Skipping ${element.type}/${element.id}: no coordinates`);
      stats.skipped++;
      stats.noCoords++;
      continue;
    }

    // Build POI data
    const name = element.tags.name || 'Magnet';
    const address = buildAddress(element.tags);
    const postcode = element.tags['addr:postcode'] || null;
    const city = element.tags['addr:city'] || null;
    const website = element.tags.website || null;
    
    // Build notes with OSM metadata
    const notes = `OSM ${element.type} ${element.id}. Tags: ${JSON.stringify({
      shop: element.tags.shop,
      brand: element.tags.brand,
      operator: element.tags.operator,
    })}`;

    console.log(`${progress} Processing: ${name} (${element.type}/${element.id})`);
    console.log(`  Location: ${lat}, ${lng}`);
    if (address) console.log(`  Address: ${address}`);

    // Check if POI already exists (by OSM source + type + id)
    const { data: existing, error: checkError } = await supabase
      .from('store_pois')
      .select('id')
      .eq('source', 'osm')
      .eq('osm_type', element.type)
      .eq('osm_id', element.id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`  ✗ Error checking existing: ${checkError.message}`);
      stats.skipped++;
      continue;
    }

    const poiData = {
      brand: 'Magnet',
      name,
      address,
      city,
      postcode,
      lat,
      lng,
      website_url: website,
      notes,
      source: 'osm',
      osm_type: element.type,
      osm_id: element.id,
    };

    if (existing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from('store_pois')
        .update(poiData)
        .eq('id', existing.id)
        .select('id')
        .single();

      if (updateError) {
        console.error(`  ✗ Update error: ${updateError.message}`);
        stats.skipped++;
        continue;
      }

      console.log(`  ✓ Updated existing POI (ID: ${updated.id})`);
      stats.updated++;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from('store_pois')
        .insert(poiData)
        .select('id')
        .single();

      if (insertError) {
        console.error(`  ✗ Insert error: ${insertError.message}`);
        stats.skipped++;
        continue;
      }

      console.log(`  ✓ Inserted new POI (ID: ${inserted.id})`);
      stats.inserted++;
    }

    // Wait a moment for trigger to process
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Wait a bit longer for all triggers to complete
  console.log(`\nWaiting for district mapping triggers to complete...`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check mapping count for Magnet stores
  const { data: magnetPois, error: magnetPoisError } = await supabase
    .from('store_pois')
    .select('id')
    .eq('brand', 'Magnet')
    .eq('source', 'osm');

  if (!magnetPoisError && magnetPois && magnetPois.length > 0) {
    const poiIds = magnetPois.map(p => p.id);
    const { data: mappingCount, error: mappingError } = await supabase
      .from('store_poi_district')
      .select('poi_id', { count: 'exact', head: true })
      .in('poi_id', poiIds);

    if (!mappingError && mappingCount !== null) {
      stats.mapped = mappingCount;
    }
  }

  // Summary
  console.log(`\n=== Import Summary ===`);
  console.log(`Total Magnet stores found: ${stats.total}`);
  console.log(`  Inserted: ${stats.inserted}`);
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Skipped: ${stats.skipped} (${stats.noCoords} had no coordinates)`);
  console.log(`  District mappings: ${stats.mapped}`);

  // Final verification
  const { data: finalCount, error: finalError } = await supabase
    .from('store_pois')
    .select('id', { count: 'exact', head: true })
    .eq('brand', 'Magnet');

  if (!finalError) {
    console.log(`\nTotal Magnet POIs in database: ${finalCount || 0}`);
    
    // Also check OSM-sourced ones
    const { data: osmCount, error: osmError } = await supabase
      .from('store_pois')
      .select('id', { count: 'exact', head: true })
      .eq('brand', 'Magnet')
      .eq('source', 'osm');
    
    if (!osmError && osmCount !== null) {
      console.log(`  (${osmCount} from OSM, ${(finalCount || 0) - osmCount} from other sources)`);
    }
  }

  console.log(`\n✓ Import complete!\n`);
}

importMagnetPoisFromOverpass().catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});
