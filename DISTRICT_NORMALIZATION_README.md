# District Normalization

This document describes the district normalization strategy introduced in migration `023_district_normalization.sql` to fix matching issues caused by Unicode/whitespace differences between data sources.

## Problem

When importing district mapping data, approximately ~2,000 districts from the mapping did not match `geo_districts`, despite appearing to be the same district codes. This was caused by:
- Hidden Unicode characters (non-breaking spaces, zero-width spaces, etc.)
- Whitespace differences (spaces, tabs, newlines)
- Case differences
- Inconsistent normalization across data sources

## Solution

A canonical normalization strategy was introduced:

1. **PostgreSQL Function**: `normalize_district(text)` that:
   - Trims leading/trailing whitespace
   - Converts to uppercase
   - Removes all whitespace characters (spaces, tabs, newlines)
   - Removes Unicode space variants (non-breaking spaces, zero-width spaces, etc.)

2. **Canonical Columns**: Added `district_norm` columns to:
   - `geo_districts`
   - `geo_sector_signals` (base table for `geo_district_signals` view)
   - `district_tv_regions`
   - `district_neighbors` (for both `district` and `neighbor_district`)

3. **Auto-Population**: Triggers automatically populate `district_norm` on INSERT/UPDATE

4. **Backfill**: All existing rows have `district_norm` populated using the normalization function

## Usage

### Current State

The `district_norm` columns are populated and ready for use. **However, existing application code has NOT been updated yet** - this is an additive change that doesn't break existing functionality.

### Future Use

When ready to switch to normalized joins, update queries like:

```sql
-- OLD (using raw district column)
SELECT * 
FROM district_tv_regions dtr
JOIN geo_districts gd ON dtr.district = gd.district;

-- NEW (using district_norm for reliable matching)
SELECT * 
FROM district_tv_regions dtr
JOIN geo_districts gd ON dtr.district_norm = gd.district_norm;
```

### Normalization Function

The `normalize_district()` function can be used directly:

```sql
SELECT normalize_district('AB 1');  -- Returns 'AB1'
SELECT normalize_district('ab1');   -- Returns 'AB1'
SELECT normalize_district('  AB1  '); -- Returns 'AB1'
SELECT normalize_district('AB' || CHR(160) || '1'); -- Returns 'AB1' (removes non-breaking space)
```

## Verification

Run the sanity check SQL file to verify normalization:

```bash
# Via Supabase CLI
supabase db execute -f supabase/sanity_district_norm.sql

# Or copy/paste queries from supabase/sanity_district_norm.sql into Supabase dashboard
```

The sanity checks verify:
- All `district_norm` columns are populated
- Matching works correctly using `district_norm`
- Districts that didn't match using raw columns now match using `district_norm`
- No duplicate `district_norm` values
- Self-link constraints work with normalized columns

## Safety

- **Additive Only**: No existing columns or logic were modified
- **Idempotent**: Migration can be run multiple times safely
- **Backward Compatible**: Existing code continues to work
- **Deterministic**: Same input always produces same normalized output
- **No Data Loss**: Original `district` columns are preserved

## Examples

### Before Normalization

```sql
-- These would NOT match:
'dtr.district' = 'AB 1'  (with space)
'gd.district' = 'AB1'    (without space)
```

### After Normalization

```sql
-- These DO match:
'dtr.district_norm' = 'AB1'
'gd.district_norm' = 'AB1'
```

## Migration Details

The migration (`023_district_normalization.sql`) includes:
1. `normalize_district()` function definition
2. `district_norm` column additions (nullable, additive)
3. Index creation for performance
4. Backfill of existing data
5. Trigger functions and triggers for auto-population
6. Constraint to prevent self-links in normalized columns

## Notes

- The normalization function is `IMMUTABLE` and `STRICT` for performance and safety
- Triggers ensure `district_norm` is always kept in sync with `district`
- The `geo_district_signals` view was updated to include `district_norm` (aggregated from `geo_sector_signals`)
