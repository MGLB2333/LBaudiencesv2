# Security Hardening & Migration Guide

This document describes the security improvements and hardening changes made to the Audience Builder MVP.

## Migration Files

### 001_initial_schema.sql
Initial database schema with tables, RLS policies, and basic indexes.

### 002_hardening.sql
Security hardening migration that adds:
- Uniqueness constraints
- Additional performance indexes
- WITH CHECK policies for all UPDATE operations
- Storage policies for `audience-exports` bucket
- Data validation constraints
- Documentation comments

## Running Migrations

1. **In Supabase Dashboard:**
   - Go to SQL Editor
   - Run `001_initial_schema.sql` first (if not already run)
   - Then run `002_hardening.sql`

2. **Verify RLS Policies:**
   ```sql
   -- Check all policies are enabled
   SELECT tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

3. **Verify Storage Policies:**
   - Go to Storage → Policies
   - Ensure `audience-exports` bucket has the three policies:
     - "Users can upload exports for their audiences"
     - "Users can read their own exports"
     - "Users can delete their own exports"

## Security Improvements

### 1. Row-Level Security (RLS)

**All tables now have:**
- ✅ SELECT policies with ownership checks
- ✅ INSERT policies with WITH CHECK
- ✅ UPDATE policies with both USING and WITH CHECK
- ✅ DELETE policies with ownership checks

**Key Changes:**
- `geo_units` UPDATE policy now includes WITH CHECK
- `exports` UPDATE policy added (for future use)
- All child tables validate ownership via join to `audiences.user_id`

### 2. Storage Security

**Bucket Configuration:**
- `audience-exports` must be **private** (not public)
- Policies enforce ownership via `exports.user_id` check
- Signed URLs have 15-minute expiry (configurable in `/api/exports/download`)

**Server-Side Validation:**
- Export generation moved to `/api/exports/generate` route handler
- Ownership verified before generating exports
- Download URLs generated server-side with ownership check

### 3. Data Validation

**New Constraints:**
- `target_reach` must be positive if provided
- `budget_total` must be positive if provided
- `end_date` must be >= `start_date` if both provided
- `weight` must be positive
- `score` must be between 0 and 100

**Uniqueness:**
- `audience_segments(audience_id, segment_type, provider, segment_key)` is unique

### 4. Performance Indexes

**Added:**
- Composite index on `audience_segments(audience_id, segment_type, construction_mode)`
- Composite index on `geo_units(audience_id, geo_type)`
- Index on `exports(audience_id, created_at DESC)`

## Provider Adapter Layer

### Architecture

```
src/features/audience-builder/
├── providers/
│   ├── types.ts              # Provider interfaces
│   ├── registry.ts           # Provider registry
│   └── mock/                 # Mock providers (CCS, ONS, Experian, Mobility)
│       ├── base.ts
│       ├── ccs.ts
│       ├── ons.ts
│       ├── experian.ts
│       └── mobility.ts
└── services/
    └── audienceBuilder.service.ts  # Orchestration layer
```

### Adding a New Provider

1. **Create provider class:**
   ```typescript
   // src/features/audience-builder/providers/mock/newprovider.ts
   import { BaseMockProvider } from './base';
   import { ProviderAdapter } from '../types';
   
   export class NewProvider extends BaseMockProvider {
     getMetadata() {
       return { name: 'NewProvider', capabilities: ['validation', 'extension'] };
     }
     
     async getSegments(input) { /* ... */ }
     async validateSegments(input) { /* ... */ }
     async getGeoUnits(input) { /* ... */ }
   }
   ```

2. **Register in registry:**
   ```typescript
   // src/features/audience-builder/providers/registry.ts
   import { NewProvider } from './mock/newprovider';
   
   const providers = {
     // ... existing
     NewProvider: new NewProvider(),
   };
   ```

3. **For real providers:**
   - Replace mock logic with API calls
   - Keep the same interface
   - Add error handling and retries
   - Consider rate limiting

## Service Layer

The `AudienceBuilderService` orchestrates:
- Segment suggestion based on construction mode
- Profile stats calculation
- Geo unit generation
- Provider aggregation

**Usage:**
```typescript
import { audienceBuilderService } from '@/features/audience-builder/services/audienceBuilder.service';

const segments = await audienceBuilderService.getSuggestedSegments(
  audienceId,
  description,
  'extension',
  'primary'
);
```

## Testing RLS & Storage Access

### Test RLS Policies

1. **Create two test users:**
   - User A: `test-a@example.com`
   - User B: `test-b@example.com`

2. **As User A:**
   - Create an audience
   - Create segments
   - Verify you can read/write

3. **As User B:**
   - Try to access User A's audience (should fail)
   - Try to update User A's segments (should fail)
   - Verify you can only see your own data

### Test Storage Policies

1. **As User A:**
   - Generate an export
   - Download the export (should work)

2. **As User B:**
   - Try to access User A's export via direct URL (should fail)
   - Try to upload to User A's path (should fail)

3. **Verify signed URLs:**
   - Generate download URL
   - Wait 16 minutes
   - Try to download (should fail - expired)

## Critical Security Notes

⚠️ **Before deploying to production:**

1. ✅ Verify all RLS policies are enabled
2. ✅ Ensure `audience-exports` bucket is private
3. ✅ Test cross-user access is blocked
4. ✅ Verify signed URLs expire correctly
5. ✅ Review storage policies match requirements
6. ✅ Ensure no `USING (true)` policies exist
7. ✅ All UPDATE operations have WITH CHECK

## Observability

### Logger

```typescript
import { logger } from '@/lib/logger';

logger.info('User action', { userId, action: 'export' });
logger.error('Export failed', error, { audienceId });
```

### Error Boundaries

All builder routes are wrapped in `ErrorBoundary` components to catch React errors gracefully.

### Loading States

Use `StepLoadingSkeleton` and `MapLoadingSkeleton` for consistent loading UX.

## Next Steps

1. **Real Provider Integration:**
   - Replace mock providers with real API clients
   - Add authentication for provider APIs
   - Implement retry logic and rate limiting

2. **Monitoring:**
   - Add error tracking (Sentry, etc.)
   - Add analytics for user actions
   - Monitor RLS policy performance

3. **Performance:**
   - Add caching for provider responses
   - Optimize geo unit generation
   - Consider background jobs for large exports
