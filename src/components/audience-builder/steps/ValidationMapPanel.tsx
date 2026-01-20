'use client';

import React, { memo } from 'react';
import { Box } from '@mui/material';
import dynamic from 'next/dynamic';
import { IncludedDistrict } from '@/features/audience-builder/api/validationResults';

const StableValidationMapClient = dynamic(() => import('../map/StableValidationMap').then(mod => ({ default: mod.StableValidationMap })), { 
  ssr: false,
});

interface ValidationMapPanelProps {
  includedDistricts: IncludedDistrict[];
  maxAgreement: number;
  overlayMode: 'district' | 'hex';
  hexResolution?: number;
  mounted: boolean;
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
  mounted,
}: ValidationMapPanelProps) {
  return (
    <Box sx={{ width: '100%', height: '600px', position: 'relative', zIndex: 0 }}>
      {mounted && typeof window !== 'undefined' ? (
        <StableValidationMapClient
          center={[54.5, -2.5]}
          zoom={7}
          includedDistricts={includedDistricts}
          maxAgreement={maxAgreement}
          initialOverlayMode={overlayMode}
          initialHexResolution={hexResolution}
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
  return (
    prevProps.mounted === nextProps.mounted &&
    prevProps.overlayMode === nextProps.overlayMode &&
    prevProps.hexResolution === nextProps.hexResolution &&
    prevProps.includedDistricts.length === nextProps.includedDistricts.length &&
    prevProps.includedDistricts.map(d => d.district).join('|') === nextProps.includedDistricts.map(d => d.district).join('|') &&
    prevProps.maxAgreement === nextProps.maxAgreement
  );
});
