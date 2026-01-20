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

interface BrandConfig {
  canonicalBrand: string;
  searchTerms: string[];
  filterFn: (element: OverpassElement) => boolean;
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
 * Brand-specific filter functions
 */
const brandConfigs: BrandConfig[] = [
  {
    canonicalBrand: 'Howdens',
    searchTerms: ['Howdens', 'Howdens Joinery'],
    filterFn: (element) => {
      const { tags } = element;
      const nameLower = (tags.name || '').toLowerCase();
      const brandLower = (tags.brand || '').toLowerCase();
      const operatorLower = (tags.operator || '').toLowerCase();
      
      // Match "Howdens" or "Howdens Joinery"
      const hasHowdens = 
        /\bhowdens\b/i.test(nameLower) ||
        brandLower.includes('howdens') ||
        operatorLower.includes('howdens');
      
      if (!hasHowdens) return false;
      
      // Additional confidence: shop tag, website, or brand/operator present
      const shopTags = ['furniture', 'kitchen', 'doityourself', 'home_improvement'];
      const hasRelevantShop = tags.shop && shopTags.includes(tags.shop);
      const hasHowdensWebsite = tags.website && tags.website.toLowerCase().includes('howdens');
      const hasBrandOrOperator = !!(tags.brand || tags.operator);
      
      return hasRelevantShop || hasHowdensWebsite || hasBrandOrOperator;
    },
  },
  {
    canonicalBrand: 'Wren',
    searchTerms: ['Wren Kitchens', 'Wren'],
    filterFn: (element) => {
      const { tags } = element;
      const nameLower = (tags.name || '').toLowerCase();
      const brandLower = (tags.brand || '').toLowerCase();
      const operatorLower = (tags.operator || '').toLowerCase();
      
      // Prefer "Wren Kitchens" but also accept "Wren" if it's clearly a kitchen store
      const hasWren = 
        /\bwren\b/i.test(nameLower) ||
        brandLower.includes('wren') ||
        operatorLower.includes('wren');
      
      if (!hasWren) return false;
      
      // Prefer "Wren Kitchens" exact match or kitchen-related tags
      const isWrenKitchens = 
        nameLower.includes('wren kitchens') ||
        nameLower.includes('wren kitchen') ||
        brandLower === 'wren kitchens' ||
        operatorLower === 'wren kitchens';
      
      const shopTags = ['furniture', 'kitchen', 'doityourself', 'home_improvement'];
      const hasRelevantShop = tags.shop && shopTags.includes(tags.shop);
      const hasWrenWebsite = tags.website && tags.website.toLowerCase().includes('wrenkitchens');
      const hasBrandOrOperator = !!(tags.brand || tags.operator);
      
      // Accept if it's "Wren Kitchens" or has kitchen shop tag or Wren website
      return isWrenKitchens || (hasRelevantShop && hasWren) || hasWrenWebsite || hasBrandOrOperator;
    },
  },
  {
    canonicalBrand: 'Wickes',
    searchTerms: ['Wickes'],
    filterFn: (element) => {
      const { tags } = element;
      const nameLower = (tags.name || '').toLowerCase();
      const brandLower = (tags.brand || '').toLowerCase();
      const operatorLower = (tags.operator || '').toLowerCase();
      
      // Must have "Wickes" in name, brand, or operator
      const hasWickes = 
        /\bwickes\b/i.test(nameLower) ||
        brandLower.includes('wickes') ||
        operatorLower.includes('wickes');
      
      if (!hasWickes) return false;
      
      // Additional confidence checks
      const shopTags = ['furniture', 'kitchen', 'doityourself', 'home_improvement', 'hardware'];
      const hasRelevantShop = tags.shop && shopTags.includes(tags.shop);
      const hasWickesWebsite = tags.website && tags.website.toLowerCase().includes('wickes');
      const hasBrandOrOperator = !!(tags.brand || tags.operator);
      
      return hasRelevantShop || hasWickesWebsite || hasBrandOrOperator;
    },
  },
];

/**
 * Query Overpass API for a specific brand
 */
async function queryOverpassForBrand(brandConfig: BrandConfig, retries = 2): Promise<OverpassElement[]> {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  
  // Optimized query: prioritize exact brand/operator tag matches (much faster)
  // Avoid expensive regex queries on name field - only use exact tag matches
  const canonicalLower = brandConfig.canonicalBrand.toLowerCase();
  
  // Build exact tag queries (fastest - uses indexes)
  const exactTagQueries: string[] = [
    `nwr["brand"="${brandConfig.canonicalBrand}"](49.5,-8.2,60.9,1.8)`,
    `nwr["operator"="${brandConfig.canonicalBrand}"](49.5,-8.2,60.9,1.8)`,
  ];
  
  // Add case variations
  if (canonicalLower !== brandConfig.canonicalBrand) {
    exactTagQueries.push(
      `nwr["brand"="${canonicalLower}"](49.5,-8.2,60.9,1.8)`,
      `nwr["operator"="${canonicalLower}"](49.5,-8.2,60.9,1.8)`
    );
  }
  
  // Brand-specific exact matches
  if (brandConfig.canonicalBrand === 'Howdens') {
    exactTagQueries.push(
      `nwr["brand"="Howdens Joinery"](49.5,-8.2,60.9,1.8)`,
      `nwr["operator"="Howdens Joinery"](49.5,-8.2,60.9,1.8)`,
      `nwr["brand"="howdens joinery"](49.5,-8.2,60.9,1.8)`,
      `nwr["operator"="howdens joinery"](49.5,-8.2,60.9,1.8)`
    );
  }
  
  if (brandConfig.canonicalBrand === 'Wren') {
    exactTagQueries.push(
      `nwr["brand"="Wren Kitchens"](49.5,-8.2,60.9,1.8)`,
      `nwr["operator"="Wren Kitchens"](49.5,-8.2,60.9,1.8)`,
      `nwr["brand"="wren kitchens"](49.5,-8.2,60.9,1.8)`,
      `nwr["operator"="wren kitchens"](49.5,-8.2,60.9,1.8)`
    );
  }
  
  // Use exact tag matches only - no regex on name (too slow)
  // The filter function will handle name matching in post-processing
  const query = `
    [out:json][timeout:90];
    (
      ${exactTagQueries.join(';\n      ')};
    );
    out center tags;
  `;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Querying Overpass API for ${brandConfig.canonicalBrand} (attempt ${attempt + 1}/${retries + 1})...`);
      
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
      const debugPath = path.join(process.cwd(), 'tmp', `${brandConfig.canonicalBrand.toLowerCase()}_overpass.json`);
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

async function importCompetitorPoisFromOverpass() {
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

  console.log('=== Importing Competitor Stores from OpenStreetMap (Overpass API) ===\n');
  console.log('Brands: Howdens, Wren Kitchens, Wickes\n');

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

  const allBrandStats: Record<string, {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    noCoords: number;
    mapped: number;
  }> = {};

  // Process each brand
  for (const brandConfig of brandConfigs) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${brandConfig.canonicalBrand}`);
    console.log('='.repeat(60));

