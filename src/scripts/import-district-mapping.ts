import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
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

interface DistrictMappingRow {
  district_code: string;
  area_code: string;
  district_households: string;
  area_name: string;
  area_households: string;
  'Nearby regions': string;
  tv_region: string;
  metro_code: string;
  tv_region_households: string;
  town_area: string;
}

interface ImportStats {
  rowsProcessed: number;
  tvRegionsUpserted: number;
  districtMappingsUpserted: number;
  neighborRelationshipsUpserted: number;
  missingDistricts: number;
  selfLinksFiltered: number;
  symmetricEdges: number;
  totalEdges: number;
}

function normalizeDistrict(district: string): string {
  if (!district) return '';
  return district.trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeRegionName(region: string): string {
  if (!region) return '';
  return region.trim();
}

function generateRegionKey(region: string): string {
  if (!region) return '';
  return region
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseDistance(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

async function importDistrictMapping(options: { dryRun?: boolean; limit?: number } = {}) {
  const { dryRun = false, limit } = options;

  // Get Supabase credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find CSV file
  const csvPath = path.join(process.cwd(), 'district_mapping.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log('Reading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const parseResult = Papa.parse<DistrictMappingRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  let rows = parseResult.data;
  const originalRowCount = rows.length;

  // Apply limit if specified
  if (limit && limit > 0) {
    rows = rows.slice(0, limit);
    console.log(`⚠ Limited to first ${limit} rows (of ${originalRowCount} total)\n`);
  }

  console.log(`Loaded ${rows.length} rows from CSV`);
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made to the database\n');
  }

  const stats: ImportStats = {
    rowsProcessed: rows.length,
    tvRegionsUpserted: 0,
    districtMappingsUpserted: 0,
    neighborRelationshipsUpserted: 0,
    missingDistricts: 0,
    selfLinksFiltered: 0,
    symmetricEdges: 0,
    totalEdges: 0,
  };

  // Step 1: Collect unique TV regions
  const tvRegionsMap = new Map<string, { name: string; key: string }>();
  rows.forEach(row => {
    if (row.tv_region) {
      const normalized = normalizeRegionName(row.tv_region);
      if (normalized && !tvRegionsMap.has(normalized)) {
        tvRegionsMap.set(normalized, {
          name: normalized,
          key: generateRegionKey(row.tv_region),
        });
      }
    }
  });

  console.log(`Found ${tvRegionsMap.size} unique TV regions`);

  // Step 2: Upsert TV regions
  if (!dryRun) {
    console.log('\nUpserting TV regions...');
    const tvRegionsToInsert = Array.from(tvRegionsMap.values()).map(region => ({
      region_key: region.key,
      name: region.name,
    }));

    const { error: tvRegionsError } = await supabase
      .from('tv_regions')
      .upsert(tvRegionsToInsert, {
        onConflict: 'region_key',
        ignoreDuplicates: false,
      });

    if (tvRegionsError) {
      console.error('Error upserting TV regions:', tvRegionsError);
      process.exit(1);
    }

    stats.tvRegionsUpserted = tvRegionsToInsert.length;
    console.log(`✓ Upserted ${stats.tvRegionsUpserted} TV regions`);
  } else {
    stats.tvRegionsUpserted = tvRegionsMap.size;
    console.log(`\n[DRY RUN] Would upsert ${stats.tvRegionsUpserted} TV regions`);
  }

  // Step 3: Prepare district -> TV region mappings
  console.log('\nPreparing district -> TV region mappings...');
  const districtMappings: Array<{ district: string; region_key: string }> = [];
  const districtSet = new Set<string>();

  rows.forEach(row => {
    if (row.district_code && row.tv_region) {
      const district = normalizeDistrict(row.district_code);
      if (district && !districtSet.has(district)) {
        districtSet.add(district);
        const regionName = normalizeRegionName(row.tv_region);
        const region = tvRegionsMap.get(regionName);
        if (region) {
          districtMappings.push({
            district,
            region_key: region.key,
          });
        }
      }
    }
  });

  console.log(`Prepared ${districtMappings.length} district mappings`);

  // Step 4: Upsert district -> TV region mappings
  if (!dryRun) {
    console.log('\nUpserting district -> TV region mappings...');
    const { error: mappingsError } = await supabase
      .from('district_tv_regions')
      .upsert(districtMappings, {
        onConflict: 'district',
        ignoreDuplicates: false,
      });

    if (mappingsError) {
      console.error('Error upserting district mappings:', mappingsError);
      process.exit(1);
    }

    stats.districtMappingsUpserted = districtMappings.length;
    console.log(`✓ Upserted ${stats.districtMappingsUpserted} district mappings`);
  } else {
    stats.districtMappingsUpserted = districtMappings.length;
    console.log(`[DRY RUN] Would upsert ${stats.districtMappingsUpserted} district mappings`);
  }

  // Step 5: Prepare neighbor relationships
  console.log('\nPreparing neighbor relationships...');
  const neighborRelationships: Array<{
    district: string;
    neighbor_district: string;
    relationship: string;
  }> = [];
  const neighborSet = new Set<string>();
  const edgeSet = new Set<string>(); // For symmetry detection

  rows.forEach(row => {
    if (row.district_code && row['Nearby regions']) {
      const district = normalizeDistrict(row.district_code);
      if (!district) return;
      
      const nearbyStr = row['Nearby regions'];
      
      // Parse comma-separated list
      const neighbors = nearbyStr
        .split(',')
        .map(n => normalizeDistrict(n))
        .filter(n => n.length > 0);

      neighbors.forEach(neighbor => {
        // Filter self-references
        if (neighbor === district) {
          stats.selfLinksFiltered++;
          return;
        }

        // Create composite key to avoid duplicates
        const key = `${district}|${neighbor}|adjacent`;
        if (!neighborSet.has(key)) {
          neighborSet.add(key);
          neighborRelationships.push({
            district,
            neighbor_district: neighbor,
            relationship: 'adjacent',
          });

          // Track for symmetry detection
          const forwardKey = `${district}|${neighbor}`;
          const reverseKey = `${neighbor}|${district}`;
          edgeSet.add(forwardKey);
          if (edgeSet.has(reverseKey)) {
            stats.symmetricEdges++;
          }
        }
      });
    }
  });

  stats.totalEdges = neighborRelationships.length;
  const symmetryRatio = stats.totalEdges > 0 
    ? (stats.symmetricEdges / stats.totalEdges * 100).toFixed(1)
    : '0';

  console.log(`Prepared ${neighborRelationships.length} neighbor relationships`);
  console.log(`  - Self-links filtered: ${stats.selfLinksFiltered}`);
  console.log(`  - Symmetric edges detected: ${stats.symmetricEdges} (${symmetryRatio}% of total)`);

  // Step 6: Upsert neighbor relationships (in batches)
  if (!dryRun) {
    console.log('\nUpserting neighbor relationships...');
    const batchSize = 1500; // Safe batch size for Supabase
    let inserted = 0;

    for (let i = 0; i < neighborRelationships.length; i += batchSize) {
      const batch = neighborRelationships.slice(i, i + batchSize);
      const { error: neighborsError } = await supabase
        .from('district_neighbors')
        .upsert(batch, {
          onConflict: 'district,neighbor_district,relationship',
          ignoreDuplicates: false,
        });

      if (neighborsError) {
        console.error(`Error upserting neighbor batch (${i}-${i + batch.length}):`, neighborsError);
        process.exit(1);
      }

      inserted += batch.length;
      process.stdout.write(`\r  Progress: ${inserted}/${neighborRelationships.length}`);
    }

    stats.neighborRelationshipsUpserted = neighborRelationships.length;
    console.log(`\n✓ Upserted ${stats.neighborRelationshipsUpserted} neighbor relationships`);
  } else {
    stats.neighborRelationshipsUpserted = neighborRelationships.length;
    console.log(`[DRY RUN] Would upsert ${stats.neighborRelationshipsUpserted} neighbor relationships`);
  }

  // Step 7: Validation - check against geo_districts
  if (!dryRun) {
    console.log('\nValidating against geo_districts...');
    const { data: existingDistricts, error: districtsError } = await supabase
      .from('geo_districts')
      .select('district')
      .limit(20000); // Increased limit for better validation

    if (districtsError) {
      console.warn('Warning: Could not fetch geo_districts for validation:', districtsError.message);
    } else {
      const existingDistrictSet = new Set(
        (existingDistricts || []).map((d: any) => normalizeDistrict(d.district))
      );
      
      const missingDistricts = districtMappings
        .map(m => m.district)
        .filter(d => !existingDistrictSet.has(d));

      stats.missingDistricts = missingDistricts.length;

      if (missingDistricts.length > 0) {
        console.log(`⚠ Found ${missingDistricts.length} districts in mapping that don't exist in geo_districts`);
        console.log('Sample missing districts (first 20):');
        missingDistricts.slice(0, 20).forEach(d => console.log(`  - ${d}`));
      } else {
        console.log('✓ All districts in mapping exist in geo_districts');
      }
    }
  } else {
    console.log('\n[DRY RUN] Skipping geo_districts validation');
  }

  // Final summary
  console.log('\n=== Import Summary ===');
  console.log(`Rows processed: ${stats.rowsProcessed}`);
  console.log(`TV regions: ${stats.tvRegionsUpserted}`);
  console.log(`District mappings: ${stats.districtMappingsUpserted}`);
  console.log(`Neighbor relationships: ${stats.neighborRelationshipsUpserted}`);
  if (stats.selfLinksFiltered > 0) {
    console.log(`Self-links filtered: ${stats.selfLinksFiltered}`);
  }
  if (stats.symmetricEdges > 0) {
    console.log(`Symmetric edges: ${stats.symmetricEdges} (${symmetryRatio}%)`);
  }
  if (stats.missingDistricts > 0) {
    console.log(`Missing districts (not in geo_districts): ${stats.missingDistricts}`);
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN complete - No changes were made');
  } else {
    console.log('\n✓ Import complete!');
  }
  console.log('');
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');
const limitIndex = args.findIndex(arg => arg === '--limit' || arg === '-l');
const limit = limitIndex >= 0 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : undefined;

if (limitIndex >= 0 && (!limit || isNaN(limit) || limit <= 0)) {
  console.error('Error: --limit requires a positive number');
  process.exit(1);
}

importDistrictMapping({ dryRun, limit }).catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});
