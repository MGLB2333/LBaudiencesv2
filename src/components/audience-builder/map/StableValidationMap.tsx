'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, useMap, CircleMarker } from 'react-leaflet';
import { Box, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import L from 'leaflet';
import { aggregateDistrictsToHexesFromCentroids } from './hexAggregation';
import { HexOverlayLayer } from './HexOverlayLayer';
import { BaseGreyTileLayer } from './BaseGreyTileLayer';
import { useMapResize } from './useMapResize';
import { IncludedDistrict } from '@/features/audience-builder/api/validationResults';

interface StableValidationMapProps {
  includedDistricts: IncludedDistrict[]; // Districts with centroids
  maxAgreement: number;
  initialOverlayMode?: 'district' | 'hex';
  center?: [number, number];
  zoom?: number;
}

// Internal component that uses Leaflet hooks
function MapContent({
  includedDistricts,
  maxAgreement,
  overlayMode,
  hexResolution,
  mapRef,
}: {
  includedDistricts: IncludedDistrict[];
  maxAgreement: number;
  overlayMode: 'district' | 'hex';
  hexResolution: number;
  mapRef: React.MutableRefObject<L.Map | null>;
}) {
  const map = useMap();
  useMapResize();
  
  // Store map reference
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  
  // Refs for layer instances
  const markerLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Create marker layer group ONCE
  useEffect(() => {
    if (!markerLayerGroupRef.current) {
      const layerGroup = L.layerGroup();
      layerGroup.addTo(map);
      markerLayerGroupRef.current = layerGroup;
    }

    return () => {
      if (markerLayerGroupRef.current) {
        map.removeLayer(markerLayerGroupRef.current);
        markerLayerGroupRef.current = null;
      }
    };
  }, [map]);

  // Update markers when includedDistricts changes
  useEffect(() => {
    if (!markerLayerGroupRef.current || overlayMode !== 'district') {
      return;
    }

    const layerGroup = markerLayerGroupRef.current;
    layerGroup.clearLayers();

    // Create CircleMarkers for each included district
    for (const district of includedDistricts) {
      const agreementCount = district.agreementCount;
      const maxAg = Math.max(1, maxAgreement);
      
      // Normalize intensity (0-1)
      const intensity = maxAg > 0 ? agreementCount / maxAg : 0;
      
      // Styling: grey with opacity based on intensity
      const fillOpacity = 0.15 + intensity * 0.5; // 0.15 to 0.65
      const radius = 3 + intensity * 3; // 3 to 6 pixels
      
      const marker = L.circleMarker([district.centroid_lat, district.centroid_lng], {
        radius,
        fillColor: '#3bc8ea',
        fillOpacity,
        color: '#3bc8ea',
        weight: intensity > 0.7 ? 2 : 1,
        opacity: 0.8,
      });

      // Tooltip - styled with relevant info only
      const tooltipContent = `
        <div class="custom-tooltip">
          <div class="tooltip-header">${district.district}</div>
          <div class="tooltip-content">
            <span class="tooltip-label">Agreement:</span>
            <span class="tooltip-value">${agreementCount} of ${maxAg}</span>
          </div>
        </div>
      `;
      
      marker.bindTooltip(tooltipContent, {
        permanent: false,
        direction: 'top',
        className: 'custom-map-tooltip',
        interactive: false,
      });

      marker.addTo(layerGroup);
    }
  }, [includedDistricts, maxAgreement, overlayMode]);

  // Control overlay visibility imperatively
  useEffect(() => {
    if (overlayMode === 'district') {
      // Show markers
      if (markerLayerGroupRef.current && !map.hasLayer(markerLayerGroupRef.current)) {
        map.addLayer(markerLayerGroupRef.current);
      }
    } else {
      // Hide markers when in hex mode
      if (markerLayerGroupRef.current && map.hasLayer(markerLayerGroupRef.current)) {
        map.removeLayer(markerLayerGroupRef.current);
      }
    }
  }, [map, overlayMode]);

  // Aggregate districts to hexes from centroids
  const hexAggregation = useMemo(() => {
    if (includedDistricts.length === 0) {
      return { hexes: [], hexIdSet: new Set<string>() };
    }
    return aggregateDistrictsToHexesFromCentroids({
      includedDistricts,
      resolution: hexResolution,
    });
  }, [includedDistricts, hexResolution]);

  return (
    <>
      {/* Hex overlay layer - manages its own visibility */}
      <HexOverlayLayer
        hexes={hexAggregation.hexes}
        maxAgreementGlobal={maxAgreement}
        visible={overlayMode === 'hex'}
      />
    </>
  );
}

// Main component
export function StableValidationMap({
  includedDistricts,
  maxAgreement,
  initialOverlayMode = 'hex', // Default to hex mode
  center = [54.5, -2.5], // UK center
  zoom = 7, // More zoomed in by default
}: StableValidationMapProps) {
  const [overlayMode, setOverlayMode] = useState<'district' | 'hex'>(initialOverlayMode);
  const [hexResolution, setHexResolution] = useState(5); // Default to 5 for hex
  const mapRef = useRef<L.Map | null>(null);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const handleModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: 'district' | 'hex' | null) => {
    if (newMode !== null) {
      setOverlayMode(newMode);
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 520, overflow: 'visible' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <BaseGreyTileLayer />
        <MapContent
          includedDistricts={includedDistricts}
          maxAgreement={maxAgreement}
          overlayMode={overlayMode}
          hexResolution={hexResolution}
          mapRef={mapRef}
        />
      </MapContainer>

      {/* Toggle UI - top right */}
      <Paper
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 2000,
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          pointerEvents: 'auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          borderRadius: 1,
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(4px)',
          width: 180, // Fixed width
        }}
      >
        <ToggleButtonGroup
          value={overlayMode}
          exclusive
          onChange={handleModeChange}
          size="small"
          fullWidth
          sx={{
            '& .MuiToggleButton-root': {
              flex: 1,
              px: 1.5,
              py: 0.5,
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'none',
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
          <ToggleButton value="district">Points</ToggleButton>
          <ToggleButton value="hex">Hex</ToggleButton>
        </ToggleButtonGroup>

        {overlayMode === 'hex' && (
          <Box>
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block', 
                mb: 0.5,
                fontSize: '0.7rem',
                color: 'text.secondary',
                fontWeight: 500,
              }}
            >
              Resolution
            </Typography>
            <ToggleButtonGroup
              value={hexResolution}
              exclusive
              onChange={(_, value) => {
                if (value !== null) {
                  setHexResolution(value as number);
                }
              }}
              size="small"
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  flex: 1,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.7rem',
                  fontWeight: 500,
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
              <ToggleButton value={5}>5</ToggleButton>
              <ToggleButton value={6}>6</ToggleButton>
              <ToggleButton value={7}>7</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
      </Paper>

    </Box>
  );
}
