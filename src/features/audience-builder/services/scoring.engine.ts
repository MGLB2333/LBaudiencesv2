import { ConstructionSettings, SignalConfig, SpatialBias } from '../types/signals';
import { ProviderGeoUnit } from '../providers/types';

export interface GeoScoringResult {
  score: number;
  confidence_tier: 'high' | 'medium' | 'low' | 'discarded';
  drivers: {
    signals: Array<{
      signal_type: string;
      weight: number;
      contribution: number;
      inferred: boolean;
    }>;
    total_score: number;
    spatial_bias_applied?: SpatialBias;
  };
}

/**
 * Deterministic scoring engine for geo units based on signals
 */
export class GeoScoringEngine {
  /**
   * Score a single geo unit based on active signals
   */
  scoreGeoUnit(
    geoUnit: ProviderGeoUnit,
    settings: ConstructionSettings,
    scaleAccuracy: number
  ): GeoScoringResult {
    const enabledSignals = Object.entries(settings.active_signals).filter(
      ([_, config]) => config.enabled
    );

    if (enabledSignals.length === 0) {
      return {
        score: 0,
        confidence_tier: 'discarded',
        drivers: {
          signals: [],
          total_score: 0,
        },
      };
    }

    // Get base spatial characteristics for this geo unit
    const spatialBias = this.getSpatialBiasForGeoUnit(geoUnit);
    
    let totalScore = 0;
    const signalContributions: GeoScoringResult['drivers']['signals'] = [];

    // Calculate contribution from each enabled signal
    for (const [signalId, config] of enabledSignals) {
      const contribution = this.calculateSignalContribution(
        signalId,
        config,
        geoUnit,
        spatialBias,
        settings.construction_mode,
        scaleAccuracy
      );
      
      totalScore += contribution;
      
      signalContributions.push({
        signal_type: signalId,
        weight: config.base_weight,
        contribution,
        inferred: false, // Explicit signals are never inferred
      });
    }

    // In Extension mode, add inferred signals
    if (settings.construction_mode === 'extension') {
      const inferredSignals = this.getInferredSignals(settings, enabledSignals);
      for (const [signalId, inferredConfig] of inferredSignals) {
        const contribution = this.calculateSignalContribution(
          signalId,
          inferredConfig,
          geoUnit,
          spatialBias,
          'extension',
          scaleAccuracy
        ) * 0.4; // Inferred signals contribute at 40% weight
        
        totalScore += contribution;
        
        signalContributions.push({
          signal_type: signalId,
          weight: inferredConfig.base_weight * 0.4,
          contribution,
          inferred: true,
        });
      }
    }

    // Normalize score to 0-100 range
    const normalizedScore = Math.min(100, Math.max(0, totalScore));

    // Apply scale_accuracy modifier
    // Higher accuracy (lower scale) = tighter thresholds
    const accuracyModifier = scaleAccuracy / 100;
    const adjustedScore = normalizedScore * accuracyModifier;

    // Determine confidence tier based on percentile
    const confidenceTier = this.getConfidenceTier(adjustedScore, scaleAccuracy);

    return {
      score: Math.round(adjustedScore),
      confidence_tier: confidenceTier,
      drivers: {
        signals: signalContributions,
        total_score: adjustedScore,
        spatial_bias_applied: spatialBias,
      },
    };
  }

  /**
   * Calculate how much a signal contributes to a geo unit's score
   */
  private calculateSignalContribution(
    signalId: string,
    config: SignalConfig,
    geoUnit: ProviderGeoUnit,
    geoUnitSpatialBias: SpatialBias,
    constructionMode: 'validation' | 'extension',
    scaleAccuracy: number
  ): number {
    // Base contribution from signal weight
    let contribution = config.base_weight * 50; // Scale to 0-50 range

    // Apply confidence modifier
    contribution *= config.confidence;

    // Apply spatial bias match
    const spatialMatch = this.getSpatialMatch(config.spatial_bias, geoUnitSpatialBias);
    contribution *= spatialMatch;

    // Property age signals get deterministic boost based on geo unit characteristics
    if (signalId.startsWith('property_age_')) {
      const ageBand = signalId.split('_').slice(2).join('_');
      const ageBoost = this.getPropertyAgeBoost(ageBand, geoUnit);
      contribution *= ageBoost;
    }

    // Ownership confidence signals
    if (signalId.startsWith('ownership_confidence_')) {
      const confidenceLevel = signalId.split('_').slice(2).join('_');
      const ownershipBoost = this.getOwnershipBoost(confidenceLevel, geoUnit);
      contribution *= ownershipBoost;
    }

    // Planning approval gets boost in suburban areas
    if (signalId === 'planning_approval' && geoUnitSpatialBias === 'suburban') {
      contribution *= 1.3;
    }

    // Affluence proxy gets consistent boost
    if (signalId === 'affluence_proxy') {
      contribution *= 1.1;
    }

    // Household size signals
    if (signalId.startsWith('household_size_')) {
      const sizeType = signalId.split('_').slice(2).join('_');
      const sizeBoost = this.getHouseholdSizeBoost(sizeType, geoUnit);
      contribution *= sizeBoost;
    }

    // Validation mode: tighter scoring (higher threshold)
    if (constructionMode === 'validation') {
      contribution *= 0.9; // Slightly reduce scores in validation mode
    }

    return contribution;
  }

