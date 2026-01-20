'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { ConstructionMode } from '@/lib/types';
import { useConstructionSettings } from '@/features/audience-builder/hooks/useConstruction';
import { useSegments } from '@/features/audience-builder/hooks/useSegments';

interface BuilderState {
  constructionMode: ConstructionMode;
  validationMinAgreement: number;
  includedSegmentKeys: string[];
  selectionConfirmed: boolean;
  selectedProviders: string[]; // Non-CCS providers selected in step 2
  selectedSegmentKey: string | null; // Canonical segment key from geo_district_signals
  tvRegions: string[]; // TV region keys for filtering map (e.g., ['london', 'stv_north'])
  selectedPoiIds: string[]; // Selected store POI IDs (manual selection)
  selectedPoiBrands: string[]; // Selected store POI brands (show all stores for these brands)
  battleZonesEnabled: boolean;
  battleZoneBaseBrand: string;
  battleZoneCompetitorBrands: string[];
  battleZoneRings: number;
  activeTab: 'map' | 'tvInsights'; // Active tab in Build & Explore step
}

interface BuilderContextType {
  state: BuilderState;
  setConstructionMode: (mode: ConstructionMode) => void;
  setValidationMinAgreement: (value: number) => void;
  setIncludedSegmentKeys: (keys: string[]) => void;
  setSelectionConfirmed: (confirmed: boolean) => void;
  setSelectedProviders: (providers: string[], keepSelectionConfirmed?: boolean) => void;
  setSelectedSegmentKey: (segmentKey: string | null) => void;
  setTvRegions: (regions: string[]) => void;
  setSelectedPoiIds: (poiIds: string[]) => void;
  setSelectedPoiBrands: (brands: string[]) => void;
  setBattleZonesEnabled: (enabled: boolean) => void;
  setBattleZoneBaseBrand: (brand: string) => void;
  setBattleZoneCompetitorBrands: (brands: string[]) => void;
  setBattleZoneRings: (rings: number) => void;
  setActiveTab: (tab: 'map' | 'tvInsights') => void;
  confirmSelection: (segmentKey: string, providers: string[]) => void; // Helper to set all selection state at once
  getAllProvidersForBuild: () => string[]; // Returns ['CCS', ...selectedProviders]
}

const BuilderContext = createContext<BuilderContextType | undefined>(undefined);

