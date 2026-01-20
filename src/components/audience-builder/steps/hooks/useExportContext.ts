import { useMemo, useState, useEffect } from 'react';
import { useAudience } from '@/features/audience-builder/hooks/useAudiences';
import { useConstructionSettings } from '@/features/audience-builder/hooks/useConstruction';
import { useSegments } from '@/features/audience-builder/hooks/useSegments';
import { useValidationResults } from '@/features/audience-builder/hooks/useValidationResults';
import { useProviderImpact } from '@/features/audience-builder/hooks/useProviderImpact';
import { useBuilderContext } from '../../BuilderContext';
import { getSelectedSegmentKeys } from '@/features/audience-builder/api/selectedSegments';
import { getProviderFavicon } from '../../providers/providerIcons';
import { useProviderMetadata } from '@/features/audience-builder/hooks/useProviderMetadata';

export interface SelectedSegment {
  segment_key: string;
  segment_label: string;
  provider?: string;
}

export interface ProviderContribution {
  provider: string;
  providerLabel: string;
  districtsContributed: number;
  percentContributed: number;
  avgConfidence?: number;
  overlapPercent?: number;
  iconUrl: string;
}

export interface ExportContext {
  mode: 'validation' | 'extension';
  audienceName: string;
  audienceId: string;
  lastBuiltAt: string | null;
  activationTarget: 'districts' | 'h3' | 'geojson';
  thresholdLabel: string;
  includedCount: number;
  estimatedHouseholds: number;
  selectedSegments: SelectedSegment[];
  providers: ProviderContribution[];
}

