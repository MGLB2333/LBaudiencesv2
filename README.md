# Audience Builder MVP

A full-stack web application for building and managing target audiences, built with Next.js, TypeScript, Material UI, and Supabase.

<!-- Deployment trigger -->

## Features

- **5-Step Workflow**: Complete audience building process from details to export
- **Authentication**: Email/password authentication with Supabase
- **Row-Level Security**: All data is protected with RLS policies
- **Real-time Persistence**: All changes are saved automatically
- **Map Visualization**: Interactive map with heat layers and POI support
- **Export Functionality**: Export audiences as CSV or GeoJSON to Supabase Storage

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: Material UI (MUI)
- **Forms**: react-hook-form + zod
- **State Management**: TanStack Query
- **Backend**: Supabase (Auth, Database, Storage)
- **Maps**: Leaflet + react-leaflet

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_for_server_side
```

### 3. Run Database Migrations

1. Go to your Supabase dashboard → SQL Editor
2. Run migrations in order:
   - `supabase/migrations/001_initial_schema.sql` (creates tables, indexes, and RLS policies)
   - `supabase/migrations/002_hardening.sql` (adds security hardening, constraints, and storage policies)
   - `supabase/migrations/003_signal_modeling.sql` (signal modeling tables)
   - `supabase/migrations/004_segment_library.sql` (segment library for Extension mode)
   - `supabase/migrations/005_segment_audit.sql` (segment audit metadata)
   - `supabase/migrations/006_construction_last_run.sql` (construction tracking)
   - `supabase/migrations/007_recommended_segments.sql` (recommended segments)
   - `supabase/migrations/008_geo_agreement.sql` (geo agreement fields)
   - `supabase/migrations/009_validation_slider.sql` (validation slider settings)
   - `supabase/migrations/010_geo_districts.sql` (UK postcode districts)
   - `supabase/migrations/011_geo_audience_signals.sql` (provider-level signals)
   - `supabase/migrations/012_provider_segment_aliases.sql` (provider segment label mappings)
   - `supabase/migrations/013_geo_sector_signals.sql` (CSV-based sector signals table and view)
3. Verify all policies are enabled (see HARDENING.md for details)

### 4. Create Storage Bucket

1. Go to Supabase dashboard → Storage
2. Create a new bucket named `audience-exports`
3. Set it to **Private** (not public)
4. Storage policies are automatically created by `002_hardening.sql` migration
5. Verify policies exist in Storage → Policies for `audience-exports` bucket

### 5. Import Real UK Postcode District Centroids (REQUIRED for Validation Mode)

**IMPORTANT**: The app now uses **real UK postcode districts** from `district_latLong.csv`. Synthetic districts (D0001-style) are disabled by default.

#### Step 1: Run Migration 016

1. Go to Supabase dashboard → SQL Editor
2. Run `supabase/migrations/016_real_geo_districts.sql`
3. This creates/updates the `geo_districts` table with proper schema

#### Step 2: Import District Centroids

1. Ensure `district_latLong.csv` is in the project root directory
2. Run the import script:

```bash
npm run db:import-district-centroids
```

This will:
- Read `district_latLong.csv` (~3114 rows)
- Normalize district codes (uppercase, no spaces)
- Validate coordinates (UK bounds: lat 49-61, lng -9 to 3)
- Upsert into `geo_districts` table

**Expected output**:
- ~3114 districts imported
- Bounds: lat ~49-61, lng ~-9 to 3
- Source: `district_latLong.csv`

#### Step 3: Verify Import

Run sanity checks in Supabase SQL Editor (see `supabase/sanity_real_geo.sql`):

```sql
-- Count districts
SELECT count(*) FROM geo_districts; -- Should be ~3114

-- Check bounds
SELECT min(centroid_lat), max(centroid_lat), min(centroid_lng), max(centroid_lng) 
FROM geo_districts;
```

### 6. Import Partner CSV Data (Required for Validation Mode)

After importing real districts, import partner segment data:

```bash
# Import CCS "Home movers" data
npm run db:import-segment-geo -- --file ./outra_justmoved.csv --provider CCS --segmentKey home_movers --providerLabel "Home movers"

