import { ConstructionSettings, SignalConfig } from '../types/signals';

export interface CoverageMetrics {
  activeSignalsCount: number;
  modelledConfidence: number; // 0-100
  estimatedMatchCoverage: number; // 0-100
}

/**
 * Calculate coverage metrics from construction settings
 */
export function calculateCoverageMetrics(settings: ConstructionSettings | null): CoverageMetrics {
  if (!settings) {
    return {
      activeSignalsCount: 0,
      modelledConfidence: 0,
      estimatedMatchCoverage: 0,
    };
  }

  const enabledSignals = Object.values(settings.active_signals).filter((s) => s.enabled);
  const activeSignalsCount = enabledSignals.length;

  if (activeSignalsCount === 0) {
    return {
      activeSignalsCount: 0,
      modelledConfidence: 0,
      estimatedMatchCoverage: 0,
    };
  }

  // Modelled confidence: average confidence of enabled signals, weighted by base_weight
  const totalWeight = enabledSignals.reduce((sum, s) => sum + s.base_weight, 0);
  const weightedConfidence = enabledSignals.reduce(
    (sum, s) => sum + s.base_weight * s.confidence,
    0
  );
  const modelledConfidence = totalWeight > 0 ? (weightedConfidence / totalWeight) * 100 : 0;

  // Estimated match coverage: combination of signal count, confidence, and construction mode
  // More signals + higher confidence + extension mode = higher coverage
  const signalDiversityScore = Math.min(100, activeSignalsCount * 15); // Max at ~6-7 signals
  const confidenceScore = modelledConfidence;
  const modeMultiplier = settings.construction_mode === 'extension' ? 1.2 : 1.0;
  
  const estimatedMatchCoverage = Math.min(
    100,
    ((signalDiversityScore * 0.4 + confidenceScore * 0.6) * modeMultiplier)
  );

  return {
    activeSignalsCount,
    modelledConfidence: Math.round(modelledConfidence),
    estimatedMatchCoverage: Math.round(estimatedMatchCoverage),
  };
}
