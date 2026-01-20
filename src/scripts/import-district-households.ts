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

function normalizeDistrict(district: string): string {
  return district.trim().toUpperCase().replace(/\s+/g, '');
}

async function importDistrictHouseholds(options: { dryRun?: boolean; limit?: number } = {}) {
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

  // Prepare household data
  console.log('\nPreparing household data...');
  const householdData: Array<{ district_code: string; households: number }> = [];
  const districtSet = new Set<string>();

  rows.forEach(row => {
    if (row.district_code && row.district_households) {
      const district = normalizeDistrict(row.district_code);
      if (district && !districtSet.has(district)) {
        districtSet.add(district);
        // Strip commas and parse safely (e.g., "25,000" -> 25000)
        const cleaned = row.district_households.trim().replace(/,/g, '');
        const households = parseInt(cleaned, 10);
        if (!isNaN(households) && households > 0) {
          householdData.push({
            district_code: district,
            households,
          });
        } else {
          console.warn(`⚠ Invalid household value for ${district}: "${row.district_households}"`);
        }
      }
    }
  });

  console.log(`Prepared ${householdData.length} district household records`);

  if (householdData.length === 0) {
    console.log('⚠ No household data found in CSV');
    return;
  }

  // Step 1: Clear staging table (for fresh import)
  if (!dryRun) {
    console.log('\nClearing staging table...');
    const { error: clearError } = await supabase
      .from('district_households_staging')
      .delete()
      .neq('district_code', ''); // Delete all rows

    if (clearError) {
      console.error('Error clearing staging table:', clearError);
      process.exit(1);
    }
    console.log('✓ Cleared staging table');
  } else {
    console.log('[DRY RUN] Would clear staging table');
  }

  // Step 2: Insert into staging table
  if (!dryRun) {
    console.log('\nInserting household data into staging table...');
    
    // Batch inserts (Supabase has limits)
    const batchSize = 1000;
    let inserted = 0;
    
    for (let i = 0; i < householdData.length; i += batchSize) {
      const batch = householdData.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('district_households_staging')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        process.exit(1);
      }
      inserted += batch.length;
      console.log(`  Inserted batch ${i / batchSize + 1} (${inserted}/${householdData.length})`);
    }
    
    console.log(`✓ Inserted ${inserted} records into staging table`);
  } else {
    console.log(`[DRY RUN] Would insert ${householdData.length} records into staging table`);
  }

  // Step 3: Call backfill function
  if (!dryRun) {
    console.log('\nBackfilling geo_districts.households...');
    const { data, error: backfillError } = await supabase.rpc('backfill_geo_districts_households');

    if (backfillError) {
      console.error('Error backfilling households:', backfillError);
      process.exit(1);
    }

    if (data && data.length > 0) {
      const result = data[0];
      console.log(`✓ Backfill complete:`);
      console.log(`  - Districts updated: ${result.districts_updated}`);
      console.log(`  - Districts with households: ${result.districts_with_households}`);
      console.log(`  - Districts missing households: ${result.districts_missing_households}`);
    }
  } else {
    console.log('[DRY RUN] Would call backfill_geo_districts_households()');
  }

  // Step 4: Validation
  if (!dryRun) {
    console.log('\nValidating results...');
    
    // Count districts with households
    const { count: withHouseholds, error: countError } = await supabase
      .from('geo_districts')
      .select('*', { count: 'exact', head: true })
      .not('households', 'is', null);

    if (countError) {
      console.warn('⚠ Could not validate counts:', countError);
    } else {
      console.log(`✓ ${withHouseholds} districts now have household data`);
    }

    // Sample check: get min/max
    const { data: stats, error: statsError } = await supabase
      .from('geo_districts')
      .select('households')
      .not('households', 'is', null)
      .order('households', { ascending: true })
      .limit(1);

    const { data: maxStats, error: maxStatsError } = await supabase
      .from('geo_districts')
      .select('households')
      .not('households', 'is', null)
      .order('households', { ascending: false })
      .limit(1);

    if (!statsError && !maxStatsError && stats && maxStats.length > 0 && maxStats && maxStats.length > 0) {
      console.log(`  Min households: ${stats[0].households}`);
      console.log(`  Max households: ${maxStats[0].households}`);
    }
  }

  console.log('\n✅ Import complete!');
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');
const limitIndex = args.findIndex(arg => arg === '--limit' || arg === '-l');
const limit = limitIndex >= 0 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : undefined;

importDistrictHouseholds({ dryRun, limit })
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
