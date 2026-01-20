# CSV Import Guide for Validation Mode

This guide explains how to import provider CSV files for CSV-based validation.

## Quick Start

### 1. Run Migration

First, ensure the `geo_sector_signals` table exists:

```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/013_geo_sector_signals.sql
```

### 2. Import CCS Anchor File

Import the CCS "Home movers" file (treating it as provider=CCS):

```bash
npm run db:import-segment-geo -- --file /mnt/data/outra_justmoved.csv --provider CCS --segmentKey home_movers --providerLabel "Home movers"
```

### 3. Verify Import

Run this SQL query to verify:

```sql
-- Count sector signals
select count(*) from geo_sector_signals where segment_key='home_movers' and provider='CCS';

-- Count distinct districts
select count(distinct district) from geo_sector_signals where segment_key='home_movers' and provider='CCS';

-- Check district aggregation
select count(*) from geo_district_signals where segment_key='home_movers' and provider='CCS';
```

## CSV Format

Your CSV file must have these columns (case-insensitive):

**Required:**
- `Sector` (or `sector`, `postcode_sector`) - Postcode sector code
- `District` (or `district`, `postcode_district`) - Postcode district code

**Optional:**
- `Index` (or `index`, `Score`, `score`) - Score value (0-100, will be normalized to 0.0-1.0)

**Example CSV:**
```csv
Sector,District,Index
AL1 1,AL1,75
AL1 2,AL1,82
SW1A 1,SW1A,90
```

## Import Command

```bash
npm run db:import-segment-geo -- --file <path> --provider <name> --segmentKey <key> [--providerLabel <label>]
```

**Parameters:**
- `--file`: Path to CSV file
- `--provider`: Provider name (e.g., "CCS", "Experian", "ONS")
- `--segmentKey`: Canonical segment key (e.g., "home_movers")
- `--providerLabel`: Optional provider-specific label (defaults to segmentKey)

**Examples:**

```bash
# CCS base universe
npm run db:import-segment-geo -- --file /mnt/data/ccs_home_movers.csv --provider CCS --segmentKey home_movers --providerLabel "Home movers"

# Validating providers
npm run db:import-segment-geo -- --file /mnt/data/experian_home_movers.csv --provider Experian --segmentKey home_movers --providerLabel "Home movers"
npm run db:import-segment-geo -- --file /mnt/data/ons_home_movers.csv --provider ONS --segmentKey home_movers --providerLabel "Home movers"
npm run db:import-segment-geo -- --file /mnt/data/twentyci_home_movers.csv --provider TwentyCI --segmentKey home_movers --providerLabel "Home movers"
npm run db:import-segment-geo -- --file /mnt/data/outra_home_movers.csv --provider Outra --segmentKey home_movers --providerLabel "Home movers"
```

## How It Works

1. **Sector-level storage**: CSV rows are stored in `geo_sector_signals` table (one row per sector)
2. **District aggregation**: The `geo_district_signals` view aggregates sectors to districts:
   - `sectors_count`: Number of sectors in the district
   - `district_score_avg`: Average score (if scores present)
   - `district_score_norm`: Average normalized score (0.0-1.0)
   - `has_score`: Whether any sector has a score
3. **Validation logic**: 
   - Eligible districts = CCS has presence AND (if has_score) score_norm >= 0.5
   - Provider agrees = provider has presence AND (if has_score) score_norm >= 0.5
   - Included districts = eligible districts where agreeing providers >= minAgreement

## SQL Verification Queries

After importing, verify with these queries:

```sql
-- 1. Total sector signals for home_movers
select segment_key, provider, count(*) as sector_rows, count(distinct district) as distinct_districts
from geo_sector_signals
where segment_key='home_movers'
group by segment_key, provider
order by segment_key, provider;

-- 2. District-level aggregation sample
select segment_key, provider, district, sectors_count, district_score_norm, has_score
from geo_district_signals
where segment_key='home_movers' and provider='CCS'
limit 10;

-- 3. Eligible districts count (CCS base universe)
select count(*) as eligible_districts
from geo_district_signals
where segment_key='home_movers' 
  and provider='CCS'
  and sectors_count > 0
  and (has_score = false OR district_score_norm >= 0.5);

-- 4. Agreement distribution
with eligible as (
  select district
  from geo_district_signals
  where segment_key='home_movers' 
    and provider='CCS'
    and sectors_count > 0
    and (has_score = false OR district_score_norm >= 0.5)
),
prov_agreement as (
  select 
    e.district,
    count(*) filter (
      where p.sectors_count > 0 
      and (p.has_score = false OR p.district_score_norm >= 0.5)
    ) as agreeing_providers
  from eligible e
  left join geo_district_signals p 
    on p.segment_key='home_movers' 
    and p.district=e.district
    and p.provider<>'CCS'
  group by e.district
)
select agreeing_providers, count(*) as districts
from prov_agreement
group by agreeing_providers
order by agreeing_providers;
```

## Troubleshooting

**Error: "Could not find Sector column"**
- Check your CSV has a column named `Sector`, `sector`, `postcode_sector`, or `Postcode Sector`
- Column names are case-insensitive

**Error: "Could not find District column"**
- Check your CSV has a column named `District`, `district`, `postcode_district`, or `Postcode District`

**Low district counts after import**
- Check that sectors are being normalized correctly (e.g., "AL11" → "AL1 1")
- Verify district codes match existing `geo_districts` table
- Check for duplicate sectors (will be upserted, not duplicated)

**No eligible districts**
- Verify CCS has sectors_count > 0
- If scores present, verify district_score_norm >= 0.5
- Check that district codes match `geo_districts.district` values
