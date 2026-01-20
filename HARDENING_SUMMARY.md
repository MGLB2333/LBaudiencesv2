# Hardening + Safety Pass Summary

This document summarizes the hardening and safety improvements made to the district mapping ingestion work.

## Files Changed

### New Files Created
1. **`supabase/sanity_tv_regions.sql`** - Sanity checks for TV regions import
2. **`supabase/sanity_district_norm.sql`** - Sanity checks for district normalization
3. **`DISTRICT_NORMALIZATION_README.md`** - Documentation for district normalization strategy
4. **`HARDENING_SUMMARY.md`** - This file

### Existing Files (Verified/No Changes Needed)
1. **`supabase/migrations/022_tv_regions_and_neighbors.sql`** - Already production-safe:
   - ✅ `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`
   - ✅ `CREATE TABLE IF NOT EXISTS`
   - ✅ `CREATE INDEX IF NOT EXISTS`
   - ✅ `DROP POLICY IF EXISTS` for idempotency
   - ✅ Safe RLS policies (read for authenticated, full access for service role)
   - ✅ Unique constraint names
   - ✅ Foreign key correctly references `tv_regions(region_key)`

2. **`src/scripts/import-district-mapping.ts`** - Already production-safe:
   - ✅ Normalizes district codes (trim, uppercase, remove spaces)
   - ✅ Normalizes region names and generates stable keys
   - ✅ Uses UPSERT operations (idempotent)
   - ✅ Does NOT truncate tables
   - ✅ Batches inserts (1500 rows per batch)
   - ✅ Has `--dry-run` and `--limit N` modes
   - ✅ Filters self-links
   - ✅ Detects and reports symmetry
   - ✅ Validates against `geo_districts`
   - ✅ Comprehensive logging

3. **`supabase/migrations/023_district_normalization.sql`** - Already exists and is production-safe:
   - ✅ Creates `normalize_district()` function
   - ✅ Adds `district_norm` columns (nullable, additive)
   - ✅ Backfills existing data
   - ✅ Creates indexes
   - ✅ Auto-populates via triggers
   - ✅ Prevents self-links in normalized columns

## Verification Checklist

### Migration Safety ✅
- [x] `gen_random_uuid()` works (pgcrypto extension)
- [x] All `CREATE TABLE` statements are idempotent (`IF NOT EXISTS`)
- [x] Foreign key uses `region_key` correctly (UNIQUE constraint exists)
- [x] All indexes use `CREATE INDEX IF NOT EXISTS`
- [x] Constraint names are unique and deterministic
- [x] Policies are dropped before creation (`DROP POLICY IF EXISTS`)

### RLS Policies ✅
- [x] RLS enabled on all 3 new tables
- [x] SELECT allowed for authenticated users (read-only)
- [x] INSERT/UPDATE/DELETE restricted to service role
- [x] Policies don't block import script (service role has full access)

### Import Script ✅
- [x] Normalizes district codes: trim, uppercase, remove spaces
- [x] Normalizes region: trim; builds region_key as slug
- [x] Uses UPSERT operations:
  - `tv_regions` upsert on `region_key`
  - `district_tv_regions` upsert on `district`
  - `district_neighbors` upsert on composite PK
- [x] Does NOT truncate tables
- [x] Batches inserts (1500 rows per batch)
- [x] Has `--dry-run` mode
- [x] Has `--limit N` mode
- [x] Comprehensive logging at end

### Neighbor Graph Quality ✅
- [x] No self-links inserted (filtered in script, CHECK constraint in DB)
- [x] District/neighbor pairs normalized consistently
- [x] Symmetric edges detected and logged
- [x] Distance parsing handled safely (null if invalid)

### Sanity SQL Files ✅
- [x] `sanity_tv_regions.sql` created with:
  - Count records
  - Top 15 regions by district count
  - Missing districts check
  - Self-link check
  - Sample neighbor relationships
  - Districts with most neighbors
  - Symmetry check
  - Sample query for a district
  - Districts with no neighbors
  - Region coverage

- [x] `sanity_district_norm.sql` created with:
  - `district_norm` population status
  - Matching districts using `district_norm`
  - Mismatched districts analysis
  - Districts that match using norm but not raw
  - Normalization examples
  - Duplicate `district_norm` check
  - Neighbor relationships using `district_norm`
  - Self-link check using `district_norm`
  - Normalization function test
  - Coverage analysis

## How to Run

### 1. Apply Migration (if not already applied)

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually via Supabase dashboard
# Run: supabase/migrations/022_tv_regions_and_neighbors.sql
# Then: supabase/migrations/023_district_normalization.sql
```

### 2. Dry Run Import (Recommended First)

```bash
npm run db:import:district-mapping -- --dry-run
```

Or with a limit to test on a subset:

```bash
npm run db:import:district-mapping -- --dry-run --limit 100
```

### 3. Real Import

```bash
npm run db:import:district-mapping
```

### 4. Sanity SQL Checks

```bash
# TV regions sanity checks
supabase db execute -f supabase/sanity_tv_regions.sql

# District normalization sanity checks
supabase db execute -f supabase/sanity_district_norm.sql
```

Or copy/paste queries from the SQL files into the Supabase dashboard.

## Safety Guarantees

1. **Additive Only**: No existing tables or APIs were modified
2. **Idempotent**: All operations can be run multiple times safely
3. **No Data Loss**: Original columns preserved, normalization is additive
4. **Deterministic**: Normalization function always produces same output for same input
5. **Production-Safe**: All migrations use `IF NOT EXISTS`, policies are idempotent
6. **Self-Link Prevention**: Both script-level filtering and database constraints
7. **Service Role Access**: Import script uses service role, bypasses RLS restrictions

## Expected Results

After running the import and sanity checks:

- **TV Regions**: Should match the number of unique TV regions in CSV
- **District Mappings**: Should match the number of unique districts in CSV
- **Neighbor Relationships**: Should match parsed neighbor relationships (minus self-links)
- **Missing Districts**: Should show count of districts not in `geo_districts` (expected: ~2,000 before normalization, fewer after)
- **Self-Links**: Should be 0
- **Symmetry**: Should show percentage of symmetric edges
- **Normalization**: `district_norm` columns should be 100% populated
- **Matching**: Districts should match better using `district_norm` than raw `district`

## Notes

- The import script normalizes data before inserting, but the PostgreSQL `normalize_district()` function (via triggers) ensures `district_norm` is always canonical
- The CHECK constraints in migration 022 enforce that `district` columns are already normalized (uppercase, trimmed) - this is enforced by the import script
- Future joins should use `district_norm` for reliable matching, but existing code continues to work with raw `district` columns
