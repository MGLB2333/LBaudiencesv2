'use client';

import { Box, Card, CardContent, Typography, Button, Link, Slider, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Switch, FormControlLabel, Accordion, AccordionSummary, AccordionDetails, CircularProgress, Tabs, Tab } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExpandMore, CheckCircle, MapOutlined, LiveTvOutlined } from '@mui/icons-material';
import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useWhyRender } from '@/hooks/useWhyRender';
import { ConstructionMode } from '@/lib/types';
import { useConstructionSettings } from '@/features/audience-builder/hooks/useConstruction';
import { useSegments } from '@/features/audience-builder/hooks/useSegments';
import { useAudience } from '@/features/audience-builder/hooks/useAudiences';
import { useUpdateSegmentSelection } from '@/features/audience-builder/hooks/useSegments';
import { useValidationResults } from '@/features/audience-builder/hooks/useValidationResults';
import { useExtensionSuggestions } from '@/features/audience-builder/hooks/useExtensionSuggestions';
import { useProviderImpact } from '@/features/audience-builder/hooks/useProviderImpact';
import { usePoisByIds, usePoiDistrictMap, usePoisByBrands } from '@/features/audience-builder/hooks/useStorePois';
import { StorePoi } from '@/features/audience-builder/api/storePois';
import { useBattleZoneDistricts } from '@/features/audience-builder/hooks/useBattleZones';
import { useDistrictCentroids } from '@/features/audience-builder/hooks/useDistrictCentroids';
import { useBuilderContext } from '../BuilderContext';
import { toggleSelectedSegment, getSelectedSegmentKeys } from '@/features/audience-builder/api/selectedSegments';
import * as geoDistrictsApi from '@/features/audience-builder/api/geoDistricts';
import { GeoJSON } from 'geojson';
import { ValidationMapPanel } from './ValidationMapPanel';
import { ValidationSidebar } from './ValidationSidebar';
import { ExtensionSidebar } from './ExtensionSidebar';
import { MapToolDrawer } from './MapToolDrawer';
import { StorePoiPicker } from '../map/StorePoiPicker';
import { BattleZonesSection } from './BattleZonesSection';
import { TvRegionFilter } from './TvRegionFilter';
import { IncludedDistrict } from '@/features/audience-builder/api/validationResults';
import { useQuery } from '@tanstack/react-query';
import { getDistrictsByTvRegion } from '@/features/audience-builder/api/tvRegions';
import { TvSpotInsightsPanel } from '../tv-insights/TvSpotInsightsPanel';


interface BuildExploreStepProps {
  audienceId: string;
  onNext: () => void;
  onBack: () => void;
}

const PROVIDER_ICONS: Record<string, string> = {
  CCS: 'https://www.dentsu.com/favicon.ico',
  Experian: 'https://www.experian.co.uk/favicon.ico',
  ONS: 'https://www.ons.gov.uk/favicon.ico',
  Outra: 'https://www.outra.com/favicon.ico',
  YouGov: 'https://yougov.co.uk/favicon.ico',
  TwentyCI: 'https://www.twentyci.co.uk/favicon.ico',
};

function ProviderAvatar({ provider }: { provider: string }) {
  const iconUrl = PROVIDER_ICONS[provider];
  return (
    <Avatar
      src={iconUrl}
      sx={{ width: 22, height: 22, fontSize: '0.7rem', bgcolor: '#e0e0e0' }}
    >
      {provider.charAt(0)}
    </Avatar>
  );
}

