# Battle Zones Feature

This document describes the Battle Zones feature that visualizes store competition zones on the map based on district-level store presence.

## Overview

Battle Zones classify districts into three categories based on store presence:
- **Owned**: Districts with base brand stores only (no competitors)
- **Contested**: Districts with both base brand and competitor stores
- **Competitor-only**: Districts with competitor stores only (no base brand)

The feature uses district-level logic (not lat/lng drive times) and expands the catchment area using neighbor rings from the `district_neighbors` table.

## Database Schema

### RPC Functions

Two PostgreSQL functions are created in `supabase/migrations/026_battle_zones.sql`:

1. **`get_battle_zones_districts`**: Returns per-district battle zone classifications
   - Inputs: `base_brand`, `competitor_brands[]`, `rings`, `tv_regions[]`
   - Output: Table with `district`, `category`, `base_store_count`, `competitor_store_count`, `competitor_brands_present[]`

2. **`get_battle_zones_summary`**: Returns summary statistics
   - Inputs: Same as above
   - Output: JSONB with totals, counts by category, and top contested districts

### Key Logic

- **Base districts**: Districts containing stores from the base brand (from `store_poi_district` join `store_pois`)
- **Catchment expansion**: Uses recursive CTE to expand by neighbor rings:
  - `rings = 0`: Only base brand districts
  - `rings = 1`: Base districts + immediate neighbors
  - `rings = 2+`: Expanded rings using `district_neighbors`
- **TV region filter**: If `tv_regions` provided, intersects catchment with allowed districts
- **Category classification**:
  - `owned`: `base_store_count > 0 AND competitor_store_count = 0`
  - `contested`: `base_store_count > 0 AND competitor_store_count > 0`
  - `competitor_only`: `base_store_count = 0 AND competitor_store_count > 0`

## Frontend Implementation

### API Module

`src/features/audience-builder/api/battleZones.ts`:
- `getBattleZoneDistricts(options)`: Calls RPC to get district classifications
- `getBattleZoneSummary(options)`: Calls RPC to get summary stats

### React Query Hooks

`src/features/audience-builder/hooks/useBattleZones.ts`:
- `useBattleZoneDistricts(options, enabled)`: Fetches district data
- `useBattleZoneSummary(options, enabled)`: Fetches summary data
- Stable query keys prevent unnecessary refetches

### State Management

Battle zones state is stored in `BuilderContext`:
- `battleZonesEnabled`: boolean
- `battleZoneBaseBrand`: string
- `battleZoneCompetitorBrands`: string[]
- `battleZoneRings`: number (0-4)

Defaults:
- `enabled`: false
- `baseBrand`: 'Magnet' if present, otherwise first brand
- `competitorBrands`: ['Howdens', 'Wren', 'Wickes'] if present

### UI Component

`src/components/audience-builder/steps/BattleZonesSection.tsx`:
- Enable/disable toggle
- Base brand dropdown (populated from `getPoiBrands()`)
- Competitor brands multi-select (chips)
- Rings slider (0-4) with draft/applied pattern
- Summary box showing:
  - Total catchment districts
  - Counts by category (owned/contested/competitor-only)
  - Store counts (base vs competitor)
  - Top 5 contested districts table

### Sidebar Integration

BattleZonesSection is integrated into:
- `ValidationSidebar` (validation mode)
- `ExtensionSidebar` (extension mode)

Placed after the Store POIs section, before other filters.

## Map Overlay (TODO)

The map overlay rendering is the final piece to implement. When battle zones are enabled:

1. **District Mode**: Style district markers based on category:
   - **Owned**: Light grey fill (opacity 0.15), solid border
   - **Contested**: Medium grey fill (opacity 0.35), thicker border
   - **Competitor-only**: Medium-light grey fill (opacity 0.25), dashed border

2. **Hex Mode**: Render battle zone districts as point markers on top of hexes (MVP approach)

3. **Tooltips**: Show district code, category, store counts, and competitor brands (up to 3, "+N more")

### Implementation Notes

- Battle zones overlay should be additive - existing district/hex overlays still work
- Use grey-only styling (no colors) with opacity/line weight/dash patterns
- Update styles imperatively to avoid render storms
- Only update when battle zones data changes (memoize)

