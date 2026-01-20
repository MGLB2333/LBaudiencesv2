import { ProviderAdapter, ProviderMetadata, ProviderSegment, ProviderGeoUnit } from '../types';

export abstract class BaseMockProvider implements ProviderAdapter {
  abstract getMetadata(): ProviderMetadata;
  abstract getSegments(input: any): Promise<ProviderSegment[]>;
  abstract validateSegments(input: any): Promise<any>;
  abstract getGeoUnits(input: any): Promise<ProviderGeoUnit[]>;

  /**
   * Generate deterministic fake geo units for UK regions
   */
  protected generateMockGeoUnits(
    count: number,
    baseLat: number = 54.5,
    baseLng: number = -2,
    spread: number = 2
  ): ProviderGeoUnit[] {
    const units: ProviderGeoUnit[] = [];
    
    for (let i = 0; i < count; i++) {
      // Deterministic based on index
      const seed = i * 12345;
      const lat = baseLat + ((seed % 1000) / 1000 - 0.5) * spread;
      const lng = baseLng + (((seed * 7) % 1000) / 1000 - 0.5) * spread;
      const score = 30 + ((seed * 13) % 70); // 30-100
      const tier = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';

      units.push({
        geo_type: 'h3',
        geo_id: `h3_${this.getMetadata().name}_${i}_${Date.now()}`,
        score,
        confidence_tier: tier,
        drivers: {
          top_segments: ['segment_1', 'segment_2'],
          variables: ['household_size', 'age_range'],
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lng - 0.01, lat - 0.01],
            [lng + 0.01, lat - 0.01],
            [lng + 0.01, lat + 0.01],
            [lng - 0.01, lat + 0.01],
            [lng - 0.01, lat - 0.01],
          ]],
        },
      });
    }

    return units;
  }
}
