import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

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

function normalizeRegionName(region: string): string {
  return region.trim();
}

function generateRegionKey(region: string): string {
  return region
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function inspectCSV() {
  const csvPath = path.join(process.cwd(), 'district_mapping.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const parseResult = Papa.parse<DistrictMappingRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parseResult.data;
  const rowCount = rows.length;

  console.log('=== CSV Inspection Report ===\n');
  console.log('Column Names:');
  if (rows.length > 0) {
    console.log(Object.keys(rows[0]).join(', '));
  }
  console.log(`\nRow Count: ${rowCount}`);

  console.log('\n=== Sample Rows (first 5) ===');
  rows.slice(0, 5).forEach((row, idx) => {
    console.log(`\nRow ${idx + 1}:`);
    console.log(`  district_code: ${row.district_code}`);
    console.log(`  tv_region: ${row.tv_region}`);
    console.log(`  Nearby regions: ${row['Nearby regions']}`);
  });

  // Analyze districts
  const districts = new Set<string>();
  const normalizedDistricts = new Set<string>();
  rows.forEach(row => {
    if (row.district_code) {
      districts.add(row.district_code);
      normalizedDistricts.add(normalizeDistrict(row.district_code));
    }
  });

  console.log(`\n=== District Analysis ===`);
  console.log(`Unique district codes (raw): ${districts.size}`);
  console.log(`Unique district codes (normalized): ${normalizedDistricts.size}`);
  
  // Check for normalization needs
  const needsNormalization = Array.from(districts).some(d => 
    d !== normalizeDistrict(d) || d.includes(' ') || d !== d.toUpperCase()
  );
  console.log(`Needs normalization: ${needsNormalization ? 'YES' : 'NO'}`);
  if (needsNormalization) {
    const examples = Array.from(districts).slice(0, 5).map(d => ({
      original: d,
      normalized: normalizeDistrict(d)
    }));
    console.log('Examples:');
    examples.forEach(ex => {
      if (ex.original !== ex.normalized) {
        console.log(`  "${ex.original}" -> "${ex.normalized}"`);
      }
    });
  }

  // Analyze TV regions
  const tvRegions = new Set<string>();
  const regionKeys = new Map<string, string>();
  rows.forEach(row => {
    if (row.tv_region) {
      const normalized = normalizeRegionName(row.tv_region);
      tvRegions.add(normalized);
      if (!regionKeys.has(normalized)) {
        regionKeys.set(normalized, generateRegionKey(row.tv_region));
      }
    }
  });

  console.log(`\n=== TV Region Analysis ===`);
  console.log(`Unique TV regions: ${tvRegions.size}`);
  console.log('\nSample regions:');
  Array.from(tvRegions).slice(0, 10).forEach(region => {
    const key = regionKeys.get(region);
    console.log(`  "${region}" -> key: "${key}"`);
  });

  // Analyze nearby regions
  let totalNeighbors = 0;
  let maxNeighbors = 0;
  let minNeighbors = Infinity;
  const neighborCounts: number[] = [];
  const allNeighborDistricts = new Set<string>();

  rows.forEach(row => {
    const nearbyStr = row['Nearby regions'];
    if (nearbyStr) {
      // Parse comma-separated list, handling quotes
      const neighbors = nearbyStr
        .split(',')
        .map(n => normalizeDistrict(n))
        .filter(n => n.length > 0);
      
      neighborCounts.push(neighbors.length);
      totalNeighbors += neighbors.length;
      maxNeighbors = Math.max(maxNeighbors, neighbors.length);
      minNeighbors = Math.min(minNeighbors, neighbors.length);
      
      neighbors.forEach(n => allNeighborDistricts.add(n));
    } else {
      neighborCounts.push(0);
      minNeighbors = Math.min(minNeighbors, 0);
    }
  });

  const avgNeighbors = totalNeighbors / rowCount;

  console.log(`\n=== Nearby Regions Analysis ===`);
  console.log(`Total neighbor relationships: ${totalNeighbors}`);
  console.log(`Average neighbors per district: ${avgNeighbors.toFixed(2)}`);
  console.log(`Min neighbors: ${minNeighbors}`);
  console.log(`Max neighbors: ${maxNeighbors}`);
  console.log(`Unique neighbor districts mentioned: ${allNeighborDistricts.size}`);

  // Check for self-references
  let selfReferences = 0;
  rows.forEach(row => {
    const district = normalizeDistrict(row.district_code);
    const nearbyStr = row['Nearby regions'];
    if (nearbyStr) {
      const neighbors = nearbyStr
        .split(',')
        .map(n => normalizeDistrict(n));
      if (neighbors.includes(district)) {
        selfReferences++;
      }
    }
  });
  console.log(`Self-references found: ${selfReferences}`);

  // Schema guess
  console.log(`\n=== Schema Guess ===`);
  console.log(`
Tables needed:
1. tv_regions
   - region_key (text, unique): slugified version of tv_region
   - name (text): full TV region name
   - description (text, nullable): optional description

2. district_tv_regions
   - district (text, PK): normalized district_code (uppercase, trimmed)
   - region_key (text, FK -> tv_regions.region_key)
   - source (text): 'district_mapping_csv'

3. district_neighbors
   - district (text, PK part 1): normalized district_code
   - neighbor_district (text, PK part 2): normalized neighbor code
   - relationship (text, default 'adjacent'): type of relationship
   - source (text): 'district_mapping_csv'
   - Composite PK: (district, neighbor_district, relationship)

Notes:
- Districts should be normalized: uppercase, trimmed, no spaces
- TV regions need stable keys (slugified)
- Nearby regions are comma-separated lists that need parsing
- Self-references should be filtered out
- ${selfReferences > 0 ? `WARNING: ${selfReferences} self-references found - will be filtered` : 'No self-references found'}
`);

  console.log('\n=== Inspection Complete ===\n');
}

inspectCSV().catch(console.error);
