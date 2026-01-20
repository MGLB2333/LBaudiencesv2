# Store POIs Feature

This document describes the Store POI dataset feature that allows users to search for stores by brand, select them, and see them appear on the map.

## Overview

The Store POI feature provides:
- Manual store dataset with brand, name, location (lat/lng)
- Automatic nearest district mapping using haversine distance
- Search by brand/name with debounced input
- Map markers showing exact store locations
- District highlighting for districts containing POIs

## Database Schema

### Tables

1. **store_pois**: Stores POI data
   - `id` (UUID, PK)
   - `brand` (TEXT, required) - e.g., "Tesco", "IKEA", "Magnet"
   - `name` (TEXT, required) - Display name
   - `address`, `city`, `postcode` (TEXT, nullable)
   - `lat`, `lng` (DOUBLE PRECISION, required)
   - `website_url`, `notes` (TEXT, nullable)
   - `source` (TEXT, default 'manual') - Source of data: 'manual', 'osm', or other
   - `osm_type` (TEXT, nullable) - OSM element type: 'node', 'way', or 'relation'
   - `osm_id` (BIGINT, nullable) - OSM element ID
   - `created_at` (TIMESTAMPTZ)
   - Unique constraint on `(source, osm_type, osm_id)` for OSM-sourced POIs

2. **store_poi_district**: Derived mapping of POIs to nearest districts
   - `poi_id` (UUID, PK, FK -> store_pois.id)
   - `district` (TEXT, required) - geo_districts.district
   - `distance_km` (DOUBLE PRECISION, required)
   - `created_at` (TIMESTAMPTZ)

### Functions

- `haversine_distance(lat1, lng1, lat2, lng2)`: Calculates distance in km between two lat/lng points
- `find_nearest_district(poi_lat, poi_lng)`: Finds the nearest postcode district to a POI
- `upsert_poi_district(poi_id)`: Automatically computes and stores nearest district mapping

### Triggers

- `trigger_store_pois_upsert_district`: Automatically updates district mapping when POI lat/lng changes

## Setup

### 1. Run Migration

Apply the migration in Supabase:

```bash
# Via Supabase CLI
supabase migration up

# Or manually in Supabase dashboard
# Run: supabase/migrations/024_store_pois.sql
```

### 2. Run OSM Keys Migration (for Overpass imports)

If you plan to import POIs from OpenStreetMap, run the additional migration:

```bash
# Run: supabase/migrations/025_store_pois_osm_keys.sql
```

This adds `osm_type`, `osm_id`, and `source` columns for tracking OSM-sourced POIs.

### 3. Seed Sample Data

Run the seed script to insert 5 sample stores:

```bash
npm run db:seed:pois
```

This will insert:
- IKEA Wembley
- Tesco Extra Kingston
- Wickes Croydon
- B&Q Wandsworth
- Magnet Harrow

After insertion, the trigger automatically computes nearest district mappings.

### 4. Import Magnet Stores from OpenStreetMap

Import all Magnet store locations from OSM using Overpass API:

```bash
npm run db:import:pois:magnet
```

This will:
- Query Overpass API for all Magnet stores in the UK
- Filter results to likely Magnet showrooms
- Upsert into `store_pois` with OSM metadata
- Automatically trigger district mapping for each POI

**Note**: Requires district centroids to be imported first:
```bash
npm run db:import-district-centroids
```

### 5. Import Competitor Stores from OpenStreetMap

Import top competitor brands (Howdens, Wren Kitchens, Wickes) from OSM:

```bash
npm run db:import:pois:competitors
```

This will:
- Query Overpass API for Howdens, Wren Kitchens, and Wickes stores in the UK
- Filter results using brand-specific heuristics
- Upsert into `store_pois` with OSM metadata (`raw_name`, `tags` JSONB)
- Automatically trigger district mapping for each POI
- Print detailed summary per brand (inserted, updated, skipped, mapped)

**Note**: Requires district centroids to be imported first:
```bash
npm run db:import-district-centroids
```

**Brand Details**:
- **Howdens**: Matches "Howdens" or "Howdens Joinery" in name/brand/operator
- **Wren**: Prefers "Wren Kitchens" but accepts "Wren" with kitchen-related tags
- **Wickes**: Matches "Wickes" in name/brand/operator

The import script saves raw Overpass responses to `tmp/{brand}_overpass.json` for debugging.

## Sanity Checks

Run these SQL queries in Supabase to verify the setup:

### Count Records

```sql
-- Count POIs
SELECT COUNT(*) FROM store_pois;

-- Count district mappings
SELECT COUNT(*) FROM store_poi_district;
```

### Verify Mappings

```sql
-- Show POIs with their nearest districts
SELECT 
  p.brand,
  p.name,
  p.postcode,
  d.district,
  d.distance_km
FROM store_pois p
JOIN store_poi_district d ON d.poi_id = p.id
ORDER BY p.brand, p.name;
```

### Test Nearest District Function

