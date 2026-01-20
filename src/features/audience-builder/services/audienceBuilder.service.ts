import { getProvider, getAllProviders } from '../providers/registry';
import { ProviderSegment, ProviderGeoUnit } from '../providers/types';
import { ConstructionMode } from '@/lib/types';
import { calculateDerivedStats } from '../api/profile';

export interface ProfileStats {
  derived_audience_size: number;
  confidence_high: number;
  confidence_medium: number;
  confidence_low: number;
}

/**
 * Service layer for audience builder orchestration
 * Moves business logic out of UI components
 */
export class AudienceBuilderService {
  /**
   * Get suggested segments based on construction mode
   */
  async getSuggestedSegments(
    audienceId: string,
    audienceDescription: string | undefined,
    constructionMode: ConstructionMode,
    segmentType: 'primary' | 'secondary',
    existingSegments: ProviderSegment[] = []
  ): Promise<ProviderSegment[]> {
    if (constructionMode === 'validation') {
      // Validation mode: CCS is baseline, others validate
      const ccsProvider = getProvider('CCS');
      const baseSegments = await ccsProvider.getSegments({
        audienceId,
        audienceDescription,
        constructionMode,
        segmentType,
        existingSegments,
      });

      // Get validation from other providers
      const otherProviders = ['ONS', 'Experian'];
      const validatedSegments: ProviderSegment[] = [...baseSegments];

      for (const providerName of otherProviders) {
        try {
          const provider = getProvider(providerName as any);
          const segments = await provider.getSegments({
            audienceId,
            audienceDescription,
            constructionMode,
            segmentType,
            existingSegments: baseSegments,
          });
          validatedSegments.push(...segments);
        } catch (error) {
          console.warn(`Provider ${providerName} failed:`, error);
        }
      }

      return validatedSegments;
    } else {
      // Extension mode: AI proposes adjacent segments
      const allProviders = getAllProviders();
      const suggestedSegments: ProviderSegment[] = [];

      for (const provider of allProviders) {
        try {
          const segments = await provider.getSegments({
            audienceId,
            audienceDescription,
            constructionMode,
            segmentType,
            existingSegments,
          });
          suggestedSegments.push(...segments);
        } catch (error) {
          console.warn(`Provider ${provider.name} failed:`, error);
        }
      }

      return suggestedSegments;
    }
  }

  /**
   * Calculate derived profile stats based on scale_accuracy slider
   */
  deriveProfileStats(
    scaleAccuracy: number,
    baseSize: number = 5000000
  ): ProfileStats {
    return calculateDerivedStats(scaleAccuracy, baseSize);
  }

  /**
   * Generate geo units for an audience
   */
  async generateGeoUnits(
    audienceId: string,
    selectedSegments: ProviderSegment[],
    scaleAccuracy: number
  ): Promise<ProviderGeoUnit[]> {
    // Aggregate geo units from all providers that contributed segments
    const providerNames = new Set(selectedSegments.map((s) => s.provider));
    const allGeoUnits: ProviderGeoUnit[] = [];

    for (const providerName of providerNames) {
      try {
        const provider = getProvider(providerName as any);
        const geoUnits = await provider.getGeoUnits({
          audienceId,
          selectedSegments: selectedSegments.filter((s) => s.provider === providerName),
          scaleAccuracy,
        });
        allGeoUnits.push(...geoUnits);
      } catch (error) {
        console.warn(`Provider ${providerName} geo generation failed:`, error);
      }
    }

    // Deduplicate by geo_id and merge scores
    const geoMap = new Map<string, ProviderGeoUnit>();
    for (const unit of allGeoUnits) {
      const existing = geoMap.get(unit.geo_id);
      if (existing) {
        // Merge: take higher score, combine drivers
        existing.score = Math.max(existing.score, unit.score);
        if (unit.drivers) {
          existing.drivers = { ...existing.drivers, ...unit.drivers };
        }
      } else {
        geoMap.set(unit.geo_id, { ...unit });
      }
    }

    return Array.from(geoMap.values());
  }

  /**
   * Get provider count for validation mode display
   */
  getProviderCount(segments: ProviderSegment[]): { contributing: number; total: number } {
    const contributing = new Set(segments.map((s) => s.provider)).size;
    const total = getAllProviders().length;
    return { contributing, total };
  }
}

// Singleton instance
export const audienceBuilderService = new AudienceBuilderService();
