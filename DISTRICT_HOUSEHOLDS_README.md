# District Households Import

This document describes how to import real household counts per postcode district from `district_mapping.csv` into `geo_districts.households`.

## Overview

The system now uses real household counts from the district mapping CSV instead of a constant multiplier (2500 per district). This provides more accurate "Estimated households" calculations in both Validation and Extension modes.

## Prerequisites

1. Ensure `district_mapping.csv` is in the project root directory
2. Ensure migration `027_geo_districts_households.sql` has been applied
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Step 1: Apply Migration

Apply the migration to add the `households` column to `geo_districts`:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually via Supabase dashboard
# Run: supabase/migrations/027_geo_districts_households.sql
```

This migration:
- Adds `households INTEGER` column to `geo_districts`
- Creates `district_households_staging` table for import
- Creates `backfill_geo_districts_households()` function
- Adds index on `households` for efficient queries

## Step 2: Import Household Data

### Dry Run (Recommended First)

Test the import without making changes:

```bash
npm run db:import:district-households -- --dry-run
```

Or with a limit to test on a subset:

```bash
npm run db:import:district-households -- --dry-run --limit 100
```

### Full Import

Run the import script:

```bash
npm run db:import:district-households
```

### Import Options

- `--dry-run` or `-d`: Test mode - shows what would be imported without making changes
- `--limit N` or `-l N`: Limit to first N rows (useful for testing)

Examples:
```bash
# Test with first 50 rows
npm run db:import:district-households -- --dry-run --limit 50

# Import first 100 rows only
npm run db:import:district-households -- --limit 100

# Full import
npm run db:import:district-households
```

The script will:
1. Read `district_mapping.csv`
2. Extract `district_code` and `district_households` columns
3. Normalize district codes (trim, uppercase, remove spaces)
4. Populate `district_households_staging` table
5. Call `backfill_geo_districts_households()` to update `geo_districts.households`
6. Report counts: updated, with households, missing households

## Step 3: Verify Results

Run sanity checks in Supabase SQL Editor:

```bash
# See: supabase/sanity_households.sql
```

Key checks:
- Count of districts with households populated
- Min/max/avg household values (expected: 1,000-50,000 per district)
- Sample districts with and without household data
- Validation that no negative or zero values exist
- Spot check specific districts to verify CSV import correctness
- Check for suspiciously high values (>200k) that might indicate parsing errors

**Expected Ranges:**
- Typical UK postcode districts: **1,000-50,000 households**
- Large urban areas (London): **10,000-50,000**
- Small rural areas: **1,000-5,000**
- If averages exceed 100,000, check for comma parsing issues or wrong column import

## How It Works

### Database

- `geo_districts.households`: Stores household count per district (nullable)
- `district_households_staging`: Temporary staging table for CSV import
- `backfill_geo_districts_households()`: Function that updates `geo_districts` from staging table using `district_norm` for reliable matching

### API Changes

**Validation Mode** (`getValidationResults`):
- Fetches household counts for included districts from `geo_districts`
- Sums real household values
- Uses fallback constant (2500) for districts with NULL households
- Returns `totals.estimatedHouseholds` with the sum

**Extension Mode** (`getProviderImpact`):
- Fetches household counts for included districts from `geo_districts`
- Sums real household values
- Uses fallback constant (2500) for districts with NULL households
- Returns `totals.estimatedHouseholds` with the sum

### Frontend

- `BuildExploreStep`: Uses `validationResults.totals.estimatedHouseholds` or `providerImpact.totals.estimatedHouseholds`
- `ResultsStep`: Uses real household sums from API results
- `useExportContext`: Uses real household sums from API results
- All calculations respect existing filters (TV regions, battle zones, etc.)

## Fallback Behavior

- If a district has `households IS NULL`, the system uses `2500` as the fallback
- This ensures totals never drop to zero unexpectedly
- The fallback is applied per-district, so mixed data (some with real counts, some without) works correctly

## Performance

- Household data is fetched in batches of 1000 districts (Supabase `.in()` limit)
- Index on `households` column improves aggregation queries
- Calculations happen server-side in API functions, not client-side

## Troubleshooting

**Issue**: Import shows "0 districts updated"
- **Check**: Ensure `district_mapping.csv` has `district_households` column with numeric values
- **Check**: Verify district codes in CSV match `geo_districts.district_norm` format (normalized)

**Issue**: Some districts still show fallback (2500)
- **Expected**: Districts not in `district_mapping.csv` will use fallback
- **Check**: Run sanity SQL to see which districts are missing household data

**Issue**: Household totals seem incorrect
- **Check**: Verify CSV `district_households` values are reasonable (typically 1,000-50,000 for UK districts)
- **Check**: Ensure migration was applied and import script completed successfully

## Notes

- The import is **idempotent**: running it multiple times is safe (only updates NULL values)
- District matching uses `district_norm` for reliable joins (handles whitespace/Unicode differences)
- The staging table can be cleared and re-imported if needed
- Household data is additive only - existing `geo_districts` rows are not deleted or modified (except adding the `households` column)
