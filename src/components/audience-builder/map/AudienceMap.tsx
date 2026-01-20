'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { BaseGreyTileLayer } from './BaseGreyTileLayer';
import { DistrictOverlay } from './DistrictOverlay';
import { HexOverlay } from './HexOverlay';
import { useMapResize } from './useMapResize';
import { OverlayMode, MapFeatureInfo } from './mapTypes';
import { GeoJSON } from 'geojson';
import L from 'leaflet';

// Client-only wrapper component to handle map resize and imperative layer control
function MapContent({
  mode,
  districtFeatures,
  includedDistrictIds,
  agreementByDistrict,
  maxAgreement,
  onHover,
}: {
  mode: OverlayMode;
  districtFeatures: Array<{
    district: string;
    geometry: GeoJSON.Polygon;
    centroid_lat?: number;
    centroid_lng?: number;
  }>;
  includedDistrictIds: Set<string>;
  agreementByDistrict: Record<string, number>;
  maxAgreement: number;
  onHover?: (info: MapFeatureInfo) => void;
}) {
  useMapResize();
  
  // Refs to track overlay layer instances (passed to overlays for imperative control)
  const districtOverlayRef = useRef<L.Layer | null>(null);
  const hexOverlayRef = useRef<L.Layer | null>(null);

  // Convert district features to GeoJSON features for DistrictOverlay
  const geoJsonFeatures = useMemo(() => {
    return districtFeatures.map(feature => ({
      type: 'Feature' as const,
      id: feature.district,
      properties: { district: feature.district },
      geometry: feature.geometry,
    }));
  }, [districtFeatures]);

  return (
    <>
      <BaseGreyTileLayer />
      {/* Always mount both overlays - they control their own visibility imperatively */}
      <DistrictOverlay
        features={geoJsonFeatures}
        includedDistrictIds={includedDistrictIds}
        agreementByDistrict={agreementByDistrict}
        maxAgreement={maxAgreement}
        onHover={onHover ? (info) => onHover({ ...info, maxAgreement }) : undefined}
        visible={mode === 'districts'}
        layerRef={districtOverlayRef}
      />
      <HexOverlay
        districtFeatures={districtFeatures}
        includedDistrictIds={includedDistrictIds}
        agreementByDistrict={agreementByDistrict}
        maxAgreement={maxAgreement}
        onHover={onHover}
        visible={mode === 'hex'}
        layerRef={hexOverlayRef}
      />
    </>
  );
}

interface AudienceMapProps {
  center?: [number, number];
  zoom?: number;
  districtFeatures: Array<{
    district: string;
    geometry: GeoJSON.Polygon;
    centroid_lat?: number;
    centroid_lng?: number;
  }>;
  includedDistrictIds: Set<string>;
  agreementByDistrict: Record<string, number>;
  maxAgreement: number;
  onHover?: (info: MapFeatureInfo) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Production-ready interactive map with district/hex overlay toggle
 * Wrapped in React.memo to prevent unnecessary re-renders
 */
function AudienceMapComponent({
  center = [54.5, -2],
  zoom = 6,
  districtFeatures,
  includedDistrictIds,
  agreementByDistrict,
  maxAgreement,
  onHover,
  className,
  style,
}: AudienceMapProps) {
  const [mode, setMode] = useState<OverlayMode>('districts');

  // Guardrail: ensure maxAgreement is at least 1
  const safeMaxAgreement = Math.max(1, maxAgreement);

  const handleModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: OverlayMode | null) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  };

  return (
    <Box 
      sx={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        '& .leaflet-container': {
          filter: 'grayscale(1) brightness(1.05) contrast(1.05)',
        },
        // Ensure Leaflet controls don't overlap our toggle
        '& .leaflet-control-container': {
          zIndex: 400,
        },
      }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', ...style }}
        className={className}
      >
        <MapContent
          mode={mode}
          districtFeatures={districtFeatures}
          includedDistrictIds={includedDistrictIds}
          agreementByDistrict={agreementByDistrict}
          maxAgreement={safeMaxAgreement}
          onHover={onHover}
        />
      </MapContainer>

      {/* Overlay toggle (top-right) */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1200,
          pointerEvents: 'auto',
          bgcolor: 'white',
          borderRadius: 1,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              fontSize: '0.75rem',
              px: 1.5,
              py: 0.5,
              textTransform: 'none',
              border: 'none',
              color: '#02b5e7',
              borderColor: 'rgba(2, 181, 231, 0.3)',
              bgcolor: 'white',
              '&.Mui-selected': {
                backgroundColor: 'rgba(2, 181, 231, 0.1)',
                color: '#02b5e7',
                '&:hover': {
                  backgroundColor: 'rgba(2, 181, 231, 0.15)',
                },
              },
              '&:hover': {
                backgroundColor: 'rgba(2, 181, 231, 0.05)',
              },
            },
          }}
        >
          <ToggleButton value="districts">Districts</ToggleButton>
          <ToggleButton value="hex">Hex</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Legend (bottom-left) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 1200,
          pointerEvents: 'auto',
          bgcolor: 'white',
          borderRadius: 1,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          p: 1.5,
        }}
      >
        <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, mb: 1, display: 'block' }}>
          Agreement intensity
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 12,
              bgcolor: '#808080',
              opacity: 0.1,
              borderRadius: 0.5,
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
            Lower
          </Typography>
          <Box
            sx={{
              width: 40,
              height: 12,
              bgcolor: '#808080',
              opacity: 0.7,
              borderRadius: 0.5,
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
            Higher
          </Typography>
        </Box>
      </Box>

    </Box>
  );
}

// Export memoized component to prevent re-renders when parent updates
export const AudienceMap = React.memo(AudienceMapComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these props change
  // Compare districtFeatures
  if (prevProps.districtFeatures.length !== nextProps.districtFeatures.length) {
    return false;
  }
  for (let i = 0; i < prevProps.districtFeatures.length; i++) {
    if (prevProps.districtFeatures[i].district !== nextProps.districtFeatures[i].district) {
      return false;
    }
  }
  
  // Compare includedDistrictIds (Set comparison)
  if (prevProps.includedDistrictIds.size !== nextProps.includedDistrictIds.size) {
    return false;
  }
  for (const id of prevProps.includedDistrictIds) {
    if (!nextProps.includedDistrictIds.has(id)) {
      return false;
    }
  }
  
  // Compare maxAgreement
  if (prevProps.maxAgreement !== nextProps.maxAgreement) {
    return false;
  }
  
  // Compare agreementByDistrict (shallow comparison)
  const prevKeys = Object.keys(prevProps.agreementByDistrict);
  const nextKeys = Object.keys(nextProps.agreementByDistrict);
  if (prevKeys.length !== nextKeys.length) {
    return false;
  }
  for (const key of prevKeys) {
    if (prevProps.agreementByDistrict[key] !== nextProps.agreementByDistrict[key]) {
      return false;
    }
  }
  
  return true; // Props are equal, skip re-render
});
