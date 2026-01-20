import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'papaparse';

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
 * Normalize sector code (e.g. "AL11" -> "AL1 1")
 * Attempts to add space between outward and inward codes
 */
function normalizeSector(sector: string): string {
  const trimmed = sector.trim().toUpperCase();
  
  // If already has space, return as-is
  if (trimmed.includes(' ')) {
    return trimmed;
  }
  
  // Try to detect pattern: 2-4 letters followed by 1-2 digits
  // e.g. "AL11" -> "AL1 1", "SW1A1" -> "SW1A 1"
  const match = trimmed.match(/^([A-Z]{2,4})(\d{1,2})$/);
  if (match) {
    const [, outward, inward] = match;
    return `${outward} ${inward}`;
  }
  
  // If pattern doesn't match, return as-is
  return trimmed;
}

/**
 * Normalize district code
 */
function normalizeDistrict(district: string): string {
  return district.trim().toUpperCase();
}

/**
 * Parse score from string or number
 */
function parseScore(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const num = typeof value === 'string' ? parseInt(value.trim(), 10) : Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }
  
  return num;
}

/**
 * Find column index by name (case-insensitive, handles variants)
 */
function findColumnIndex(headers: string[], variants: string[]): number | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  for (const variant of variants) {
    const index = lowerHeaders.indexOf(variant.toLowerCase().trim());
    if (index !== -1) {
      return index;
    }
  }
  return null;
}

/**
 * Import CSV file to geo_sector_signals
 */
async function importSegmentGeoCSV({
  filePath,
  provider,
  segmentKey,
  providerLabel,
}: {
  filePath: string;
  provider: string;
  segmentKey: string;
  providerLabel?: string;
}) {
  console.log(`\n=== Importing CSV ===`);
  console.log(`File: ${filePath}`);
  console.log(`Provider: ${provider}`);
  console.log(`Segment Key: ${segmentKey}`);
  console.log(`Provider Label: ${providerLabel || segmentKey}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Read and parse CSV
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parseResult = parse<string[]>(fileContent, {
    header: false,
    skipEmptyLines: true,
  });
  
  if (parseResult.errors.length > 0) {
    console.warn('CSV parse warnings:', parseResult.errors);
  }
  
  const rows = parseResult.data;
  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // First row is headers
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  console.log(`Found ${dataRows.length} data rows`);
  console.log(`Headers: ${headers.join(', ')}`);
  
  // Find column indices
  const sectorIndex = findColumnIndex(headers, ['Sector', 'sector', 'postcode_sector', 'Postcode Sector']);
  const districtIndex = findColumnIndex(headers, ['District', 'district', 'postcode_district', 'Postcode District']);
  const scoreIndex = findColumnIndex(headers, ['Index', 'index', 'Score', 'score']);
  
  if (sectorIndex === null) {
    throw new Error('Could not find Sector column. Expected: Sector, sector, postcode_sector, or Postcode Sector');
  }
  if (districtIndex === null) {
    throw new Error('Could not find District column. Expected: District, district, postcode_district, or Postcode District');
  }
  
  console.log(`Column indices: sector=${sectorIndex}, district=${districtIndex}, score=${scoreIndex !== null ? scoreIndex : 'not found'}`);
  
  // Process rows
  const records: Array<{
    segment_key: string;
    provider: string;
    provider_segment_label: string;
    sector: string;
    district: string;
    score: number | null;
    score_norm: number | null;
    source_file: string;
  }> = [];
  
  let rowsWithScore = 0;
  const districtSet = new Set<string>();
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length <= Math.max(sectorIndex, districtIndex)) {
      continue; // Skip incomplete rows
    }
    
    const sectorRaw = row[sectorIndex];
    const districtRaw = row[districtIndex];
    const scoreRaw = scoreIndex !== null ? row[scoreIndex] : null;
    
    if (!sectorRaw || !districtRaw) {
      continue; // Skip rows with missing required fields
    }
    
    const sector = normalizeSector(sectorRaw);
    const district = normalizeDistrict(districtRaw);
    const score = parseScore(scoreRaw);
    const scoreNorm = score !== null ? score / 100.0 : null;
    
    if (score !== null) {
      rowsWithScore++;
    }
    
    districtSet.add(district);
    
    records.push({
      segment_key: segmentKey,
      provider,
      provider_segment_label: providerLabel || segmentKey,
      sector,
      district,
      score,
      score_norm: scoreNorm,
      source_file: path.basename(filePath),
    });
  }
  
  console.log(`\nProcessed ${records.length} records`);
  console.log(`Distinct districts: ${districtSet.size}`);
  console.log(`Rows with score: ${rowsWithScore} (${((rowsWithScore / records.length) * 100).toFixed(1)}%)`);
  
  // Upsert in batches
  console.log(`\nUpserting to database...`);
  const batchSize = 500;
  let upserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('geo_sector_signals')
      .upsert(batch, {
        onConflict: 'segment_key,provider,sector',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error(`Error upserting batch ${i / batchSize + 1}:`, error);
      throw error;
    }
    
    upserted += batch.length;
    if ((i / batchSize + 1) % 10 === 0 || i + batchSize >= records.length) {
      console.log(`Upserted ${upserted} of ${records.length} records`);
    }
  }
  
  console.log(`\n✅ Successfully imported ${upserted} records`);
  console.log(`   Distinct districts: ${districtSet.size}`);
  console.log(`   Rows with score: ${rowsWithScore} (${((rowsWithScore / records.length) * 100).toFixed(1)}%)`);
  
  return {
    rowsRead: dataRows.length,
    rowsUpserted: upserted,
    distinctDistricts: districtSet.size,
    rowsWithScore,
    scorePercentage: (rowsWithScore / records.length) * 100,
  };
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const providerIndex = args.indexOf('--provider');
  const segmentKeyIndex = args.indexOf('--segmentKey');
  const providerLabelIndex = args.indexOf('--providerLabel');
  
  if (fileIndex === -1 || !args[fileIndex + 1]) {
    console.error('Usage: tsx src/scripts/import-segment-geo-csv.ts --file <path> --provider <name> --segmentKey <key> [--providerLabel <label>]');
    process.exit(1);
  }
  
  if (providerIndex === -1 || !args[providerIndex + 1]) {
    console.error('Missing --provider argument');
    process.exit(1);
  }
  
  if (segmentKeyIndex === -1 || !args[segmentKeyIndex + 1]) {
    console.error('Missing --segmentKey argument');
    process.exit(1);
  }
  
  const filePath = args[fileIndex + 1];
  const provider = args[providerIndex + 1];
  const segmentKey = args[segmentKeyIndex + 1];
  const providerLabel = providerLabelIndex !== -1 ? args[providerLabelIndex + 1] : undefined;
  
  importSegmentGeoCSV({
    filePath,
    provider,
    segmentKey,
    providerLabel,
  })
    .then(() => {
      console.log('\nDone');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nError:', error);
      process.exit(1);
    });
}

export { importSegmentGeoCSV };
