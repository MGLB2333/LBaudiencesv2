# District Mapping Import

This document describes how to import TV region mappings and district neighbor relationships from `district_mapping.csv`.

## Overview

The import creates three new tables:
- `tv_regions`: TV region metadata (e.g., "STV North", "ITV Central")
- `district_tv_regions`: Maps postcode districts to TV regions
- `district_neighbors`: Adjacency/nearby relationships between districts

## Prerequisites

1. Ensure `district_mapping.csv` is in the project root directory
2. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Step 1: Inspect the CSV

Before importing, inspect the CSV structure:

```bash
npm run db:inspect-district-mapping
```

This will output:
- Column names
- Row count
- Sample rows
- Unique district count
- TV region analysis
- Nearby regions analysis
- Schema recommendations

## Step 2: Run Migration

Apply the migration to create the tables:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually via Supabase dashboard
# Run: supabase/migrations/022_tv_regions_and_neighbors.sql
```

## Step 3: Import Data

### Dry Run (Recommended First)

Test the import without making changes:

```bash
npm run db:import:district-mapping -- --dry-run
```

Or with a limit to test on a subset:

```bash
npm run db:import:district-mapping -- --dry-run --limit 100
```

### Full Import

Run the import script:

```bash
npm run db:import:district-mapping
```

### Import Options

- `--dry-run` or `-d`: Test mode - shows what would be imported without making changes
- `--limit N` or `-l N`: Limit to first N rows (useful for testing)

Examples:
```bash
# Test with first 50 rows
npm run db:import:district-mapping -- --dry-run --limit 50

# Import first 100 rows only
npm run db:import:district-mapping -- --limit 100

# Full import
npm run db:import:district-mapping
```

The script will:
1. Read `district_mapping.csv`
2. Normalize district codes (uppercase, trimmed, no spaces)
3. Generate stable region keys from TV region names (slugified)
4. Upsert TV regions (idempotent on `region_key`)
5. Upsert district → TV region mappings (idempotent on `district`)
6. Parse and upsert neighbor relationships in batches (idempotent on composite PK)
7. Filter out self-references automatically
8. Detect and report symmetry in neighbor relationships
9. Validate against `geo_districts` table
10. Report comprehensive statistics

## Step 4: Sanity Checks

After import, run the sanity check SQL file:

```bash
# Via Supabase CLI
supabase db execute -f supabase/sanity_tv_regions.sql

# Or copy/paste queries from supabase/sanity_tv_regions.sql into Supabase dashboard
```

Or verify manually with these SQL queries:

### Count Records

```sql
-- Count TV regions
SELECT COUNT(*) FROM tv_regions;

-- Count district mappings
SELECT COUNT(*) FROM district_tv_regions;

-- Count neighbor relationships
SELECT COUNT(*) FROM district_neighbors;
```

### Top Regions by District Count

```sql
SELECT 
  tr.name,
  tr.region_key,
  COUNT(dtr.district) as district_count
FROM tv_regions tr
LEFT JOIN district_tv_regions dtr ON tr.region_key = dtr.region_key
GROUP BY tr.id, tr.name, tr.region_key
ORDER BY district_count DESC
LIMIT 10;
```

### Missing Districts Check

```sql
-- Districts in mapping that don't exist in geo_districts
SELECT 
  dtr.district,
  dtr.region_key
FROM district_tv_regions dtr
LEFT JOIN geo_districts gd ON UPPER(TRIM(gd.district)) = dtr.district
WHERE gd.district IS NULL
LIMIT 20;
```

### Sample Neighbor Relationships

```sql
-- Sample neighbor relationships
SELECT 
  dn.district,
  dn.neighbor_district,
  dn.relationship
FROM district_neighbors dn
ORDER BY dn.district
LIMIT 20;
```

### Districts with Most Neighbors

```sql
SELECT 
  district,
  COUNT(*) as neighbor_count
FROM district_neighbors
GROUP BY district
ORDER BY neighbor_count DESC
LIMIT 10;
```

### Symmetry Check

```sql
-- Check how many edges have reverse edges (symmetric graph)
WITH edge_pairs AS (
  SELECT 
    dn1.district as a,
    dn1.neighbor_district as b,
    CASE WHEN dn2.district IS NOT NULL THEN 1 ELSE 0 END as has_reverse
  FROM district_neighbors dn1
  LEFT JOIN district_neighbors dn2 
    ON dn1.district = dn2.neighbor_district 
    AND dn1.neighbor_district = dn2.district
    AND dn1.relationship = dn2.relationship
)
SELECT 
  COUNT(*) as total_edges,
  SUM(has_reverse) as symmetric_edges,
  ROUND(100.0 * SUM(has_reverse) / COUNT(*), 2) as symmetry_percentage
FROM edge_pairs;
```

### Self-Link Check (should be 0)

```sql
SELECT COUNT(*) as self_link_count
FROM district_neighbors
WHERE district = neighbor_district;
```

## Data Normalization

- **Districts**: Normalized to uppercase, trimmed, no spaces
- **TV Regions**: Names are trimmed; keys are slugified (lowercase, underscores)
- **Neighbors**: Self-references are automatically filtered out
- **Relationships**: Default to 'adjacent' (can be extended later)

## Idempotency

The import script is idempotent:
- Uses `UPSERT` operations with conflict resolution
- Can be run multiple times safely
- Won't create duplicates

## Troubleshooting

### CSV Not Found
Ensure `district_mapping.csv` is in the project root directory.

### Missing Environment Variables
Check that `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

### RLS Policy Errors
The migration creates RLS policies. If you encounter permission errors, ensure you're using the service role key for imports.

### Validation Warnings
If districts are missing from `geo_districts`, this is logged but doesn't fail the import. These may be:
- Districts that haven't been loaded yet
- Districts from different data sources
- Edge cases that need manual review

## Schema Details

### tv_regions
- `id`: UUID primary key
- `region_key`: Unique slug (e.g., "stv_north")
- `name`: Full name (e.g., "STV North")
- `description`: Optional description
- `created_at`: Timestamp

### district_tv_regions
- `district`: Postcode district (PK, e.g., "AB10")
- `region_key`: Foreign key to `tv_regions.region_key`
- `source`: Source identifier (default: "district_mapping_csv")
- `created_at`: Timestamp

### district_neighbors
- `district`: Source district (PK part 1)
- `neighbor_district`: Neighbor district (PK part 2)
- `relationship`: Type of relationship (default: "adjacent")
- `distance_km`: Optional distance (currently NULL)
- `source`: Source identifier (default: "district_mapping_csv")
- `created_at`: Timestamp
- Composite PK: `(district, neighbor_district, relationship)`

## Notes

- This is an **additive** migration - no existing tables are modified
- All operations are reversible (tables can be dropped if needed)
- The import does not truncate tables - uses upserts for safety
- Self-references in neighbor relationships are automatically filtered
