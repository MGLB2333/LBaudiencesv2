-- Verify agreement distribution for home_movers segment
-- This matches what validationResults.ts calculates

-- 1. Count districts by agreement level (how many providers agree)
-- This should match the agreementDistribution in the console logs
WITH base_universe AS (
  -- CCS eligible districts (base universe)
  SELECT DISTINCT district
  FROM geo_district_signals
  WHERE segment_key = 'home_movers'
    AND provider = 'CCS'
    AND sectors_count > 0
    AND (has_score = false OR district_score_norm >= 0.5)
),
provider_agreement AS (
  -- For each eligible district, count how many validating providers agree
  SELECT 
    b.district,
    COUNT(DISTINCT CASE 
      WHEN s.provider != 'CCS' 
        AND s.sectors_count > 0
        AND (s.has_score = false OR s.district_score_norm >= 0.5)
      THEN s.provider 
    END) as agreeing_providers_count
  FROM base_universe b
  LEFT JOIN geo_district_signals s 
    ON s.district = b.district 
    AND s.segment_key = 'home_movers'
    AND s.provider != 'CCS'
  GROUP BY b.district
)
SELECT 
  agreeing_providers_count,
  COUNT(*) as district_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM provider_agreement
GROUP BY agreeing_providers_count
ORDER BY agreeing_providers_count;

-- Expected output:
-- agreeing_providers_count | district_count | percentage
-- 0                       | X              | Y%
-- 1                       | X              | Y%
-- 2                       | X              | Y%
-- 3                       | 179            | ~16% (if this matches what you see)

-- 2. Verify total eligible districts
SELECT COUNT(DISTINCT district) as total_eligible_districts
FROM geo_district_signals
WHERE segment_key = 'home_movers'
  AND provider = 'CCS'
  AND sectors_count > 0
  AND (has_score = false OR district_score_norm >= 0.5);
-- Expected: ~1090 (should match "Signals districts: 1090" in UI)

-- 3. Verify districts with all 3 providers agreeing
WITH base_universe AS (
  SELECT DISTINCT district
  FROM geo_district_signals
  WHERE segment_key = 'home_movers'
    AND provider = 'CCS'
    AND sectors_count > 0
    AND (has_score = false OR district_score_norm >= 0.5)
),
provider_agreement AS (
  SELECT 
    b.district,
    COUNT(DISTINCT CASE 
      WHEN s.provider != 'CCS' 
        AND s.sectors_count > 0
        AND (s.has_score = false OR s.district_score_norm >= 0.5)
      THEN s.provider 
    END) as agreeing_providers_count
  FROM base_universe b
  LEFT JOIN geo_district_signals s 
    ON s.district = b.district 
    AND s.segment_key = 'home_movers'
    AND s.provider != 'CCS'
  GROUP BY b.district
)
SELECT COUNT(*) as districts_with_all_3_providers
FROM provider_agreement
WHERE agreeing_providers_count = 3;
-- Expected: 179 (should match "Included: 179" when slider is at 3)

-- 4. Sample districts with all 3 providers agreeing
WITH base_universe AS (
  SELECT DISTINCT district
  FROM geo_district_signals
  WHERE segment_key = 'home_movers'
    AND provider = 'CCS'
    AND sectors_count > 0
    AND (has_score = false OR district_score_norm >= 0.5)
),
provider_agreement AS (
  SELECT 
    b.district,
    COUNT(DISTINCT CASE 
      WHEN s.provider != 'CCS' 
        AND s.sectors_count > 0
        AND (s.has_score = false OR s.district_score_norm >= 0.5)
      THEN s.provider 
    END) as agreeing_providers_count
  FROM base_universe b
  LEFT JOIN geo_district_signals s 
    ON s.district = b.district 
    AND s.segment_key = 'home_movers'
    AND s.provider != 'CCS'
  GROUP BY b.district
)
SELECT district, agreeing_providers_count
FROM provider_agreement
WHERE agreeing_providers_count = 3
ORDER BY district
LIMIT 20;
