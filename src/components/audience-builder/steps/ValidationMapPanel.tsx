'use client';

import React, { memo } from 'react';
import { Box } from '@mui/material';
import dynamic from 'next/dynamic';
import { IncludedDistrict } from '@/features/audience-builder/api/validationResults';
import { BattleZoneDistrict } from '@/features/audience-builder/api/battleZones';
import { DistrictCentroid } from '@/features/audience-builder/api/districtCentroids';

const StableValidationMapClient = dynamic(() => import('../map/StableValidationMap').then(mod => ({ default: mod.StableValidationMap })), { 
  ssr: false,
});

interface ValidationMapPanelProps {
  includedDistricts: IncludedDistrict[];
  maxAgreement: number;
  overlayMode: 'district' | 'hex';
  hexResolution: number;
  onOverlayModeChange?: (mode: 'district' | 'hex') => void;
  onHexResolutionChange?: (resolution: number) => void;
  mounted: boolean;
  poiMarkers?: Array<{ id: string; lat: number; lng: number; label: string }>;
  poiDistricts?: Record<string, { count: number; pois: Array<{ id: string; name: string }> }>;
  battleZonesEnabled?: boolean;
  battleZoneDistricts?: BattleZoneDistrict[];
  battleZoneCentroids?: DistrictCentroid[];
  battleZoneBaseBrand?: string;
  battleZoneCompetitorBrands?: string[];
}

/**
 * Memoized map panel component
 * Only re-renders when map-specific props change
 */
export const ValidationMapPanel = memo(function ValidationMapPanel({
  includedDistricts,
  maxAgreement,
  overlayMode,
  hexResolution = 5,
  onOverlayModeChange,
  onHexResolutionChange,
  mounted,
  poiMarkers = [],
  poiDistricts = {},
  battleZonesEnabled = false,
  battleZoneDistricts = [],
  battleZoneCentroids = [],
  battleZoneBaseBrand,
  battleZoneCompetitorBrands = [],
}: ValidationMapPanelProps) {
  return (
    <Box sx={{ width: '100%', height: '600px', position: 'relative', zIndex: 0 }}>
      {mounted && typeof window !== 'undefined' ? (
        <StableValidationMapClient
          center={[54.5, -2.5]}
          zoom={7}
          includedDistricts={includedDistricts}
          maxAgreement={maxAgreement}
          overlayMode={overlayMode}
          hexResolution={hexResolution}
          onOverlayModeChange={onOverlayModeChange}
          onHexResolutionChange={onHexResolutionChange}
          poiMarkers={poiMarkers}
          poiDistricts={poiDistricts}
          battleZonesEnabled={battleZonesEnabled}
          battleZoneDistricts={battleZoneDistricts}
          battleZoneCentroids={battleZoneCentroids}
          battleZoneBaseBrand={battleZoneBaseBrand}
          battleZoneCompetitorBrands={battleZoneCompetitorBrands}
        />
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div>Loading map...</div>
        </Box>
      )}
    </Box>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these props change
  const prevPoiIds = prevProps.poiMarkers?.map(p => p.id).sort().join(',') || '';
  const nextPoiIds = nextProps.poiMarkers?.map(p => p.id).sort().join(',') || '';
  const prevDistrictKeys = Object.keys(prevProps.poiDistricts || {}).sort().join(',');
  const nextDistrictKeys = Object.keys(nextProps.poiDistricts || {}).sort().join(',');
  const prevBattleKey = prevProps.battleZoneDistricts?.map(d => `${d.district}:${d.category}:${d.base_store_count}:${d.competitor_store_count}`).sort().join('|') || '';
  const nextBattleKey = nextProps.battleZoneDistricts?.map(d => `${d.district}:${d.category}:${d.base_store_count}:${d.competitor_store_count}`).sort().join('|') || '';
  const prevCentroidsKey = prevProps.battleZoneCentroids?.map(c => `${c.district}:${c.centroid_lat}:${c.centroid_lng}`).sort().join('|') || '';
  const nextCentroidsKey = nextProps.battleZoneCentroids?.map(c => `${c.district}:${c.centroid_lat}:${c.centroid_lng}`).sort().join('|') || '';
  
  return (
    prevProps.mounted === nextProps.mounted &&
    prevProps.overlayMode === nextProps.overlayMode &&
    prevProps.hexResolution === nextProps.hexResolution &&
    prevProps.includedDistricts.length === nextProps.includedDistricts.length &&
    prevProps.includedDistricts.map(d => d.district).join('|') === nextProps.includedDistricts.map(d => d.district).join('|') &&
    prevProps.maxAgreement === nextProps.maxAgreement &&
    prevPoiIds === nextPoiIds &&
    prevDistrictKeys === nextDistrictKeys &&
    prevProps.battleZonesEnabled === nextProps.battleZonesEnabled &&
    prevBattleKey === nextBattleKey &&
    prevCentroidsKey === nextCentroidsKey
  );
});