# Import other providers (example)
npm run db:import-segment-geo -- --file ./Captify_buying_home.csv --provider Captify --segmentKey home_movers --providerLabel "Buying home"
npm run db:import-segment-geo -- --file ./kogenta_moving_house.csv --provider Kogenta --segmentKey home_movers --providerLabel "Moving house"
npm run db:import-segment-geo -- --file ./starcount_buying_home.csv --provider Starcount --segmentKey home_movers --providerLabel "Buying home"
```

This populates `geo_sector_signals` and the `geo_district_signals` view.

**Note**: Synthetic district seeding is **disabled by default**. To enable synthetic data (for testing only), set `USE_SYNTHETIC_GEO=true`:

```bash
USE_SYNTHETIC_GEO=true npm run db:seed-districts
```

**⚠️ WARNING**: Synthetic seeding will overwrite real districts. Only use for testing.

### 7. Rebuild Geo Districts from Signals (DEPRECATED - Use Real Centroids Instead)

**IMPORTANT**: After importing CSV files, you must rebuild `geo_districts` from the real postcode districts in `geo_district_signals`. This ensures `geo_districts` contains actual district codes (AB12, AL1, B1) instead of synthetic ones (D0001).

**Run the migration:**
```sql
-- In Supabase SQL Editor, run:
-- supabase/migrations/015_rebuild_geo_districts_from_signals.sql
```

This migration will:
- Normalize district codes in both tables (trim, upper, remove spaces)
- Rebuild `geo_districts` from distinct districts in `geo_district_signals`
- Generate deterministic UK-bounded centroids for each district
- Ensure 1:1 join between `geo_district_signals` and `geo_districts`

**Verify the rebuild:**
```sql
-- Check district codes are real postcodes (not D0001...)
SELECT district, centroid_lat, centroid_lng
FROM geo_districts
ORDER BY district
LIMIT 20;
-- Expected: AB12, AL1, B1, etc.

-- Check missing joins (should be 0)
SELECT count(*) as missing_join_count
FROM (
  SELECT DISTINCT s.district
  FROM geo_district_signals s
  LEFT JOIN geo_districts d ON d.district = s.district
  WHERE s.segment_key='home_movers' AND d.district IS NULL
) x;
-- Expected: 0
```

**Optional: Sync script for future updates**
```bash
# After importing new CSV files, sync districts:
npm run db:sync-districts
```

### 6. Import CSV Segment Data (CSV-Based Validation)

For CSV-based validation (recommended), import provider CSV files:

```bash
# Import CCS "Home movers" from CSV file
npm run db:import-segment-geo -- --file /mnt/data/outra_justmoved.csv --provider CCS --segmentKey home_movers --providerLabel "Home movers"
```

**CSV Format Requirements:**
- Must have `Sector` (or `sector`, `postcode_sector`) column
- Must have `District` (or `district`, `postcode_district`) column
- Optional: `Index` or `score` column (0-100, normalized to 0.0-1.0)
- Sector codes are normalized (e.g., "AL11" → "AL1 1")

**Import Command Format:**
```bash
npm run db:import-segment-geo -- --file <path> --provider <name> --segmentKey <key> [--providerLabel <label>]
```

**Example for multiple providers:**
```bash
# CCS (base universe)
npm run db:import-segment-geo -- --file /mnt/data/ccs_home_movers.csv --provider CCS --segmentKey home_movers --providerLabel "Home movers"

# Other providers (validating)
npm run db:import-segment-geo -- --file /mnt/data/experian_home_movers.csv --provider Experian --segmentKey home_movers --providerLabel "Home movers"
npm run db:import-segment-geo -- --file /mnt/data/ons_home_movers.csv --provider ONS --segmentKey home_movers --providerLabel "Home movers"
```

#### Verify Geo Data Seeding

After seeding, run these SQL queries in Supabase SQL Editor to verify the data:

**See `supabase/sanity.sql` for comprehensive geometry structure checks.**

Quick verification:

**1. Count districts (should be exactly 3000):**
```sql
select count(*) from geo_districts;
-- Expected: 3000
```

**2. Check geometry structure and first coordinate (should be [lng, lat]):**
```sql
select 
  district, 
  (geometry->'coordinates'->0->0->>0)::float as first_lng, 
  (geometry->'coordinates'->0->0->>1)::float as first_lat
from geo_districts
where geometry is not null
limit 5;
```

**3. Check UK bounds from all polygon points (should be within UK bbox):**
```sql
with pts as (
  select 
    (p->>0)::double precision as lng, 
    (p->>1)::double precision as lat
  from geo_districts d
  cross join lateral jsonb_array_elements(d.geometry->'coordinates'->0) p
)
select 
  min(lng) min_lng, 
  max(lng) max_lng, 
  min(lat) min_lat, 
  max(lat) max_lat 
