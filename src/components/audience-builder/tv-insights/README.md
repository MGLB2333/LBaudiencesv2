# TV Spot Insights

This folder contains the TV Spot Insights feature for the Audience Builder.

## Current Implementation (MVP)

The current implementation uses **mock data** stored locally in the frontend (`tvSpotMockData.ts`). The insights are filtered based on:
- Selected TV regions (from BuilderContext)
- Construction mode (validation/extension) - used for display labels only

## Future Implementation

In production, this feature will:

1. **Data Source**: Use ACR (Automatic Content Recognition) viewing data matched to postcode districts
2. **Aggregation**: Aggregate viewing data by:
   - Channel (ITV, Channel 4, BBC One, etc.)
   - Programme/show title
   - Daypart (Breakfast, Daytime, Peak, Late)
   - Genre (Drama, Sport, Entertainment, News, Factual)
3. **Geography Matching**: 
   - Match ACR viewing data to the selected audience's postcode districts
   - Use `geo_districts` and `geo_district_signals` to determine which districts are in the audience
   - Apply TV region filters if selected
4. **Index Calculation**: 
   - Calculate index vs average (100 = average, >100 = over-index)
   - Index = (audience viewing rate / general population viewing rate) × 100
5. **Metrics**:
   - Estimated impressions (total views)
   - Estimated reach (unique viewers)
   - Top regions (where viewing is highest)

## Components

- `TvSpotInsightsPanel.tsx`: Main panel component that renders all insights
- `tvSpotMockData.ts`: Mock dataset and helper functions for filtering/aggregation

## Integration

The TV Spot Insights tab is integrated into `BuildExploreStep.tsx` and uses the same context (`BuilderContext`) as the map view, ensuring filters and selections are consistent across both views.