export function useExportContext(audienceId: string): {
  context: ExportContext | null;
  isLoading: boolean;
} {
  const { data: audience } = useAudience(audienceId);
  const { data: settings } = useConstructionSettings(audienceId);
  const { data: segments = [] } = useSegments(audienceId, 'primary', settings?.construction_mode);
  const { state } = useBuilderContext();

  const mode = (state.constructionMode || settings?.construction_mode || 'extension') as 'validation' | 'extension';
  const anchorKey = 'home_movers'; // TODO: derive from anchor segment

  // Get selected segments
  const selectedSegmentKeys = useMemo(() => {
    if (mode === 'extension' && state.includedSegmentKeys.length > 0) {
      return state.includedSegmentKeys;
    }
    return segments.filter(s => s.is_selected).map(s => s.segment_key);
  }, [mode, state.includedSegmentKeys, segments]);

  // Fetch validation results for Validation mode
  const { data: validationResults, isLoading: validationLoading } = useValidationResults({
    segmentKey: anchorKey,
    enabled: mode === 'validation',
  });

  // Fetch provider impact for Extension mode
  const extensionSelectedKeys = useMemo(() => {
    if (mode === 'extension') {
      return selectedSegmentKeys.includes(anchorKey)
        ? selectedSegmentKeys
        : [anchorKey, ...selectedSegmentKeys];
    }
    return [];
  }, [mode, selectedSegmentKeys, anchorKey]);

  const { data: providerImpact, isLoading: impactLoading } = useProviderImpact({
    anchorKey,
    includedSegmentKeys: extensionSelectedKeys,
    confidenceThreshold: 0.5,
    includeAnchorOnly: true,
    enabled: mode === 'extension' && extensionSelectedKeys.length > 0,
  });

  // Fetch selected segments from DB for Extension mode (to get labels)
  // Use a simple state + effect since getSelectedSegmentKeys is async
  const [dbSelectedKeys, setDbSelectedKeys] = useState<string[]>([]);
  
  useEffect(() => {
    if (mode === 'extension') {
      getSelectedSegmentKeys(audienceId)
        .then(setDbSelectedKeys)
        .catch(() => setDbSelectedKeys([]));
    }
  }, [mode, audienceId]);

  // Collect all provider keys to fetch metadata
  const providerKeys = useMemo(() => {
    const keysSet = new Set<string>();
    if (mode === 'validation' && validationResults) {
      Object.keys(validationResults.providerStats || {}).forEach(key => keysSet.add(key));
    } else if (mode === 'extension' && providerImpact) {
      providerImpact.providerStats?.forEach(stat => keysSet.add(stat.provider));
    }
    return Array.from(keysSet);
  }, [mode, validationResults, providerImpact]);
  
  // Fetch provider metadata
  const { data: providerMetadata = [] } = useProviderMetadata(providerKeys);
  const metadataMap = useMemo(() => {
    return new Map(providerMetadata.map(p => [p.provider_key, p]));
  }, [providerMetadata]);

  const isLoading = mode === 'validation' ? validationLoading : impactLoading;

  const context = useMemo((): ExportContext | null => {
    if (!audience || !settings) return null;

    // Build selected segments list
    const selectedSegmentsList: SelectedSegment[] = [];
    if (mode === 'validation') {
      // For validation, show anchor segment
      const anchorSegment = segments.find(s => s.origin === 'brief' && s.provider === 'CCS');
      if (anchorSegment) {
        selectedSegmentsList.push({
          segment_key: anchorSegment.segment_key,
          segment_label: anchorSegment.segment_label,
          provider: anchorSegment.provider,
        });
      }
    } else {
      // For extension, show all selected segments
      const allSelectedKeys = dbSelectedKeys.length > 0 && dbSelectedKeys.includes(anchorKey)
        ? dbSelectedKeys
        : [anchorKey, ...dbSelectedKeys];
      
      for (const key of allSelectedKeys) {
        const segment = segments.find(s => s.segment_key === key);
        if (segment) {
          selectedSegmentsList.push({
            segment_key: segment.segment_key,
            segment_label: segment.segment_label,
            provider: segment.provider,
          });
        } else {
          // Fallback: use key as label
          selectedSegmentsList.push({
            segment_key: key,
            segment_label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          });
        }
      }
    }

    // Build provider contributions
    const providersList: ProviderContribution[] = [];
    
    if (mode === 'validation' && validationResults) {
      const totalIncluded = validationResults.totals.districtsIncluded;
      
      for (const [provider, stats] of Object.entries(validationResults.providerStats)) {
        const districtsContributed = stats.agreeingDistricts || 0;
        const percentContributed = totalIncluded > 0
          ? (districtsContributed / totalIncluded) * 100
          : 0;

        const metadata = metadataMap.get(provider);
        providersList.push({
          provider,
          providerLabel: metadata?.display_name || stats.providerSegmentLabel || provider,
          districtsContributed,
          percentContributed,
          iconUrl: getProviderFavicon(provider, metadata?.logo_url),
        });
      }
    } else if (mode === 'extension' && providerImpact) {
      const totalIncluded = providerImpact.totals.includedDistricts;
      
      for (const stat of providerImpact.providerStats) {
        const percentContributed = totalIncluded > 0
          ? (stat.incrementalDistricts / totalIncluded) * 100
          : 0;

        const metadata = metadataMap.get(stat.provider);
        providersList.push({
          provider: stat.provider,
          providerLabel: metadata?.display_name || stat.provider,
          districtsContributed: stat.incrementalDistricts,
          percentContributed,
          overlapPercent: stat.overlapPct,
          avgConfidence: stat.avgProviderConfidence,
          iconUrl: getProviderFavicon(stat.provider, metadata?.logo_url),
        });
      }
    }

    // Build threshold label
    let thresholdLabel = '—';
    if (mode === 'validation' && validationResults) {
      const minAgreement = state.validationMinAgreement || 1;
      const maxAgreement = validationResults.maxAgreement || 1;
      thresholdLabel = `Min provider agreement: ${minAgreement} of ${maxAgreement}`;
    } else if (mode === 'extension' && providerImpact) {
      const threshold = 0.5; // Default confidence threshold
      thresholdLabel = `Confidence threshold: ≥ ${threshold.toFixed(2)}`;
    }

    // Get included count and estimated households
    let includedCount = 0;
    let estimatedHouseholds = 0;
    
    if (mode === 'validation' && validationResults) {
      includedCount = validationResults.totals.districtsIncluded;
      estimatedHouseholds = includedCount * 2500;
    } else if (mode === 'extension' && providerImpact) {
      includedCount = providerImpact.totals.includedDistricts;
      estimatedHouseholds = providerImpact.totals.estimatedHouseholds;
    }

    return {
      mode,
      audienceName: audience.name,
      audienceId,
      lastBuiltAt: settings.last_run_at || null,
      activationTarget: 'districts', // Default, can be changed by user
      thresholdLabel,
      includedCount,
      estimatedHouseholds,
      selectedSegments: selectedSegmentsList,
      providers: providersList,
    };
  }, [
    audience,
    settings,
    mode,
    segments,
    validationResults,
    providerImpact,
    state.validationMinAgreement,
    dbSelectedKeys,
    anchorKey,
    metadataMap,
  ]);

  return { context, isLoading };
}
