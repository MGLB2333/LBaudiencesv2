export type AudienceIntent = 'home_movers' | 'home_renovators' | 'home_owners_general';
export type SpatialBias = 'urban' | 'suburban' | 'rural';
export type OwnershipConfidence = 'low' | 'medium' | 'high';
export type PropertyAgeBand = '0_5' | '5_10' | '10_20' | '20_plus';

export interface SignalConfig {
  enabled: boolean;
  base_weight: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  spatial_bias?: SpatialBias;
}

export interface ConstructionSettings {
  audience_intent: AudienceIntent | null;
  construction_mode: 'validation' | 'extension';
  active_signals: Record<string, SignalConfig>;
  last_run_at?: string | null;
  validation_min_agreement?: number;
  validation_agreement_mode?: 'threshold' | 'majority' | 'unanimous';
}

export type SignalSourceProvider = 'Outra' | 'Experian' | 'ONS' | 'TwentyCI' | 'CCS';

export interface SignalDefinition {
  id: string;
  label: string;
  description: string;
  default_weight: number;
  default_confidence: number;
  default_spatial_bias?: SpatialBias;
  applicable_intents?: AudienceIntent[];
  source_provider?: SignalSourceProvider;
}

export const SIGNAL_DEFINITIONS: Record<string, SignalDefinition> = {
  planning_approval: {
    id: 'planning_approval',
    label: 'Planning Approval Intent',
    description: 'Areas with recent planning permission activity for extensions and renovations',
    default_weight: 0.8,
    default_confidence: 0.7,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_renovators', 'home_owners_general'],
    source_provider: 'Outra',
  },
  property_age_0_5: {
    id: 'property_age_0_5',
    label: 'Property Age 0–5 Years',
    description: 'New build properties, likely first-time buyers or recent movers',
    default_weight: 0.6,
    default_confidence: 0.6,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_movers'],
    source_provider: 'TwentyCI',
  },
  property_age_5_10: {
    id: 'property_age_5_10',
    label: 'Property Age 5–10 Years',
    description: 'Established properties, potential for first major renovation',
    default_weight: 0.7,
    default_confidence: 0.65,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_renovators', 'home_owners_general'],
    source_provider: 'TwentyCI',
  },
  property_age_10_20: {
    id: 'property_age_10_20',
    label: 'Property Age 10–20 Years',
    description: 'Properties at typical renovation lifecycle point',
    default_weight: 0.8,
    default_confidence: 0.7,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_renovators', 'home_owners_general'],
    source_provider: 'TwentyCI',
  },
  property_age_20_plus: {
    id: 'property_age_20_plus',
    label: 'Property Age 20+ Years',
    description: 'Older properties, higher renovation likelihood',
    default_weight: 0.75,
    default_confidence: 0.65,
    default_spatial_bias: 'urban',
    applicable_intents: ['home_renovators', 'home_owners_general'],
    source_provider: 'TwentyCI',
  },
  ownership_confidence_low: {
    id: 'ownership_confidence_low',
    label: 'Ownership Confidence: Low',
    description: 'Areas with lower owner-occupier rates',
    default_weight: 0.3,
    default_confidence: 0.4,
    default_spatial_bias: 'urban',
    applicable_intents: ['home_owners_general'],
    source_provider: 'ONS',
  },
  ownership_confidence_medium: {
    id: 'ownership_confidence_medium',
    label: 'Ownership Confidence: Medium',
    description: 'Areas with moderate owner-occupier rates',
    default_weight: 0.6,
    default_confidence: 0.6,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_owners_general', 'home_renovators'],
    source_provider: 'ONS',
  },
  ownership_confidence_high: {
    id: 'ownership_confidence_high',
    label: 'Ownership Confidence: High',
    description: 'Areas with high owner-occupier rates',
    default_weight: 0.9,
    default_confidence: 0.8,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_owners_general', 'home_renovators', 'home_movers'],
    source_provider: 'ONS',
  },
  affluence_proxy: {
    id: 'affluence_proxy',
    label: 'Affluence Proxy',
    description: 'Income and property value indicators',
    default_weight: 0.7,
    default_confidence: 0.65,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_movers', 'home_renovators', 'home_owners_general'],
    source_provider: 'Experian',
  },
  household_size_small: {
    id: 'household_size_small',
    label: 'Household Size: Small (1–2)',
    description: 'Single person or couple households',
    default_weight: 0.4,
    default_confidence: 0.5,
    default_spatial_bias: 'urban',
    applicable_intents: ['home_movers'],
    source_provider: 'Experian',
  },
  household_size_medium: {
    id: 'household_size_medium',
    label: 'Household Size: Medium (3–4)',
    description: 'Family households',
    default_weight: 0.8,
    default_confidence: 0.7,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_movers', 'home_renovators'],
    source_provider: 'Experian',
  },
  household_size_large: {
    id: 'household_size_large',
    label: 'Household Size: Large (5+)',
    description: 'Large family households',
    default_weight: 0.7,
    default_confidence: 0.65,
    default_spatial_bias: 'suburban',
    applicable_intents: ['home_movers', 'home_renovators'],
    source_provider: 'Experian',
  },
};

export function getSignalsForIntent(intent: AudienceIntent | null): SignalDefinition[] {
  if (!intent) return Object.values(SIGNAL_DEFINITIONS);
  return Object.values(SIGNAL_DEFINITIONS).filter(
    (signal) => !signal.applicable_intents || signal.applicable_intents.includes(intent)
  );
}

export function createDefaultSignalConfig(signal: SignalDefinition): SignalConfig {
  return {
    enabled: false,
    base_weight: signal.default_weight,
    confidence: signal.default_confidence,
    spatial_bias: signal.default_spatial_bias,
  };
}
