import { BaseMockProvider } from './base';
import { ProviderMetadata, ProviderSegment, GetSegmentsInput, ValidateSegmentsInput, GetGeoUnitsInput } from '../types';

export class MobilityProvider extends BaseMockProvider {
  getMetadata(): ProviderMetadata {
    return {
      name: 'Mobility',
      version: '1.0.0',
      capabilities: ['extension', 'geo'],
    };
  }

  async getSegments(input: GetSegmentsInput): Promise<ProviderSegment[]> {
    return [
      {
        provider: 'Mobility',
        segment_key: 'mobile_family_patterns',
        segment_label: 'Mobile Family Patterns',
        description: 'Families with high mobility patterns, frequent travel, and location-based behaviors.',
        weight: 0.8,
      },
    ];
  }

  async validateSegments(input: ValidateSegmentsInput): Promise<{
    validated: ProviderSegment[];
    confidence: number;
    overlapCount: number;
  }> {
    return {
      validated: [],
      confidence: 0.5,
      overlapCount: 0,
    };
  }

  async getGeoUnits(input: GetGeoUnitsInput): Promise<any[]> {
    return this.generateMockGeoUnits(120, 52.5, -1.9, 2.0); // Midlands area
  }
}