    const stats = {
      total: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      noCoords: 0,
      mapped: 0,
    };

    // Query Overpass
    let elements: OverpassElement[];
    try {
      elements = await queryOverpassForBrand(brandConfig);
      console.log(`\n✓ Fetched ${elements.length} elements from Overpass\n`);
    } catch (error) {
      console.error(`Failed to query Overpass API for ${brandConfig.canonicalBrand}:`, error);
      allBrandStats[brandConfig.canonicalBrand] = stats;
      // Wait before next brand
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }

    // Filter to brand stores
    const brandStores = elements.filter(brandConfig.filterFn);
    console.log(`Filtered to ${brandStores.length} likely ${brandConfig.canonicalBrand} stores\n`);
    stats.total = brandStores.length;

    // Process each store
    for (let i = 0; i < brandStores.length; i++) {
      const element = brandStores[i];
      const progress = `[${i + 1}/${brandStores.length}]`;
      
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
      const rawName = element.tags.name || brandConfig.canonicalBrand;
      const name = rawName; // Use OSM name as-is
      const address = buildAddress(element.tags);
      const postcode = element.tags['addr:postcode'] || null;
      const city = element.tags['addr:city'] || null;
      const website = element.tags.website || null;
      
      // Store full tags as JSONB
      const tagsJson = element.tags as any;

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
        brand: brandConfig.canonicalBrand,
        name,
        address,
        city,
        postcode,
        lat,
        lng,
        website_url: website,
        notes: `OSM ${element.type} ${element.id}`,
        source: 'osm',
        osm_type: element.type,
        osm_id: element.id,
        raw_name: rawName,
        tags: tagsJson,
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
          console.error(`  Error details:`, JSON.stringify(insertError, null, 2));
          stats.skipped++;
          continue;
        }