  /**
   * Get inferred signals for Extension mode
   */
  private getInferredSignals(
    settings: ConstructionSettings,
    explicitSignals: Array<[string, SignalConfig]>
  ): Array<[string, SignalConfig]> {
    const inferred: Array<[string, SignalConfig]> = [];
    const explicitIds = new Set(explicitSignals.map(([id]) => id));

    // If planning_approval is enabled, infer property_age_10_20
    if (explicitIds.has('planning_approval') && !explicitIds.has('property_age_10_20')) {
      inferred.push(['property_age_10_20', {
        enabled: true,
        base_weight: 0.5,
        confidence: 0.5,
        spatial_bias: 'suburban',
      }]);
    }

    // If any property_age is enabled, infer ownership_confidence_medium
    const hasPropertyAge = Array.from(explicitIds).some(id => id.startsWith('property_age_'));
    if (hasPropertyAge && !explicitIds.has('ownership_confidence_medium')) {
      inferred.push(['ownership_confidence_medium', {
        enabled: true,
        base_weight: 0.4,
        confidence: 0.5,
        spatial_bias: 'suburban',
      }]);
    }

    // If ownership_confidence_high, infer affluence_proxy
    if (explicitIds.has('ownership_confidence_high') && !explicitIds.has('affluence_proxy')) {
      inferred.push(['affluence_proxy', {
        enabled: true,
        base_weight: 0.4,
        confidence: 0.5,
        spatial_bias: 'suburban',
      }]);
    }

    return inferred;
  }

  /**
   * Determine spatial bias for a geo unit based on its characteristics
   */
  private getSpatialBiasForGeoUnit(geoUnit: ProviderGeoUnit): SpatialBias {
    // Use deterministic hash of geo_id to assign spatial bias
    const hash = this.simpleHash(geoUnit.geo_id);
    const mod = hash % 100;
    
    // 30% urban, 50% suburban, 20% rural
    if (mod < 30) return 'urban';
    if (mod < 80) return 'suburban';
    return 'rural';
  }

  /**
   * Get spatial match multiplier
   */
  private getSpatialMatch(signalBias?: SpatialBias, geoBias?: SpatialBias): number {
    if (!signalBias || !geoBias) return 1.0;
    if (signalBias === geoBias) return 1.0;
    
    // Partial matches
    if ((signalBias === 'suburban' && geoBias === 'urban') || 
        (signalBias === 'urban' && geoBias === 'suburban')) {
      return 0.7;
    }
    if ((signalBias === 'suburban' && geoBias === 'rural') || 
        (signalBias === 'rural' && geoBias === 'suburban')) {
      return 0.8;
    }
    
    return 0.5; // Urban <-> Rural mismatch
  }

  /**
   * Get property age boost based on geo unit
   */
  private getPropertyAgeBoost(ageBand: string, geoUnit: ProviderGeoUnit): number {
    const hash = this.simpleHash(geoUnit.geo_id + ageBand);
    const mod = hash % 100;
    
    // Deterministic boost: 0.8 to 1.2 based on hash
    return 0.8 + (mod / 100) * 0.4;
  }

  /**
   * Get ownership boost
   */
  private getOwnershipBoost(confidenceLevel: string, geoUnit: ProviderGeoUnit): number {
    const hash = this.simpleHash(geoUnit.geo_id + confidenceLevel);
    const mod = hash % 100;
    
    if (confidenceLevel === 'high') {
      return 1.0 + (mod / 100) * 0.3; // 1.0 to 1.3
    } else if (confidenceLevel === 'medium') {
      return 0.9 + (mod / 100) * 0.2; // 0.9 to 1.1
    } else {
      return 0.7 + (mod / 100) * 0.2; // 0.7 to 0.9
    }
  }

  /**
   * Get household size boost
   */
  private getHouseholdSizeBoost(sizeType: string, geoUnit: ProviderGeoUnit): number {
    const hash = this.simpleHash(geoUnit.geo_id + sizeType);
    const mod = hash % 100;
    return 0.85 + (mod / 100) * 0.3; // 0.85 to 1.15
  }

  /**
   * Determine confidence tier based on score and scale_accuracy
   */
  private getConfidenceTier(score: number, scaleAccuracy: number): 'high' | 'medium' | 'low' | 'discarded' {
    // Higher accuracy = tighter thresholds
    const highThreshold = 70 - (100 - scaleAccuracy) * 0.3; // 70 at accuracy=100, 40 at accuracy=0
    const mediumThreshold = 40 - (100 - scaleAccuracy) * 0.2; // 40 at accuracy=100, 20 at accuracy=0
    
    if (score >= highThreshold) return 'high';
    if (score >= mediumThreshold) return 'medium';
    if (score > 0) return 'low';
    return 'discarded';
  }

  /**
   * Simple deterministic hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const geoScoringEngine = new GeoScoringEngine();