## Usage

### Enable Battle Zones

1. Navigate to Audience Builder → Map step
2. In the sidebar, find "Battle Zones" section
3. Toggle "Enable battle zones" on
4. Select base brand (defaults to Magnet if available)
5. Select competitor brands (defaults to Howdens/Wren/Wickes if available)
6. Adjust neighbor rings slider (0-4)
7. Map will update to show battle zone classifications

### Understanding Rings

- **0 rings**: Only districts with base brand stores
- **1 ring**: Base districts + their immediate neighbors
- **2+ rings**: Expanded catchment using neighbor relationships

### TV Region Filter

Battle zones respect the TV region filter:
- If TV regions are selected, only districts within those regions are included in the catchment
- The intersection is computed: `catchment AND tvRegionAllowed`

## SQL Sanity Checks

### Verify Battle Zone Districts Have Centroids

```sql
-- Check sample battle districts exist in geo_districts with centroids
SELECT 
  b.district,
  gd.centroid_lat,
  gd.centroid_lng
FROM (
  SELECT DISTINCT district 
  FROM store_poi_district 
  LIMIT 20
) b
LEFT JOIN geo_districts gd ON gd.district = b.district
WHERE gd.centroid_lat IS NOT NULL AND gd.centroid_lng IS NOT NULL;

-- Count districts with centroids vs total
SELECT 
  COUNT(DISTINCT spd.district) as total_districts,
  COUNT(DISTINCT CASE WHEN gd.centroid_lat IS NOT NULL AND gd.centroid_lng IS NOT NULL THEN spd.district END) as districts_with_centroids
FROM store_poi_district spd
LEFT JOIN geo_districts gd ON gd.district = spd.district;
```

### Count Stores by Brand

```sql
SELECT brand, COUNT(*) as count
FROM store_pois
WHERE source = 'osm'
GROUP BY brand
ORDER BY count DESC;
```

### Count District Mappings

```sql
SELECT COUNT(*) 
FROM store_poi_district;
```

### Test Battle Zones RPC

```sql
-- Example: Magnet vs competitors, 1 ring, no TV filter
SELECT * FROM get_battle_zones_districts(
  'Magnet',
  ARRAY['Howdens', 'Wren', 'Wickes'],
  1,
  NULL
)
LIMIT 20;

-- Get summary
SELECT * FROM get_battle_zones_summary(
  'Magnet',
  ARRAY['Howdens', 'Wren', 'Wickes'],
  1,
  NULL
);
```

### Verify Neighbor Relationships

```sql
-- Check district_neighbors table has data
SELECT COUNT(*) FROM district_neighbors;

-- Sample neighbors for a district
SELECT * FROM district_neighbors 
WHERE district = 'AL1'
LIMIT 10;
```

## Performance Considerations

- Battle zones queries use recursive CTEs which can be expensive for large ring counts
- React Query caching (30s stale time) prevents unnecessary refetches
- Draft/applied slider pattern prevents query spam while dragging
- Map overlay updates should be imperative (not reactive) to avoid render storms

## Troubleshooting

### No Battle Zones Showing

1. Verify stores are imported: `SELECT COUNT(*) FROM store_pois WHERE brand = 'Magnet';`
2. Verify district mappings exist: `SELECT COUNT(*) FROM store_poi_district;`
3. Check RPC function exists: `SELECT proname FROM pg_proc WHERE proname = 'get_battle_zones_districts';`
4. Test RPC directly in Supabase SQL editor

### Incorrect Categories

1. Verify store_poi_district mappings are correct
2. Check that base brand and competitor brands are correctly specified
3. Ensure district_neighbors table has data for ring expansion

### Performance Issues

1. Reduce ring count (fewer rings = faster query)
2. Apply TV region filter to narrow catchment
3. Check if district_neighbors table is indexed

## Future Enhancements

- Hex aggregation for battle zones (currently point-based in hex mode)
- Distance-based expansion (using actual distances from district_neighbors)
- Multiple base brands support
- Export battle zones data
- Historical comparison (battle zones over time)
