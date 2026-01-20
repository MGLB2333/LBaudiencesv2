import { BaseMockProvider } from './base';
import { ProviderMetadata, ProviderSegment, GetSegmentsInput, ValidateSegmentsInput, GetGeoUnitsInput } from '../types';

export class CCSProvider extends BaseMockProvider {
  getMetadata(): ProviderMetadata {
    return {
      name: 'CCS',
      version: '1.0.0',
      capabilities: ['validation', 'extension', 'geo'],
    };
  }

  async getSegments(input: GetSegmentsInput): Promise<ProviderSegment[]> {
    const { constructionMode, segmentType } = input;

    if (constructionMode === 'validation') {
      // In validation mode, CCS is the baseline
      return [
        {
          provider: 'CCS',
          segment_key: 'families_with_kids_over_11',
          segment_label: 'Families with kids over 11',
          description: 'Default primary audience segment from CCS baseline data',
          weight: 1,
        },
      ];
    }

    // Extension mode: suggest adjacent segments
    return [
      {
        provider: 'CCS',
        segment_key: 'tech_savvy_family_units',
        segment_label: 'Tech-Savvy Family Units',
        description: 'Households with teenagers where media consumption is shared across connected devices, with high CTV and social usage.',
        weight: 1,
      },
      {
        provider: 'CCS',
        segment_key: 'weekend_activity_seekers',
        segment_label: 'Weekend Activity Seekers',
        description: 'Families that engage in weekend activities and outings, showing patterns of leisure and family time.',
        weight: 1,
      },
    ];
  }

  async validateSegments(input: ValidateSegmentsInput): Promise<{
    validated: ProviderSegment[];
    confidence: number;
    overlapCount: number;
  }> {
    // Mock validation: return base segments with high confidence
    return {
      validated: input.baseSegments,
      confidence: 0.85,
      overlapCount: input.baseSegments.length,
    };
  }

  async getGeoUnits(input: GetGeoUnitsInput): Promise<any[]> {
    // Generate 200 units, adjusted by scale_accuracy
    const baseCount = 200;
    const scaleFactor = (100 - input.scaleAccuracy) / 100;
    const count = Math.round(baseCount * (0.5 + scaleFactor * 1.0));

    return this.generateMockGeoUnits(count, 54.5, -2, 2);
  }
}
