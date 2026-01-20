import { BaseMockProvider } from './base';
import { ProviderMetadata, ProviderSegment, GetSegmentsInput, ValidateSegmentsInput, GetGeoUnitsInput } from '../types';

export class ExperianProvider extends BaseMockProvider {
  getMetadata(): ProviderMetadata {
    return {
      name: 'Experian',
      version: '1.0.0',
      capabilities: ['validation', 'extension'],
    };
  }

  async getSegments(input: GetSegmentsInput): Promise<ProviderSegment[]> {
    return [
      {
        provider: 'Experian',
        segment_key: 'growing_independence',
        segment_label: 'Growing Independence',
        description: 'Families with older children starting secondary or further education, showing increased independence and digital engagement.',
        weight: 1,
      },
    ];
  }

  async validateSegments(input: ValidateSegmentsInput): Promise<{
    validated: ProviderSegment[];
    confidence: number;
    overlapCount: number;
  }> {
    const overlap = Math.floor(input.baseSegments.length * 0.7);
    return {
      validated: input.baseSegments.slice(0, overlap),
      confidence: 0.70,
      overlapCount: overlap,
    };
  }

  async getGeoUnits(input: GetGeoUnitsInput): Promise<any[]> {
    return this.generateMockGeoUnits(180, 53.5, -2.2, 1.8); // Manchester area
  }
}
