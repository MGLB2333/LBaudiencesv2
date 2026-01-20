import { AudienceIntent, SignalConfig } from '../types/signals';

export interface AudienceTemplate {
  id: string;
  name: string;
  description: string;
  audience_intent: AudienceIntent;
  active_signals: Record<string, SignalConfig>;
}

export const audienceTemplates: AudienceTemplate[] = [
  {
    id: 'home_movers',
    name: 'Home Movers',
    description: 'Targeting households that have recently moved or are in the process of moving',
    audience_intent: 'home_movers',
    active_signals: {
      property_age_0_5: {
        enabled: true,
        base_weight: 0.7,
        confidence: 0.7,
        spatial_bias: 'suburban',
      },
      ownership_confidence_high: {
        enabled: true,
        base_weight: 0.8,
        confidence: 0.75,
        spatial_bias: 'suburban',
      },
      household_size_medium: {
        enabled: true,
        base_weight: 0.75,
        confidence: 0.7,
        spatial_bias: 'suburban',
      },
      affluence_proxy: {
        enabled: true,
        base_weight: 0.6,
        confidence: 0.65,
        spatial_bias: 'suburban',
      },
    },
  },
  {
    id: 'home_renovators',
    name: 'Home Renovators',
    description: 'Targeting homeowners actively planning or undertaking home improvement projects',
    audience_intent: 'home_renovators',
    active_signals: {
      planning_approval: {
        enabled: true,
        base_weight: 0.85,
        confidence: 0.75,
        spatial_bias: 'suburban',
      },
      property_age_10_20: {
        enabled: true,
        base_weight: 0.8,
        confidence: 0.7,
        spatial_bias: 'suburban',
      },
      ownership_confidence_high: {
        enabled: true,
        base_weight: 0.8,
        confidence: 0.75,
        spatial_bias: 'suburban',
      },
      affluence_proxy: {
        enabled: true,
        base_weight: 0.7,
        confidence: 0.65,
        spatial_bias: 'suburban',
      },
    },
  },
  {
    id: 'home_owners_general',
    name: 'Home Owners (General)',
    description: 'Broad audience of owner-occupiers representing the core market',
    audience_intent: 'home_owners_general',
    active_signals: {
      ownership_confidence_high: {
        enabled: true,
        base_weight: 0.9,
        confidence: 0.8,
        spatial_bias: 'suburban',
      },
      property_age_10_20: {
        enabled: true,
        base_weight: 0.75,
        confidence: 0.7,
        spatial_bias: 'suburban',
      },
      affluence_proxy: {
        enabled: true,
        base_weight: 0.7,
        confidence: 0.65,
        spatial_bias: 'suburban',
      },
    },
  },
  {
    id: 'planning_approved_booster',
    name: 'Planning Approved Booster',
    description: 'High-intent audience with recent planning permission activity',
    audience_intent: 'home_renovators',
    active_signals: {
      planning_approval: {
        enabled: true,
        base_weight: 0.95,
        confidence: 0.85,
        spatial_bias: 'suburban',
      },
      property_age_10_20: {
        enabled: true,
        base_weight: 0.8,
        confidence: 0.75,
        spatial_bias: 'suburban',
      },
      ownership_confidence_high: {
        enabled: true,
        base_weight: 0.85,
        confidence: 0.8,
        spatial_bias: 'suburban',
      },
      affluence_proxy: {
        enabled: true,
        base_weight: 0.75,
        confidence: 0.7,
        spatial_bias: 'suburban',
      },
    },
  },
  {
    id: 'new_build_9_15_years',
    name: 'New Build 9–15 Years',
    description: 'Properties at typical renovation lifecycle point (9–15 years old)',
    audience_intent: 'home_renovators',
    active_signals: {
      property_age_5_10: {
        enabled: true,
        base_weight: 0.7,
        confidence: 0.65,
        spatial_bias: 'suburban',
      },
      property_age_10_20: {
        enabled: true,
        base_weight: 0.8,
        confidence: 0.7,
        spatial_bias: 'suburban',
      },
      ownership_confidence_medium: {
        enabled: true,
        base_weight: 0.7,
        confidence: 0.65,
        spatial_bias: 'suburban',
      },
      affluence_proxy: {
        enabled: true,
        base_weight: 0.65,
        confidence: 0.6,
        spatial_bias: 'suburban',
      },
    },
  },
];

export function getTemplate(id: string): AudienceTemplate | undefined {
  return audienceTemplates.find((t) => t.id === id);
}

export function getAllTemplates(): AudienceTemplate[] {
  return audienceTemplates;
}