export function BuildExploreStep({ audienceId, onNext, onBack }: BuildExploreStepProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: audience } = useAudience(audienceId);
  const { data: settings } = useConstructionSettings(audienceId);
  const { data: segments = [] } = useSegments(audienceId, 'primary', settings?.construction_mode);
  const updateSegmentSelection = useUpdateSegmentSelection();
  const { state, setValidationMinAgreement, setIncludedSegmentKeys, getAllProvidersForBuild, confirmSelection, setTvRegions, setSelectedPoiIds, setSelectedPoiBrands, setBattleZonesEnabled, setBattleZoneBaseBrand, setBattleZoneCompetitorBrands, setBattleZoneRings, setActiveTab } = useBuilderContext();
  const selectionConfirmed = state.selectionConfirmed;
  const hasValidSelection = Boolean(state.selectionConfirmed && state.selectedSegmentKey && state.selectedSegmentKey.length > 0);
  const [mounted, setMounted] = useState(false);
  const [waitingForState, setWaitingForState] = useState(true);
  const [activeTool, setActiveTool] = useState<'stores' | 'locations' | 'battleZones' | null>(null);
  
  // Mark as mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync activeTab with URL param (optimized to prevent flicker)
  useEffect(() => {
    if (mounted) {
      const tabParam = searchParams?.get('tab');
      if (tabParam === 'tvInsights' || tabParam === 'map') {
        if (state.activeTab !== tabParam) {
          // Update immediately for smooth transition
          setActiveTab(tabParam);
        }
      } else if (!tabParam && state.activeTab !== 'map') {
        // Default to map if no tab param
        setActiveTab('map');
      }
    }
  }, [mounted, searchParams, state.activeTab, setActiveTab]);

  // Update URL when tab changes (optimized to prevent flicker)
  const handleTabChange = (newValue: 'map' | 'tvInsights') => {
    // Update state immediately for instant UI feedback
    setActiveTab(newValue);
    // Update URL without scroll, using replace to avoid history stack
    const currentTab = searchParams?.get('tab');
    if (currentTab !== newValue) {
      router.replace(`/audiences/${audienceId}/builder?step=3&tab=${newValue}`, { scroll: false });
    }
  };

  // Initialize slider values from context on mount
  useEffect(() => {
    if (mounted && state.validationMinAgreement) {
      setSliderDraft(state.validationMinAgreement);
      setSliderApplied(state.validationMinAgreement);
    }
  }, [mounted]); // Only run on mount

  // Use settings for construction mode if available, otherwise fall back to context
  const constructionMode = (mounted && settings?.construction_mode) ? settings.construction_mode : state.constructionMode;
  
  // Wait for state to be ready after navigation (give context time to update)
  // Also check sessionStorage as fallback and load from database
  useEffect(() => {
    if (!mounted) return;
    
    // If we already have valid selection, we're good
    if (hasValidSelection) {
      setWaitingForState(false);
      return;
    }
    
    // Check sessionStorage as fallback (extended window for refresh scenarios)
    try {
      const stored = sessionStorage.getItem(`audience_${audienceId}_selection`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Extended window: 30 seconds (to handle refresh scenarios)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
          if (parsed.segmentKey && parsed.providers) {
            // Restore from sessionStorage
            confirmSelection(parsed.segmentKey, parsed.providers);
            setWaitingForState(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read selection from sessionStorage:', e);
    }
    
    // For Extension mode: try loading from database
    if (constructionMode === 'extension') {
      const loadFromDb = async () => {
        try {
          const { getSelectedSegmentKeys } = await import('@/features/audience-builder/api/selectedSegments');
          const keys = await getSelectedSegmentKeys(audienceId);
          // If we have segments in DB, infer that selection was confirmed
          if (keys.length > 0) {
            const anchorKey = 'home_movers'; // Default anchor
            const segmentKey = keys.includes(anchorKey) ? anchorKey : keys[0];
            // For extension, providers are determined by selected segments
            // We can't fully restore providers from DB, but we can at least restore segmentKey
            confirmSelection(segmentKey, []); // Providers will be determined by extension logic
            setWaitingForState(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to load selection from database:', e);
        }
        // If DB load fails or no segments, stop waiting after timeout
        setTimeout(() => setWaitingForState(false), 500);
      };
      loadFromDb();
      return;
    }
    
    // For Validation mode or if Extension DB load doesn't work, wait a bit then stop waiting
    const timeoutId = setTimeout(() => {
      setWaitingForState(false);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [mounted, hasValidSelection, audienceId, constructionMode, confirmSelection]);
  
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [justificationModalOpen, setJustificationModalOpen] = useState(false);
  const [expandedExplain, setExpandedExplain] = useState<string | null>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  // Two slider states: draft (UI) and applied (map computations)
  const [sliderDraft, setSliderDraft] = useState(1);
  const [sliderApplied, setSliderApplied] = useState(1);
  // Overlay mode state
  const [overlayMode, setOverlayMode] = useState<'district' | 'hex'>('hex');
  const [hexResolution, setHexResolution] = useState(5);
  // POI filters state
  const [selectedPoiTypes, setSelectedPoiTypes] = useState<string[]>([]);
  // Battleground state
  const [battlegroundConfig, setBattlegroundConfig] = useState<any>(null);
  // Extension mode state
  const [confidenceThresholdDraft, setConfidenceThresholdDraft] = useState(0.5);
  const [confidenceThresholdApplied, setConfidenceThresholdApplied] = useState(0.5);
  const [selectedExtensionSegments, setSelectedExtensionSegments] = useState<string[]>([]);
  
  // Render count tracking (DEV only) - read-only, no setState
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  
  // Filter segments
  const anchorSegment = segments.find(s => s.origin === 'brief' && s.provider === 'CCS');
  const suggestedSegments = segments.filter(s => s.origin === 'suggested' || s.match_type === 'inferred');
  const includedSegments = segments.filter(s => s.is_selected);
  
  // Use selectedSegmentKey from context (set in Step 2)
  const selectedSegmentKey = state.selectedSegmentKey;
  
  // For backward compatibility, fallback to anchorSegment if selectedSegmentKey not set
  // But in MVP, selectedSegmentKey should always be set from Step 2
  const anchorKey = selectedSegmentKey || anchorSegment?.segment_key || 'home_movers';
  const anchorLabel = anchorSegment?.segment_label || (selectedSegmentKey ? selectedSegmentKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Home Movers');
  
  // Extension mode: load selected segments from database on mount OR use context
  useEffect(() => {
    if (!mounted || constructionMode !== 'extension' || !anchorKey) return;

    // If context has segments, use those (they come from Step 2 confirmation)
    if (state.includedSegmentKeys.length > 0) {
      const anchorKeyStr = String(anchorKey);
      const segmentKeys: string[] = Array.isArray(state.includedSegmentKeys) ? state.includedSegmentKeys : [];
      const keysWithAnchor = segmentKeys.includes(anchorKeyStr) 
        ? [...segmentKeys] 
        : [anchorKeyStr, ...segmentKeys];
      setSelectedExtensionSegments(keysWithAnchor);
      return;
    }

    // Otherwise load from DB
    getSelectedSegmentKeys(audienceId)
      .then((keys) => {
        // Ensure anchor is always included
        const keysWithAnchor = keys.includes(anchorKey) ? keys : [anchorKey, ...keys];
        setSelectedExtensionSegments(keysWithAnchor);
        setIncludedSegmentKeys(keysWithAnchor);
      })
      .catch((error) => {
        console.error('Failed to load selected segments:', error);
        // Fallback to anchor only
        setSelectedExtensionSegments([anchorKey]);
        setIncludedSegmentKeys([anchorKey]);
      });
  }, [mounted, constructionMode, anchorKey, audienceId, state.includedSegmentKeys, setIncludedSegmentKeys]);
  
  // Extension mode hooks
  const { data: extensionSuggestions = [], isLoading: suggestionsLoading } = useExtensionSuggestions({
    anchorKey,
    enabled: constructionMode === 'extension' && mounted && !!anchorKey,
  });
  
  // For Extension mode, prefer context (from Step 2 confirmation), fallback to local state
  // For Extension mode, use selectedSegmentKey as the anchor (MVP: single segment)
  const extensionSelectedKeys = useMemo(() => {
    if (constructionMode === 'extension' && selectedSegmentKey) {
      // MVP: Extension mode uses the selected segment key only
      return [selectedSegmentKey];
    }
    return [];
  }, [constructionMode, selectedSegmentKey]);
  
  // Get selected providers for the build
  const selectedProviders = useMemo(() => {
    if (!hasValidSelection) return undefined;
    return getAllProvidersForBuild();
  }, [hasValidSelection, getAllProvidersForBuild]);
  
  const { data: providerImpact, isLoading: providerImpactLoading } = useProviderImpact({
    anchorKey: selectedSegmentKey || anchorKey,
    includedSegmentKeys: extensionSelectedKeys,
    confidenceThreshold: confidenceThresholdApplied,
    includeAnchorOnly: true,
    providers: constructionMode === 'extension' ? selectedProviders : undefined,
    tvRegions: state.tvRegions.length > 0 ? state.tvRegions : undefined,
    enabled: constructionMode === 'extension' && mounted && extensionSelectedKeys.length > 0 && hasValidSelection,
  });
  
  // Memoize includedSegmentKeys to prevent unnecessary re-renders
  const includedSegmentKeys = useMemo(() => {
    if (constructionMode === 'extension') {
      return extensionSelectedKeys;
    }
    return includedSegments.map(s => s.segment_key);
  }, [constructionMode, extensionSelectedKeys, includedSegments.map(s => s.segment_key).join(',')]);
  
  // Update context when included segments change (setter is now idempotent, so safe to call)
  useEffect(() => {
    setIncludedSegmentKeys(includedSegmentKeys);
  }, [includedSegmentKeys.join(','), setIncludedSegmentKeys]);

  // Fetch validation results with current slider value (minAgreement in query key)
  // Use selectedSegmentKey from context (set in Step 2)
  const segmentKey = selectedSegmentKey || 'home_movers';
  const { data: validationResults, isLoading: validationLoading, error: validationError } = useValidationResults({
    segmentKey,
    minAgreement: sliderApplied, // Pass current slider value so API calculates households for filtered districts
    providers: constructionMode === 'validation' ? selectedProviders : undefined,
    tvRegions: state.tvRegions.length > 0 ? state.tvRegions : undefined,
    enabled: constructionMode === 'validation' && mounted && hasValidSelection,
  });
  
  // Log validation errors
  useEffect(() => {
    if (validationError) {
      console.error('Validation results error:', validationError);
    }
  }, [validationError]);

  // Calculate validation metrics from fetched data
  const validatingProvidersCount = constructionMode === 'validation' && validationResults
    ? validationResults.totals.contributingProvidersCount
    : 0;
  
  // Update maxSliderValue to use contributingProvidersCount from validationResults
  const maxSliderValue = constructionMode === 'validation' && validationResults
    ? Math.max(1, validationResults.totals.contributingProvidersCount)
    : 1;
  
  // Ensure slider values are within bounds
  useEffect(() => {
    if (maxSliderValue > 0) {
      if (sliderDraft > maxSliderValue) {
        setSliderDraft(Math.max(1, maxSliderValue));
      }
      if (sliderApplied > maxSliderValue) {
        setSliderApplied(Math.max(1, maxSliderValue));
      }
    }
  }, [maxSliderValue]);

  // Helper to get district ID from feature
  const getDistrictId = useCallback((feature: GeoJSON.Feature<GeoJSON.Polygon>): string | null => {
    const id = feature.properties?.district || feature.properties?.id || feature.id;
    if (!id) return null;
    return typeof id === 'string' ? id : String(id);
  }, []);

  // Stabilize districtGeoJson - use ALL districts, not just included ones
  // The map overlay will style included districts differently, but all features should be present
  const districtGeoJson = useMemo(() => {
    if (districts.length === 0) {
      return {
        type: 'FeatureCollection' as const,
        features: [],
      };
    }
    
    // Convert ALL districts to GeoJSON FeatureCollection
    const features: GeoJSON.Feature<GeoJSON.Polygon>[] = districts
      .map(d => ({
        type: 'Feature' as const,
        id: d.district,
        properties: { district: d.district },
        geometry: d.geometry,
      }))
      .filter(f => getDistrictId(f) !== null); // Filter out features without IDs
    
    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [districts, getDistrictId]);

  // Stabilize agreementByDistrict - use from validationResults if available
  const agreementByDistrict = useMemo(() => {
    if (constructionMode === 'validation' && validationResults) {
      return validationResults.agreementByDistrict || {};
    } else if (constructionMode === 'extension') {
      const agreementMap: Record<string, number> = {};
      districts.forEach(d => {
        agreementMap[d.district] = d.agreement_count || 0;
      });
      return agreementMap;
    }
    return {};
  }, [constructionMode, validationResults, districts]);

  // Derive included districts with centroids from validationResults
  // Note: validationResults.includedDistricts is already filtered by minAgreement (sliderApplied) in the API
  // MUST be stable reference
  const includedDistricts = useMemo(() => {
    if (constructionMode === 'validation' && validationResults) {
      // validationResults.includedDistricts already contains only districts with agreement >= minAgreement
      // No additional client-side filtering needed
      return validationResults.includedDistricts || [];
    } else if (constructionMode === 'extension' && providerImpact) {
      // Extension mode: use providerImpact results
      return providerImpact.includedDistricts.map(d => ({
        district: d.district,
        centroid_lat: d.centroid_lat,
        centroid_lng: d.centroid_lng,
        agreementCount: d.agreementCount,
        avgConfidence: d.avgConfidence,
        agreeingProviders: d.supportingProviders,
      }));
    }
    return [];
  }, [constructionMode, validationResults, sliderApplied, providerImpact]);

  // Stabilize maxAgreement - use from validationResults if available
  const maxAgreement = useMemo(() => {
    if (constructionMode === 'validation' && validationResults) {
      return validationResults.maxAgreement || 1;
    } else if (constructionMode === 'extension' && includedDistricts.length > 0) {
      // Extension mode: max agreement is max support count across included districts
      const maxAg = includedDistricts.reduce((max, d) => Math.max(max, d.agreementCount), 0);
      return Math.max(1, maxAg);
    }
    return 1;
  }, [constructionMode, validationResults, includedDistricts]);

  // Create canonical feature ID set from districts
  const featureIdSet = useMemo(() => {
    const ids = new Set<string>();
    districts.forEach(d => {
      if (d.district) ids.add(d.district);
    });
    return ids;
  }, [districts]);

  // For backward compatibility: includedDistrictIds
  const includedDistrictIds = useMemo(() => 
    includedDistricts.map(d => d.district).sort(),
    [includedDistricts]
  );

  // Fetch ALL district geometries (not just included ones) for validation mode
  useEffect(() => {
    if (!mounted || constructionMode !== 'validation') return;
    
    // Fetch ALL district geometries - don't filter by includedDistricts
    geoDistrictsApi.getGeoDistricts()
      .then(fetchedDistricts => {
        setDistricts(fetchedDistricts);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[BuildExploreStep] Fetched ${fetchedDistricts.length} districts`);
        }
      })
      .catch((error) => {
        console.error('[BuildExploreStep] Error fetching districts:', error);
        setDistricts([]);
      });
  }, [mounted, constructionMode]);

  // Fetch districts for extension mode
  // Extension mode: districts come from providerImpact, no need to fetch separately
  // Validation mode: districts are fetched separately (existing logic below)

  // Slider handlers: draft for UI, applied for map computations
  const handleSliderChange = (_event: Event | React.SyntheticEvent, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    const currentMax = maxSliderValue > 0 ? maxSliderValue : 4;
    const clampedValue = Math.max(1, Math.min(value, currentMax));
    setSliderDraft(clampedValue); // Update UI immediately
  };

  const handleSliderChangeCommitted = (_event: Event | React.SyntheticEvent, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    const currentMax = maxSliderValue > 0 ? maxSliderValue : 4;
    const clampedValue = Math.max(1, Math.min(value, currentMax));
    setSliderApplied(clampedValue); // Update map computations only on commit
  };

  const handlePoiTypeToggle = useCallback((poiType: string) => {
    setSelectedPoiTypes((prev) => {
      if (prev.includes(poiType)) {
        return prev.filter((t) => t !== poiType);
      } else {
        return [...prev, poiType];
      }
    });
  }, []);

  const handleBattlegroundClick = useCallback(() => {
    // The dialog is handled inside ValidationSidebar
    // This can be used for external handling if needed
  }, []);

  // Extension mode handlers
  const handleConfidenceThresholdChange = useCallback((value: number) => {
    setConfidenceThresholdDraft(value);
  }, []);

  const handleConfidenceThresholdCommit = useCallback((value: number) => {
    setConfidenceThresholdApplied(value);
  }, []);

  const handleExtensionSegmentToggle = useCallback(async (segmentKey: string, isSelected: boolean) => {
    // Don't allow deselecting anchor
    if (!isSelected && segmentKey === anchorKey) return;

    // Update local state immediately
    setSelectedExtensionSegments((prev) => {
      if (isSelected) {
        return prev.includes(segmentKey) ? prev : [...prev, segmentKey];
      } else {
        return prev.filter((k) => k !== segmentKey);
      }
    });

    // Persist to database (debounced by React Query)
    try {
      await toggleSelectedSegment(audienceId, segmentKey, isSelected);
    } catch (error) {
      console.error('Failed to persist segment selection:', error);
      // Revert on error
      setSelectedExtensionSegments((prev) => {
        if (isSelected) {
          return prev.filter((k) => k !== segmentKey);
        } else {
          return prev.includes(segmentKey) ? prev : [...prev, segmentKey];
        }
      });
    }
  }, [anchorKey, audienceId]);

  const handleToggleSegment = async (segmentId: string, isSelected: boolean) => {
    await updateSegmentSelection.mutateAsync({
      segmentId,
      isSelected,
    });
  };
  // Calculate metrics synchronously from derived data
  const districtsIncluded = includedDistrictIds.length;
  // Use estimatedHouseholds from validationResults if available, otherwise calculate from districts
  // Note: validationResults.totals.estimatedHouseholds now uses real household sums
  const audienceSize = constructionMode === 'validation' && validationResults?.totals?.estimatedHouseholds
    ? validationResults.totals.estimatedHouseholds
    : districtsIncluded * 2500; // Fallback for extension mode or when validationResults not available
  
  // Calculate TV region counts for explanatory copy
  const { data: tvRegionDistricts = [] } = useQuery({
    queryKey: ['tvRegionDistricts', state.tvRegions],
    queryFn: () => getDistrictsByTvRegion(state.tvRegions),
    enabled: state.tvRegions.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch POIs from both sources: brands and individual IDs
  const { data: brandPois = [] } = usePoisByBrands(state.selectedPoiBrands);
  const { data: individualPois = [] } = usePoisByIds(state.selectedPoiIds);

  // Merge and dedupe POIs from both sources
  const displayPois = useMemo(() => {
    const poiMap = new Map<string, StorePoi>();
    
    // Add brand POIs
    brandPois.forEach(poi => {
      poiMap.set(poi.id, poi);
    });
    
    // Add individual POIs (will overwrite if duplicate, but that's fine)
    individualPois.forEach(poi => {
      poiMap.set(poi.id, poi);
    });
    
    return Array.from(poiMap.values());
  }, [brandPois, individualPois]);

  // Get district mappings for all displayed POIs
  const displayPoiIds = useMemo(() => displayPois.map(p => p.id), [displayPois]);
  const { data: poiDistrictMap = {} } = usePoiDistrictMap(displayPoiIds);

  // Build POI markers for map
  const poiMarkers = useMemo(() => {
    return displayPois.map(poi => ({
      id: poi.id,
      lat: poi.lat,
      lng: poi.lng,
      label: `${poi.brand} - ${poi.name}`,
    }));
  }, [displayPois]);

  // Build POI districts mapping (district -> { count, pois[] })
  const poiDistricts = useMemo(() => {
    const mapping: Record<string, { count: number; pois: Array<{ id: string; name: string }> }> = {};
    
    displayPois.forEach(poi => {
      const districtMapping = poiDistrictMap[poi.id];
      if (districtMapping) {
        const district = districtMapping.district;
        if (!mapping[district]) {
          mapping[district] = { count: 0, pois: [] };
        }
        mapping[district].count++;
        mapping[district].pois.push({ id: poi.id, name: poi.name });
      }
    });
    
    return mapping;
  }, [displayPois, poiDistrictMap]);

  const tvRegionDistrictsCount = useMemo(() => {
    if (state.tvRegions.length === 0) return undefined;
    return tvRegionDistricts.length;
  }, [state.tvRegions.length, tvRegionDistricts.length]);

  const finalEligibleCount = useMemo(() => {
    if (state.tvRegions.length === 0) return undefined;
    if (constructionMode === 'validation' && validationResults) {
      // For validation: eligible districts after TV region filter
      return validationResults.eligibleDistrictIds.length;
    } else if (constructionMode === 'extension' && providerImpact) {
      // For extension: included districts after TV region filter
      return providerImpact.totals.includedDistricts;
    }
    return undefined;
  }, [state.tvRegions.length, constructionMode, validationResults, providerImpact]);

  // Battle zones data
  const battleZonesOptions = useMemo(() => {
    if (!state.battleZonesEnabled || !state.battleZoneBaseBrand) return null;
    return {
      baseBrand: state.battleZoneBaseBrand,
      competitorBrands: state.battleZoneCompetitorBrands.length > 0 ? state.battleZoneCompetitorBrands : undefined,
      rings: state.battleZoneRings,
      tvRegions: state.tvRegions.length > 0 ? state.tvRegions : undefined,
    };
  }, [
    state.battleZonesEnabled,
    state.battleZoneBaseBrand,
    state.battleZoneCompetitorBrands,
    state.battleZoneRings,
    state.tvRegions,
  ]);

  const { data: battleZoneDistricts = [] } = useBattleZoneDistricts(
    battleZonesOptions,
    state.battleZonesEnabled && !!state.battleZoneBaseBrand
  );

  // Normalize district function (matches validationResults.ts)
  const normalizeDistrict = useCallback((d: string): string => {
    return d.trim().toUpperCase().replace(/\s+/g, '');
  }, []);

  // Get unique battle zone districts for centroid lookup
  const battleDistricts = useMemo(() => {
    if (!state.battleZonesEnabled || battleZoneDistricts.length === 0) {
      return [];
    }
    const districts = battleZoneDistricts.map(d => normalizeDistrict(d.district));
    return Array.from(new Set(districts));
  }, [state.battleZonesEnabled, battleZoneDistricts, normalizeDistrict]);

  // Fetch centroids for battle zone districts
  const { data: battleZoneCentroids = [], isLoading: centroidsLoading } = useDistrictCentroids(
    battleDistricts,
    state.battleZonesEnabled && battleDistricts.length > 0
  );

  // Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && state.battleZonesEnabled) {
      console.log('[BuildExploreStep] Battle zones state:', {
        battleZoneDistrictsCount: battleZoneDistricts.length,
        battleDistrictsCount: battleDistricts.length,
        battleZoneCentroidsCount: battleZoneCentroids.length,
        centroidsLoading,
        sampleDistricts: battleDistricts.slice(0, 5),
        sampleCentroids: battleZoneCentroids.slice(0, 5),
      });
    }
  }, [state.battleZonesEnabled, battleZoneDistricts.length, battleDistricts.length, battleZoneCentroids.length, centroidsLoading]);
  
  // Calculate confidence level from validation results

  // Instrumentation: track what causes re-renders
  useWhyRender('BuildExploreStep', {
    sliderDraft,
    sliderApplied,
    validationResultsDistrictsIncluded: validationResults?.totals?.districtsIncluded,
    districtsLength: districts.length,
    includedDistrictsLength: includedDistricts.length,
  });

  // Show loading state while waiting for context to update after navigation
  // Only show if we're still waiting AND don't have valid selection
  if (waitingForState && mounted && !hasValidSelection) {
    return (
      <Box sx={{ maxWidth: 1400, mx: 'auto', py: 8 }} suppressHydrationWarning>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  // Show empty state if selection not confirmed or missing required data
  // But only if we're not still waiting (give it time to load from DB)
  if (!hasValidSelection && !waitingForState) {
    return (
      <Box sx={{ maxWidth: 1400, mx: 'auto', py: 8 }} suppressHydrationWarning>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Select your audience first
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please go back to the Audience Selection step to confirm your segment choices before viewing the map.
            </Typography>
            <Button
              variant="contained"
              onClick={onBack}
              sx={{
                bgcolor: '#02b5e7',
                '&:hover': { bgcolor: '#02a0d0' },
              }}
            >
              Go to Audience Selection
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }} suppressHydrationWarning>
      {/* Tabs */}
      <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={state.activeTab} 
          onChange={(_, newValue) => handleTabChange(newValue as 'map' | 'tvInsights')}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              minHeight: 48,
            },
          }}
        >
          <Tab 
            icon={<MapOutlined sx={{ fontSize: '1.1rem', mb: 0.5 }} />} 
            iconPosition="start"
            label="Audience visualisation" 
            value="map" 
          />
          <Tab 
            icon={<LiveTvOutlined sx={{ fontSize: '1.1rem', mb: 0.5 }} />} 
            iconPosition="start"
            label="TV spot insights" 
            value="tvInsights" 
          />
        </Tabs>
      </Box>

      {/* Content based on active tab */}
      <Box sx={{ position: 'relative', width: '100%', minHeight: '600px' }}>
        {/* Map panel - keep mounted but hide when not active */}
        <Box 
          sx={{ 
            display: 'flex',
            width: '100%',
            minHeight: '600px',
            borderRadius: 1,
            overflow: 'hidden',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            visibility: state.activeTab === 'map' ? 'visible' : 'hidden',
            opacity: state.activeTab === 'map' ? 1 : 0,
            transition: 'opacity 0.15s ease-out, visibility 0.15s ease-out',
            pointerEvents: state.activeTab === 'map' ? 'auto' : 'none',
            zIndex: state.activeTab === 'map' ? 1 : 0,
          }}
        >
          {/* Map panel - takes remaining space */}
          <Box sx={{ flex: 1, position: 'relative', minHeight: '600px', overflow: 'hidden' }}>
            <ValidationMapPanel
            includedDistricts={includedDistricts}
            maxAgreement={maxAgreement}
            overlayMode={overlayMode}
            hexResolution={hexResolution}
            onOverlayModeChange={setOverlayMode}
            onHexResolutionChange={setHexResolution}
            mounted={mounted}
            poiMarkers={poiMarkers}
            poiDistricts={poiDistricts}
            battleZonesEnabled={state.battleZonesEnabled}
            battleZoneDistricts={battleZoneDistricts}
            battleZoneCentroids={battleZoneCentroids}
            battleZoneBaseBrand={state.battleZoneBaseBrand}
            battleZoneCompetitorBrands={state.battleZoneCompetitorBrands}
          />
          {/* Tool Drawer - positioned inside map container */}
          <MapToolDrawer open={activeTool !== null} tool={activeTool} onClose={() => setActiveTool(null)}>
            <Box sx={{ '& .MuiCard-root, & .MuiPaper-root': { mb: 2, '&:last-child': { mb: 0 } } }}>
              {activeTool === 'stores' ? (
                <StorePoiPicker
                  selectedPoiIds={state.selectedPoiIds}
                  onPoiIdsChange={setSelectedPoiIds}
                  selectedPoiBrands={state.selectedPoiBrands || []}
                  onPoiBrandsChange={setSelectedPoiBrands}
                />
              ) : activeTool === 'locations' ? (
                <Box>
                  <TvRegionFilter
                    selectedRegions={state.tvRegions}
                    onRegionsChange={setTvRegions}
                    tvRegionDistrictsCount={state.tvRegions.length > 0 ? tvRegionDistrictsCount : undefined}
                    finalEligibleCount={finalEligibleCount}
                  />
                  <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1 }}>
                      Nearby districts
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Coming soon: Use district_neighbors to find and highlight adjacent districts.
                    </Typography>
                  </Box>
                </Box>
              ) : activeTool === 'battleZones' ? (
                <BattleZonesSection
                  baseBrand={state.battleZoneBaseBrand}
                  onBaseBrandChange={setBattleZoneBaseBrand}
                  competitorBrands={state.battleZoneCompetitorBrands}
                  onCompetitorBrandsChange={setBattleZoneCompetitorBrands}
                  ringsDraft={state.battleZoneRings}
                  ringsApplied={state.battleZoneRings}
                  onRingsDraftChange={setBattleZoneRings}
                  onRingsApply={setBattleZoneRings}
                  enabled={state.battleZonesEnabled}
                  onEnabledChange={setBattleZonesEnabled}
                  tvRegions={state.tvRegions}
                />
              ) : null}
            </Box>
          </MapToolDrawer>
          </Box>

          {/* Sidebar - fixed width and height */}
          <Box sx={{ width: 380, flexShrink: 0, height: '600px' }}>
          {constructionMode === 'validation' ? (
            <ValidationSidebar
              constructionMode={constructionMode}
              sliderDraft={sliderDraft}
              sliderApplied={sliderApplied}
              maxSliderValue={maxSliderValue}
              validatingProvidersCount={validatingProvidersCount}
              validationLoading={validationLoading}
              onSliderChange={handleSliderChange}
              onSliderChangeCommitted={handleSliderChangeCommitted}
              audienceSize={audienceSize}
              districtsIncluded={districtsIncluded}
              validationResults={validationResults}
              onViewProviders={() => setProviderModalOpen(true)}
              suggestedSegments={suggestedSegments}
              includedSegments={includedSegments}
              onToggleSegment={handleToggleSegment}
              expandedExplain={expandedExplain}
              onToggleExplain={setExpandedExplain}
              selectedTvRegions={state.tvRegions}
              onTvRegionsChange={setTvRegions}
              tvRegionDistrictsCount={tvRegionDistrictsCount}
              finalEligibleCount={finalEligibleCount}
              selectedPoiIds={state.selectedPoiIds}
              onPoiIdsChange={setSelectedPoiIds}
              selectedPoiBrands={state.selectedPoiBrands}
              onPoiBrandsChange={setSelectedPoiBrands}
              activeTool={activeTool}
              onToolClick={setActiveTool}
              overlayMode={overlayMode}
              onOverlayModeChange={setOverlayMode}
              hexResolution={hexResolution}
              onHexResolutionChange={setHexResolution}
            />
            ) : (
              <ExtensionSidebar
              anchorKey={anchorKey}
              anchorLabel={anchorLabel}
              confidenceThreshold={confidenceThresholdApplied}
              confidenceThresholdDraft={confidenceThresholdDraft}
              onConfidenceThresholdChange={handleConfidenceThresholdChange}
              onConfidenceThresholdCommit={handleConfidenceThresholdCommit}
              suggestions={extensionSuggestions}
              selectedSegmentKeys={extensionSelectedKeys}
              onToggleSegment={handleExtensionSegmentToggle}
              providerImpact={providerImpact}
              providerImpactLoading={providerImpactLoading}
              expandedExplain={expandedExplain}
              onToggleExplain={setExpandedExplain}
              selectedTvRegions={state.tvRegions}
              onTvRegionsChange={setTvRegions}
              tvRegionDistrictsCount={tvRegionDistrictsCount}
              finalEligibleCount={finalEligibleCount}
              selectedPoiIds={state.selectedPoiIds}
              onPoiIdsChange={setSelectedPoiIds}
              selectedPoiBrands={state.selectedPoiBrands}
              onPoiBrandsChange={setSelectedPoiBrands}
              activeTool={activeTool}
              onToolClick={setActiveTool}
              overlayMode={overlayMode}
              onOverlayModeChange={setOverlayMode}
              hexResolution={hexResolution}
              onHexResolutionChange={setHexResolution}
            />
          )}
          </Box>
        </Box>

        {/* TV Spot Insights Panel - keep mounted but hide when not active */}
        <Box 
          sx={{ 
            display: 'block',
            minHeight: '600px',
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            visibility: state.activeTab === 'tvInsights' ? 'visible' : 'hidden',
            opacity: state.activeTab === 'tvInsights' ? 1 : 0,
            transition: 'opacity 0.15s ease-out, visibility 0.15s ease-out',
            pointerEvents: state.activeTab === 'tvInsights' ? 'auto' : 'none',
            zIndex: state.activeTab === 'tvInsights' ? 1 : 0,
          }}
        >
          <TvSpotInsightsPanel />
        </Box>
      </Box>

      {/* Navigation buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button variant="outlined" onClick={onBack} size="small" sx={{ fontSize: '0.875rem' }}>
          Back
        </Button>
        <Button variant="contained" onClick={onNext} size="small" sx={{ fontSize: '0.875rem' }}>
          Next
        </Button>
      </Box>

      {/* Justification Modal */}
      {anchorSegment && (
        <Dialog 
          open={justificationModalOpen} 
          onClose={() => setJustificationModalOpen(false)} 
          maxWidth="md" 
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            },
          }}
        >
          <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600, pb: 1 }}>
            Why this segment was selected
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Audience Brief Section */}
              {audience?.description && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1, color: 'text.primary' }}>
                    Based on your audience brief:
                  </Typography>
                  <Box sx={{ p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'text.secondary' }}>
                      {audience.description}
                    </Typography>
                  </Box>
                </Box>
              )}
              
              {/* Segment Match Details */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1, color: 'text.primary' }}>
                  Segment match:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                  <ProviderAvatar provider={anchorSegment.provider || 'CCS'} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem', mb: 0.5 }}>
                      {anchorSegment.segment_label}
                    </Typography>
                    {anchorSegment.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block' }}>
                        {anchorSegment.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
              
              {/* Evidence/Justification */}
              {anchorSegment.evidence && typeof anchorSegment.evidence === 'object' && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1, color: 'text.primary' }}>
                    Selection rationale:
                  </Typography>
                  <Box sx={{ p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'text.secondary' }}>
                      {anchorSegment.evidence.why_selected || 
                       anchorSegment.evidence.justification ||
                       anchorSegment.evidence.reason ||
                       'This segment was automatically selected based on your audience brief. It matches the key characteristics and behaviors described in your brief, providing a strong foundation for audience validation.'}
                    </Typography>
                  </Box>
                </Box>
              )}
              
              {/* Default explanation if no evidence */}
              {(!anchorSegment.evidence || (typeof anchorSegment.evidence === 'object' && !anchorSegment.evidence.why_selected && !anchorSegment.evidence.justification && !anchorSegment.evidence.reason)) && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1, color: 'text.primary' }}>
                    Selection rationale:
                  </Typography>
                  <Box sx={{ p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'text.secondary' }}>
                      This segment was automatically selected based on your audience brief. It matches the key characteristics and behaviors described in your brief, providing a strong foundation for audience validation across multiple data providers.
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button 
              onClick={() => setJustificationModalOpen(false)} 
              variant="contained"
              size="small"
              sx={{ fontSize: '0.875rem' }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Provider Match Modal (Validation Mode) */}
      {constructionMode === 'validation' && validationResults && (
        <Dialog open={providerModalOpen} onClose={() => setProviderModalOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
            Contributing Data Providers: {Object.keys(validationResults.providerStats).length} of {Object.keys(validationResults.providerStats).length + 1}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontSize: '0.8125rem', mb: 1, color: 'text.secondary' }}>
                Confidence increases where multiple sources agree on the same locations.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                Areas included in the audience require at least {sliderApplied} agreeing providers.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* CCS is the base universe */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <ProviderAvatar provider="CCS" />
                <Box sx={{ minWidth: 100 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                    CCS
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                    Base universe provider
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    Defines eligible districts (confidence {'>='} 0.5)
                  </Typography>
                </Box>
                <Box>
                  <CheckCircle sx={{ color: '#4caf50', fontSize: '1.25rem' }} />
                </Box>
              </Box>
              {/* Validating providers */}
              {Object.entries(validationResults.providerStats).map(([provider, stats]: [string, any]) => (
                <Box key={provider} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  <ProviderAvatar provider={provider} />
                  <Box sx={{ minWidth: 100 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {provider}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                      {stats.providerSegmentLabel || 'Validating provider'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Agreeing districts: {stats.agreeingDistricts}
                    </Typography>
                  </Box>
                  <Box>
                    <CheckCircle sx={{ color: '#4caf50', fontSize: '1.25rem' }} />
                  </Box>
                </Box>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProviderModalOpen(false)} size="small" sx={{ fontSize: '0.875rem' }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
