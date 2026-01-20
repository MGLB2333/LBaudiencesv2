-- Quick check: Verify migration 022 status
-- Run this in Supabase SQL editor to check if everything is set up

-- Check if pgcrypto extension exists
SELECT EXISTS(
  SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
) as pgcrypto_exists;

-- Check if tables exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tv_regions') 
    THEN 'EXISTS' ELSE 'MISSING' END as tv_regions_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'district_tv_regions') 
    THEN 'EXISTS' ELSE 'MISSING' END as district_tv_regions_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'district_neighbors') 
    THEN 'EXISTS' ELSE 'MISSING' END as district_neighbors_status;

-- Check if policies exist (should return 6 rows if all policies are there)
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('tv_regions', 'district_tv_regions', 'district_neighbors')
ORDER BY tablename, policyname;