        if (!inserted || !inserted.id) {
          console.error(`  ✗ Insert succeeded but no ID returned`);
          stats.skipped++;
          continue;
        }

        console.log(`  ✓ Inserted new POI (ID: ${inserted.id})`);
        stats.inserted++;
      }

      // Wait a moment for trigger to process
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Wait a bit longer for all triggers to complete
    console.log(`\nWaiting for district mapping triggers to complete...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check mapping count for this brand
    const { data: brandPois, error: brandPoisError } = await supabase
      .from('store_pois')
      .select('id')
      .eq('brand', brandConfig.canonicalBrand)
      .eq('source', 'osm');

    if (!brandPoisError && brandPois && brandPois.length > 0) {
      const poiIds = brandPois.map(p => p.id);
      const { data: mappingCount, error: mappingError } = await supabase
        .from('store_poi_district')
        .select('poi_id', { count: 'exact', head: true })
        .in('poi_id', poiIds);

      if (!mappingError && mappingCount !== null) {
        stats.mapped = mappingCount;
      }
    }

    // Summary for this brand
    console.log(`\n=== ${brandConfig.canonicalBrand} Summary ===`);
    console.log(`Total stores found: ${stats.total}`);
    console.log(`  Inserted: ${stats.inserted}`);
    console.log(`  Updated: ${stats.updated}`);
    console.log(`  Skipped: ${stats.skipped} (${stats.noCoords} had no coordinates)`);
    console.log(`  District mappings: ${stats.mapped}`);

    allBrandStats[brandConfig.canonicalBrand] = stats;

    // Wait between brands to be polite to Overpass
    if (brandConfig !== brandConfigs[brandConfigs.length - 1]) {
      console.log(`\nWaiting 3 seconds before next brand...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Overall summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('=== Overall Import Summary ===');
  console.log('='.repeat(60));
  
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalMapped = 0;

  for (const [brand, stats] of Object.entries(allBrandStats)) {
    console.log(`\n${brand}:`);
    console.log(`  Inserted: ${stats.inserted}`);
    console.log(`  Updated: ${stats.updated}`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Mapped: ${stats.mapped}`);
    totalInserted += stats.inserted;
    totalUpdated += stats.updated;
    totalSkipped += stats.skipped;
    totalMapped += stats.mapped;
  }

  console.log(`\nTotals:`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Mapped: ${totalMapped}`);

  // Final verification - use a more reliable query
  console.log(`\n=== Final Verification ===`);
  for (const brandConfig of brandConfigs) {
    // Query all matching POIs and count them
    const { data: finalPois, error: finalError } = await supabase
      .from('store_pois')
      .select('id, brand, source')
      .eq('brand', brandConfig.canonicalBrand)
      .eq('source', 'osm');

    if (finalError) {
      console.error(`${brandConfig.canonicalBrand}: Error verifying - ${finalError.message}`);
    } else {
      const count = finalPois?.length || 0;
      const reportedInserted = allBrandStats[brandConfig.canonicalBrand]?.inserted || 0;
      console.log(`${brandConfig.canonicalBrand}: ${count} POIs in database`);
      if (count === 0 && reportedInserted > 0) {
        console.warn(`  ⚠ WARNING: Script reported ${reportedInserted} inserts but verification found 0!`);
        console.warn(`  This may indicate an RLS policy issue or transaction rollback.`);
      }
    }
  }
  
  // Also check total OSM POIs
  const { data: allOsmPois, error: allOsmError } = await supabase
    .from('store_pois')
    .select('id, brand, source')
    .eq('source', 'osm');
  
  if (allOsmError) {
    console.error(`Error checking total OSM POIs: ${allOsmError.message}`);
  } else {
    const totalCount = allOsmPois?.length || 0;
    console.log(`\nTotal OSM-sourced POIs: ${totalCount}`);
    
    // Show breakdown by brand
    const brandBreakdown: Record<string, number> = {};
    allOsmPois?.forEach(poi => {
      brandBreakdown[poi.brand] = (brandBreakdown[poi.brand] || 0) + 1;
    });
    console.log('Breakdown by brand:');
    Object.entries(brandBreakdown).forEach(([brand, count]) => {
      console.log(`  ${brand}: ${count}`);
    });
  }

  console.log(`\n✓ Import complete!\n`);
}

importCompetitorPoisFromOverpass().catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});
