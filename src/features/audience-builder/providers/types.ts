import { ConstructionMode } from '@/lib/types';

export interface ProviderSegment {
  provider: string;
  segment_key: string;
  segment_label: string;
  description?: string;
  weight?: number;
}

export interface ProviderGeoUnit {
  geo_type: 'h3' | 'postcode_sector';
  geo_id: string;
  score: number;
  confidence_tier: 'high' | 'medium' | 'low' | 'discarded';
  drivers?: Record<string, any>;
  geometry?: any; // GeoJSON
}

export interface ProviderMetadata {
  name: string;
  version?: string;
  capabilities: string[];
}

export interface GetSegmentsInput {
  audienceId: string;
  audienceDescription?: string;
  constructionMode: ConstructionMode;
  segmentType: 'primary' | 'secondary';
  existingSegments?: ProviderSegment[];
}

export interface ValidateSegmentsInput {
  audienceId: string;
  baseSegments: ProviderSegment[];
  otherProviders: ProviderSegment[];
}

export interface GetGeoUnitsInput {
  audienceId: string;
  selectedSegments: ProviderSegment[];
  scaleAccuracy: number; // 0-100
}

export interface ProviderAdapter {
  /**
   * Get provider metadata
   */
  getMetadata(): ProviderMetadata;

  /**
   * Get suggested segments based on audience description and mode
   */
  getSegments(input: GetSegmentsInput): Promise<ProviderSegment[]>;

  /**
   * Validate segments against base segments (for validation mode)
   */
  validateSegments(input: ValidateSegmentsInput): Promise<{
    validated: ProviderSegment[];
    confidence: number;
    overlapCount: number;
  }>;

  /**
   * Generate geo units based on selected segments and scale/accuracy slider
   */
  getGeoUnits(input: GetGeoUnitsInput): Promise<ProviderGeoUnit[]>;
}