export function BuilderProvider({ children, audienceId }: { children: ReactNode; audienceId: string }) {
  // Initialize with default values to avoid hydration mismatch
  // These defaults ensure server and client render the same initially
  const [state, setState] = useState<BuilderState>({
    constructionMode: 'extension',
    validationMinAgreement: 1,
    includedSegmentKeys: [],
    selectionConfirmed: false,
    selectedProviders: [],
    selectedSegmentKey: null,
    tvRegions: [],
    selectedPoiIds: [],
    selectedPoiBrands: [],
    battleZonesEnabled: false,
    battleZoneBaseBrand: '',
    battleZoneCompetitorBrands: [],
    battleZoneRings: 0,
    activeTab: 'map',
  });

  // Track if we're on the client to prevent SSR/client mismatches
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only fetch data on client to avoid SSR/client mismatches
  const { data: settings } = useConstructionSettings(audienceId);
  const { data: segments = [] } = useSegments(audienceId, 'primary', settings?.construction_mode);

  // Track if user has explicitly changed mode (to prevent DB from overwriting)
  const hasUserChangedModeRef = useRef(false);

  // Sync with database settings only after client mount AND only if user hasn't changed it
  useEffect(() => {
    if (!isClient) return;
    if (hasUserChangedModeRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[BuilderContext] skipping hydration - user has changed mode');
      }
      return; // Don't overwrite user's choice
    }
    if (settings?.construction_mode) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[BuilderContext] hydrating mode from DB', { dbMode: settings.construction_mode, currentMode: state.constructionMode });
      }
      setState(prev => {
        if (prev.constructionMode !== settings.construction_mode) {
          return { ...prev, constructionMode: settings.construction_mode };
        }
        return prev;
      });
    }
  }, [isClient, settings?.construction_mode]); // Removed state.constructionMode from deps to prevent loops

  // Sync included segments from database only after client mount
  useEffect(() => {
    if (!isClient) return;
    const included = segments.filter(s => s.is_selected).map(s => s.segment_key);
    setState(prev => {
      // Only update if different to avoid unnecessary re-renders
      const prevKeys = prev.includedSegmentKeys.sort().join(',');
      const newKeys = included.sort().join(',');
      if (prevKeys !== newKeys) {
        return { ...prev, includedSegmentKeys: included };
      }
      return prev;
    });
  }, [isClient, segments]);

  const setConstructionMode = (mode: ConstructionMode) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[BuilderContext] setConstructionMode called', { nextValue: mode, currentValue: state.constructionMode });
    }
    hasUserChangedModeRef.current = true; // Mark that user has explicitly changed mode
    setState(prev => {
      // Idempotent: only update if different
      if (prev.constructionMode === mode) return prev;
      if (process.env.NODE_ENV === 'development') {
        console.log('[BuilderContext] updating state', { from: prev.constructionMode, to: mode });
      }
      // Reset selectionConfirmed, selectedProviders, and selectedSegmentKey when mode changes
      return { ...prev, constructionMode: mode, selectionConfirmed: false, selectedProviders: [], selectedSegmentKey: null };
    });
  };

  const setValidationMinAgreement = (value: number) => {
    setState(prev => ({ ...prev, validationMinAgreement: value }));
  };

  const setIncludedSegmentKeys = (keys: string[]) => {
    setState(prev => {
      // Idempotent: only update if different
      const prevKeys = prev.includedSegmentKeys.sort().join(',');
      const newKeys = keys.sort().join(',');
      if (prevKeys === newKeys) return prev;
      // When segments change, reset selectionConfirmed
      return { ...prev, includedSegmentKeys: keys, selectionConfirmed: false };
    });
  };

  const setSelectionConfirmed = (confirmed: boolean) => {
    setState(prev => {
      // Idempotent: only update if different
      if (prev.selectionConfirmed === confirmed) return prev;
      return { ...prev, selectionConfirmed: confirmed };
    });
  };

  const setSelectedProviders = (providers: string[], keepSelectionConfirmed?: boolean) => {
    setState(prev => {
      // Idempotent: only update if different
      const prevProviders = prev.selectedProviders.sort().join(',');
      const newProviders = providers.sort().join(',');
      if (prevProviders === newProviders) return prev;
      // Reset selectionConfirmed when providers change, unless explicitly told to keep it
      return { 
        ...prev, 
        selectedProviders: providers, 
        selectionConfirmed: keepSelectionConfirmed ? prev.selectionConfirmed : false 
      };
    });
  };

  const setSelectedSegmentKey = (segmentKey: string | null) => {
    setState(prev => {
      // Idempotent: only update if different
      if (prev.selectedSegmentKey === segmentKey) return prev;
      // Reset selectionConfirmed when segment key changes
      return { ...prev, selectedSegmentKey: segmentKey, selectionConfirmed: false };
    });
  };

  const confirmSelection = (segmentKey: string, providers: string[]) => {
    // Set all selection state in a single update to avoid race conditions
    setState(prev => ({
      ...prev,
      selectedSegmentKey: segmentKey,
      selectedProviders: providers,
      selectionConfirmed: true,
    }));
  };

  const setTvRegions = (regions: string[]) => {
    setState(prev => {
      // Idempotent: only update if different
      const prevSorted = [...prev.tvRegions].sort().join(',');
      const newSorted = [...regions].sort().join(',');
      if (prevSorted === newSorted) return prev;
      return { ...prev, tvRegions: regions };
    });
  };

  const setSelectedPoiIds = (poiIds: string[]) => {
    setState(prev => {
      // Idempotent: only update if different
      const prevSorted = [...prev.selectedPoiIds].sort().join(',');
      const newSorted = [...poiIds].sort().join(',');
      if (prevSorted === newSorted) return prev;
      return { ...prev, selectedPoiIds: poiIds };
    });
  };

  const setSelectedPoiBrands = (brands: string[]) => {
    setState(prev => {
      // Idempotent: only update if different
      const prevSorted = [...prev.selectedPoiBrands].sort().join(',');
      const newSorted = [...brands].sort().join(',');
      if (prevSorted === newSorted) return prev;
      return { ...prev, selectedPoiBrands: brands };
    });
  };

  const setBattleZonesEnabled = (enabled: boolean) => {
    setState(prev => {
      if (prev.battleZonesEnabled === enabled) return prev;
      return { ...prev, battleZonesEnabled: enabled };
    });
  };

  const setBattleZoneBaseBrand = (brand: string) => {
    setState(prev => {
      if (prev.battleZoneBaseBrand === brand) return prev;
      return { ...prev, battleZoneBaseBrand: brand };
    });
  };

  const setBattleZoneCompetitorBrands = (brands: string[]) => {
    setState(prev => {
      // Idempotent: only update if different
      const prevSorted = [...prev.battleZoneCompetitorBrands].sort().join(',');
      const newSorted = [...brands].sort().join(',');
      if (prevSorted === newSorted) return prev;
      return { ...prev, battleZoneCompetitorBrands: brands };
    });
  };

  const setBattleZoneRings = (rings: number) => {
    setState(prev => {
      if (prev.battleZoneRings === rings) return prev;
      return { ...prev, battleZoneRings: rings };
    });
  };

  const setActiveTab = (tab: 'map' | 'tvInsights') => {
    setState(prev => {
      if (prev.activeTab === tab) return prev;
      return { ...prev, activeTab: tab };
    });
  };

  const getAllProvidersForBuild = (): string[] => {
    // Always include CCS, then selected providers
    return ['CCS', ...state.selectedProviders];
  };

  return (
    <BuilderContext.Provider
      value={{
        state,
        setConstructionMode,
        setValidationMinAgreement,
        setIncludedSegmentKeys,
        setSelectionConfirmed,
        setSelectedProviders,
        setSelectedSegmentKey,
        setTvRegions,
        setSelectedPoiIds,
        setSelectedPoiBrands,
        setBattleZonesEnabled,
        setBattleZoneBaseBrand,
        setBattleZoneCompetitorBrands,
        setBattleZoneRings,
        setActiveTab,
        confirmSelection,
        getAllProvidersForBuild,
      }}
    >
      <div suppressHydrationWarning>
        {children}
      </div>
    </BuilderContext.Provider>
  );
}