```sql
-- Test with a sample location (London)
SELECT * FROM find_nearest_district(51.5074, -0.1278);
```

### Check Trigger Works

```sql
-- Insert a test POI and verify mapping is created
INSERT INTO store_pois (brand, name, lat, lng)
VALUES ('Test', 'Test Store', 51.5074, -0.1278)
RETURNING id;

-- Check mapping was created (use the ID from above)
SELECT * FROM store_poi_district WHERE poi_id = '<id-from-above>';
```

### Magnet Store Sanity Checks

After importing Magnet stores from OSM:

```sql
-- Count Magnet POIs
SELECT COUNT(*) FROM store_pois WHERE LOWER(brand) = 'magnet';

-- Count Magnet district mappings
SELECT COUNT(*) 
FROM store_poi_district d 
JOIN store_pois p ON p.id = d.poi_id 
WHERE LOWER(p.brand) = 'magnet';

-- Top 20 Magnet stores by distance to nearest district
SELECT 
  p.name, 
  p.postcode, 
  d.district, 
  ROUND(d.distance_km::numeric, 2) AS km
FROM store_poi_district d 
JOIN store_pois p ON p.id = d.poi_id
WHERE LOWER(p.brand) = 'magnet'
ORDER BY d.distance_km ASC 
LIMIT 20;

-- Magnet stores by source
SELECT source, COUNT(*) 
FROM store_pois 
WHERE LOWER(brand) = 'magnet'
GROUP BY source;
```

### Competitor Store Sanity Checks

After importing competitor stores:

```sql
-- Counts by brand
SELECT brand, COUNT(*) as count
FROM store_pois
WHERE brand IN ('Howdens', 'Wren', 'Wickes')
GROUP BY brand
ORDER BY count DESC;

-- Verify OSM unique index prevents duplicates
SELECT source, osm_type, osm_id, COUNT(*) as duplicates
FROM store_pois
WHERE source = 'osm' AND osm_type IS NOT NULL AND osm_id IS NOT NULL
GROUP BY source, osm_type, osm_id
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- District mappings for competitors
SELECT 
  p.brand,
  COUNT(DISTINCT p.id) as pois,
  COUNT(DISTINCT d.district) as districts_covered
FROM store_pois p
LEFT JOIN store_poi_district d ON d.poi_id = p.id
WHERE p.brand IN ('Howdens', 'Wren', 'Wickes')
GROUP BY p.brand;

-- Sample competitor stores with mappings
SELECT 
  p.brand,
  p.name,
  p.postcode,
  d.district,
  ROUND(d.distance_km::numeric, 2) AS km
FROM store_pois p
JOIN store_poi_district d ON d.poi_id = p.id
WHERE p.brand IN ('Howdens', 'Wren', 'Wickes')
ORDER BY p.brand, p.name
LIMIT 20;
```

## Usage

### In the UI

1. Navigate to the Audience Builder → Map step
2. In the sidebar, find the "Store POIs" section
3. Type a brand name (e.g., "Tes") in the search box
4. Click "Add" next to a store in the results
5. The store will:
   - Appear in the selected list with nearest district info
   - Show a marker on the map at its exact location
   - Highlight the nearest district (if in district mode)

### API Usage

```typescript
import { searchPoisByBrand, getPoiDistrictMap } from '@/features/audience-builder/api/storePois';

// Search for POIs
const pois = await searchPoisByBrand({ brandQuery: 'Tesco', limit: 20 });

// Get district mappings
const mappings = await getPoiDistrictMap(['poi-id-1', 'poi-id-2']);
```

## Map Integration

### POI Markers

- Always visible on the map (separate layer)
- Grey circle markers at exact lat/lng coordinates
- Tooltip shows brand and name

### District Highlighting

- When in "district" overlay mode:
  - Districts containing POIs are highlighted with orange border (`#ff6b00`)
  - Slightly larger radius
  - Tooltip includes store names

### Performance

- POI markers are memoized by POI IDs
- Layer updates don't remount the map container
- District highlighting is computed during marker creation

## Notes

- **Additive Only**: This feature does not modify existing tables or logic
- **No PostGIS Required**: Uses simple haversine distance calculation
- **Automatic Mapping**: District mappings are computed automatically via trigger
- **State Management**: Selected POIs are stored in BuilderContext and persist across mode switches

## Troubleshooting

### POI Not Showing on Map

1. Verify POI has valid lat/lng coordinates
2. Check that district mapping was created (query `store_poi_district`)
3. Ensure POI is in `state.selectedPoiIds` in BuilderContext

### District Mapping Missing

1. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_store_pois_upsert_district';`
2. Manually run: `SELECT upsert_poi_district('<poi-id>');`
3. Verify `geo_districts` has centroids for the POI's location area

### Search Not Working

1. Check RLS policies allow authenticated users to read `store_pois`
2. Verify indexes exist: `SELECT * FROM pg_indexes WHERE tablename = 'store_pois';`
3. Test query directly: `SELECT * FROM store_pois WHERE brand ILIKE '%tes%';`