from pts;
-- Expected: min_lng ~-8.6, max_lng ~1.9, min_lat ~50.7, max_lat ~59.5
```

**4. Check sector signals for CSV-based validation:**
```sql
-- Count sector signals per provider/segment
select segment_key, provider, count(*) as sector_rows, count(distinct district) as distinct_districts
from geo_sector_signals
where segment_key='home_movers'
group by segment_key, provider
order by segment_key, provider;
```

**5. Check district aggregation (from view):**
```sql
-- View district-level aggregation
select segment_key, provider, count(*) as district_rows, 
  count(*) filter (where has_score) as districts_with_score,
  avg(district_score_norm) filter (where has_score) as avg_score_norm
from geo_district_signals
where segment_key='home_movers'
group by segment_key, provider
order by segment_key, provider;
```

**6. Check eligible districts and agreement distribution:**
```sql
-- CCS eligible districts (base universe)
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
-- Should show distribution across 0-N providers
```

### 6. Seed Demo Audience (Optional)

```bash
npm run db:seed
```

This creates a demo audience with sample segments and geo data.

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes (exports, seed)
│   ├── audiences/         # Audience list and builder pages
│   ├── login/             # Login page
│   └── signup/            # Signup page
├── components/
│   ├── audience-builder/  # Builder step components
│   ├── audiences/         # Audience list components
│   ├── layout/            # Layout components
│   ├── ErrorBoundary.tsx  # Error boundary wrapper
│   └── LoadingSkeleton.tsx # Loading state components
├── features/
│   └── audience-builder/
│       ├── api/           # API functions
│       ├── hooks/         # TanStack Query hooks
│       ├── providers/     # Provider adapter layer
│       │   ├── types.ts   # Provider interfaces
│       │   ├── registry.ts # Provider registry
│       │   └── mock/      # Mock providers (CCS, ONS, etc.)
│       └── services/      # Service layer (orchestration)
└── lib/
    ├── supabase/          # Supabase client helpers
    ├── types.ts           # TypeScript types
    └── logger.ts          # Logger utility
```

## Database Schema

### Tables

- **audiences**: Main audience records
- **audience_segments**: Selected segments (primary/secondary)
- **audience_profile_settings**: Profile settings and derived stats
- **audience_construction_settings**: Construction mode and validation settings
- **geo_units**: Geographic units (H3/postcode sectors)
- **geo_districts**: UK postcode districts (base geography)
- **geo_audience_signals**: Provider-level signals by district and audience
- **segment_library**: Segment library for Extension mode suggestions
- **provider_segment_aliases**: Provider-specific segment label mappings
- **poi_layers**: Points of interest layers
- **exports**: Export history

All tables have RLS policies ensuring users can only access their own data.

## Features by Step

### Step 1: Audience Details
- Name, description, target reach
- Start/end dates
- Optional budget

### Step 2: Segments
- Construction mode toggle (Validation/Extension)
- Primary/secondary audience segments
- Add/remove segments
- Provider information

### Step 3: Audience Profile
- Combined segment view
- Accuracy ↔ Scale slider
- Derived audience size
- Confidence breakdown

### Step 4: Map
- Interactive map with heat visualization
- POI layer management
- Primary/secondary toggle
- AND/OR logic

### Step 5: Export
- Export to CSV or GeoJSON
- Export history
- Download previous exports
- A/B test mode toggle

## Development

### Type Safety

The project uses TypeScript with generated types from Supabase. If you modify the database schema, regenerate types:

```bash
npx supabase gen types typescript --project-id your-project-id > src/lib/supabase/database.types.ts
```

### Adding New Features

1. Create API functions in `src/features/audience-builder/api/`
2. Create hooks in `src/features/audience-builder/hooks/`
3. Build UI components in `src/components/`
4. Add routes in `src/app/`

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables

Make sure to set these in your deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for seed script only)

## Security Notes

- All database queries use RLS policies
- Storage bucket is private with authenticated access only
- No PII is stored (aggregated geo data only)
- Exports use signed URLs with expiration

## Security & Hardening

See [HARDENING.md](./HARDENING.md) for:
- Security improvements and RLS policy details
- Storage policy configuration
- Provider adapter architecture
- How to add new providers
- Testing RLS & storage access

## Adding a New Provider

1. Create provider class in `src/features/audience-builder/providers/mock/`
2. Implement `ProviderAdapter` interface
3. Register in `src/features/audience-builder/providers/registry.ts`
4. For real providers, replace mock logic with API calls

See HARDENING.md for detailed instructions.

## License

MIT