export function useBuilderContext(): BuilderContextType {
  const context = useContext(BuilderContext);
  if (!context) {
    // Return safe defaults during SSR if context is not available
    // This should never happen in practice, but prevents hydration errors
    if (typeof window === 'undefined') {
      const defaultContext: BuilderContextType = {
        state: {
          constructionMode: 'extension' as ConstructionMode,
          validationMinAgreement: 1,
          includedSegmentKeys: [],
          selectionConfirmed: false,
          selectedProviders: [],
          selectedSegmentKey: null,
          tvRegions: [],
          selectedPoiIds: [],
          selectedPoiBrands: [],
          battleZonesEnabled: false,
          battleZoneBaseBrand: '',
          battleZoneCompetitorBrands: [],
          battleZoneRings: 0,
          activeTab: 'map',
        },
        setConstructionMode: () => {},
        setValidationMinAgreement: () => {},
        setIncludedSegmentKeys: () => {},
        setSelectionConfirmed: () => {},
        setSelectedProviders: () => {},
        setSelectedSegmentKey: () => {},
        setTvRegions: () => {},
        setSelectedPoiIds: () => {},
        setSelectedPoiBrands: () => {},
        setBattleZonesEnabled: () => {},
        setBattleZoneBaseBrand: () => {},
        setBattleZoneCompetitorBrands: () => {},
        setBattleZoneRings: () => {},
        setActiveTab: () => {},
        confirmSelection: () => {},
        getAllProvidersForBuild: () => ['CCS'],
      };
      return defaultContext;
    }
    throw new Error('useBuilderContext must be used within BuilderProvider');
  }
  return context;
}
