# Household Calculation Fix

## Problem

In Validation mode, "Estimated households" did NOT change when the validation strictness slider changed, even though "Districts included" did. This was because:

1. The `useValidationResults` hook always fetched with `minAgreement: 1` (all eligible districts)
2. The API calculated `estimatedHouseholds` based on ALL eligible districts, not the filtered set
3. The frontend filtered `includedDistricts` client-side, but `estimatedHouseholds` was already calculated server-side with the wrong district set

## Solution

### A) Fixed API Hook to Include minAgreement in Query Key

**File**: `src/features/audience-builder/hooks/useValidationResults.ts`

- Added `minAgreement` parameter to the hook
- Included `minAgreement` in the React Query key so results refetch when slider changes
- Pass `minAgreement` to the API call so it filters districts before calculating households

**Before:**
```typescript
queryKey: ['validationResults', segmentKey, providersKey, tvRegionsKey]
queryFn: () => getValidationResults({ segmentKey, minAgreement: 1, ... })
```

**After:**
```typescript
queryKey: ['validationResults', segmentKey, minAgreement, providersKey, tvRegionsKey]
queryFn: () => getValidationResults({ segmentKey, minAgreement, ... })
```

### B) Updated BuildExploreStep to Pass Slider Value

**File**: `src/components/audience-builder/steps/BuildExploreStep.tsx`

- Pass `sliderApplied` (current slider value) to `useValidationResults` as `minAgreement`
- Removed client-side filtering of `includedDistricts` since API now returns the filtered set
- `includedDistricts` now directly uses `validationResults.includedDistricts` (already filtered by minAgreement)

**Before:**
```typescript
const { data: validationResults } = useValidationResults({
  segmentKey,
  // minAgreement always 1
});

const includedDistricts = validationResults.includedDistricts.filter(
  d => d.agreementCount >= sliderApplied // Client-side filter
);
```

**After:**
```typescript
const { data: validationResults } = useValidationResults({
  segmentKey,
  minAgreement: sliderApplied, // Pass current slider value
});

const includedDistricts = validationResults.includedDistricts; // Already filtered by API
```

### C) API Already Correctly Filters Before Calculating Households

**File**: `src/features/audience-builder/api/validationResults.ts`

The API was already correct - it filters `includedDistrictIds` by `minAgreement` before building `includedDistricts`, and then calculates `estimatedHouseholds` from that filtered list. The issue was that the hook was always calling with `minAgreement: 1`.

**Flow:**
1. Filter eligible districts by `minAgreement` → `includedDistrictIds`
2. Fetch centroids for filtered districts → `includedDistricts`
3. Calculate `estimatedHouseholds` from `includedDistricts` (line 353)

### D) Added Sanity Checks and Validation

**Files**: 
- `src/features/audience-builder/api/validationResults.ts`
- `src/features/audience-builder/api/extensionResults.ts`
- `supabase/sanity_households.sql`

**Dev Logging:**
- Log average households per district
- Warn if average is outside expected range (1,000-50,000)
- Log counts of districts with real data vs fallback

**SQL Sanity Checks:**
- Min/max/avg household values
- Spot check specific districts (E1, SW1, M1, etc.)
- Validate no negative or zero values
- Check for suspiciously high values (>200k) that might indicate parsing errors

**Import Script Fix:**
- Strip commas from household values (e.g., "25,000" → 25000)
- Added warning for invalid household values

## Expected Behavior

### Validation Mode
- Moving the validation strictness slider changes BOTH:
  - Districts included (decreases as slider increases)
  - Estimated households (decreases as slider increases)
- Both changes are directionally consistent (stricter = fewer districts and fewer households)
- Household totals reflect the SAME districts shown on the map

### Extension Mode
- Signal threshold changes continue to update estimated households correctly (no regression)
- Uses same household calculation logic with real household sums

## Typical UK Postcode District Household Ranges

- **Typical districts**: 1,000-50,000 households
- **Large urban areas (London)**: 10,000-50,000 households
- **Small rural areas**: 1,000-5,000 households

If averages exceed 100,000, check for:
- Comma parsing issues in CSV import
- Wrong column imported (e.g., TV region households instead of district households)
- Data quality issues in source CSV

## Testing

1. **Validation Mode Slider Test:**
   - Open Validation mode
   - Note initial "Districts included" and "Estimated households"
   - Move slider to higher value (stricter)
   - Verify both numbers decrease
   - Move slider to lower value (less strict)
   - Verify both numbers increase

2. **Sanity Check:**
   - Check browser console for dev logs showing average households per district
   - Run SQL queries from `supabase/sanity_households.sql`
   - Verify average is in expected range (1,000-50,000)

3. **Extension Mode:**
   - Verify signal threshold slider still updates estimated households
   - No regression in extension mode behavior

## Files Changed

- `src/features/audience-builder/hooks/useValidationResults.ts` - Added minAgreement to query key
- `src/components/audience-builder/steps/BuildExploreStep.tsx` - Pass slider value to hook, remove client-side filter
- `src/features/audience-builder/api/validationResults.ts` - Added dev logging and sanity checks
- `src/features/audience-builder/api/extensionResults.ts` - Added dev logging and sanity checks
- `src/scripts/import-district-households.ts` - Strip commas from household values
- `supabase/sanity_households.sql` - Enhanced validation queries
- `DISTRICT_HOUSEHOLDS_README.md` - Added expected ranges and validation notes
