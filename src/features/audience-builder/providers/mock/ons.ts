import { BaseMockProvider } from './base';
import { ProviderMetadata, ProviderSegment, GetSegmentsInput, ValidateSegmentsInput, GetGeoUnitsInput } from '../types';

export class ONSProvider extends BaseMockProvider {
  getMetadata(): ProviderMetadata {
    return {
      name: 'ONS',
      version: '1.0.0',
      capabilities: ['validation', 'extension'],
    };
  }

  async getSegments(input: GetSegmentsInput): Promise<ProviderSegment[]> {
    const { constructionMode } = input;

    if (constructionMode === 'validation') {
      // Validate against CCS baseline
      return [
        {
          provider: 'ONS',
          segment_key: 'older_school_age_families',
          segment_label: 'Older School-Age Families',
          description: 'Households with children aged 11-17, based on census-reported household composition. Typically suburban or edge-of-town locations.',
          weight: 1,
        },
      ];
    }

    // Extension mode
    return [
      {
        provider: 'ONS',
        segment_key: 'older_school_age_families',
        segment_label: 'Older School-Age Families',
        description: 'Households with children aged 11-17, based on census-reported household composition. Typically suburban or edge-of-town locations.',
        weight: 1,
      },
    ];
  }

  async validateSegments(input: ValidateSegmentsInput): Promise<{
    validated: ProviderSegment[];
    confidence: number;
    overlapCount: number;
  }> {
    // Mock: 80% overlap with base
    const overlap = Math.floor(input.baseSegments.length * 0.8);
    return {
      validated: input.baseSegments.slice(0, overlap),
      confidence: 0.75,
      overlapCount: overlap,
    };
  }

  async getGeoUnits(input: GetGeoUnitsInput): Promise<any[]> {
    return this.generateMockGeoUnits(150, 51.5, -0.1, 1.5); // London area
  }
}
