'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, useMap, CircleMarker } from 'react-leaflet';
import { Box, Paper, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import L from 'leaflet';
import { aggregateDistrictsToHexesFromCentroids } from './hexAggregation';
import { HexOverlayLayer } from './HexOverlayLayer';
import { BaseGreyTileLayer } from './BaseGreyTileLayer';
import { useMapResize } from './useMapResize';
import { IncludedDistrict } from '@/features/audience-builder/api/validationResults';
import { BattleZoneDistrict } from '@/features/audience-builder/api/battleZones';
import { DistrictCentroid } from '@/features/audience-builder/api/districtCentroids';

interface StableValidationMapProps {
  includedDistricts: IncludedDistrict[]; // Districts with centroids
  maxAgreement: number;
  overlayMode: 'district' | 'hex';
  hexResolution?: number;
  onOverlayModeChange?: (mode: 'district' | 'hex') => void;
  onHexResolutionChange?: (resolution: number) => void;
  center?: [number, number];
  zoom?: number;
  poiMarkers?: Array<{ id: string; lat: number; lng: number; label: string }>;
  poiDistricts?: Record<string, { count: number; pois: Array<{ id: string; name: string }> }>;
  battleZonesEnabled?: boolean;
  battleZoneDistricts?: BattleZoneDistrict[];
  battleZoneCentroids?: DistrictCentroid[];
  battleZoneBaseBrand?: string;
  battleZoneCompetitorBrands?: string[];
}

// Normalize district code (trim, uppercase, remove spaces)
function normalizeDistrict(district: string): string {
  return district.trim().toUpperCase().replace(/\s+/g, '');
}

// Internal component that uses Leaflet hooks
function MapContent({
  includedDistricts,
  maxAgreement,
  overlayMode,
  hexResolution,
  mapRef,
  poiMarkers = [],
  poiDistricts = {},
  battleZonesEnabled = false,
  battleZoneDistricts = [],
  battleZoneCentroids = [],
  battleZoneBaseBrand,
  battleZoneCompetitorBrands = [],
}: {
  includedDistricts: IncludedDistrict[];
  maxAgreement: number;
  overlayMode: 'district' | 'hex';
  hexResolution: number;
  mapRef: React.MutableRefObject<L.Map | null>;
  poiMarkers?: Array<{ id: string; lat: number; lng: number; label: string }>;
  poiDistricts?: Record<string, { count: number; pois: Array<{ id: string; name: string }> }>;
  battleZonesEnabled?: boolean;
  battleZoneDistricts?: BattleZoneDistrict[];
  battleZoneCentroids?: DistrictCentroid[];
  battleZoneBaseBrand?: string;
  battleZoneCompetitorBrands?: string[];
}) {
  const map = useMap();
  useMapResize();
  
  // Store map reference
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  
  // Refs for layer instances
  const markerLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const poiLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const battleLayerGroupRef = useRef<L.LayerGroup | null>(null);

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

  // Create POI marker layer group ONCE
  useEffect(() => {
    if (!poiLayerGroupRef.current) {
      const layerGroup = L.layerGroup();
      layerGroup.addTo(map);
      poiLayerGroupRef.current = layerGroup;
    }

    return () => {
      if (poiLayerGroupRef.current) {
        map.removeLayer(poiLayerGroupRef.current);
        poiLayerGroupRef.current = null;
      }
    };
  }, [map]);

  // Create battle zones layer group ONCE
  useEffect(() => {
    if (!battleLayerGroupRef.current) {
      const layerGroup = L.layerGroup();
      layerGroup.addTo(map);
      battleLayerGroupRef.current = layerGroup;
    }

    return () => {
      if (battleLayerGroupRef.current) {
        map.removeLayer(battleLayerGroupRef.current);
        battleLayerGroupRef.current = null;
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
      
      // Check if district has POIs
      const districtPoiInfo = poiDistricts[district.district];
      const marker = L.circleMarker([district.centroid_lat, district.centroid_lng], {
        radius: districtPoiInfo ? radius + 1 : radius,
        fillColor: '#3bc8ea',
        fillOpacity,
        color: districtPoiInfo ? '#ff6b00' : '#3bc8ea',
        weight: districtPoiInfo ? 3 : (intensity > 0.7 ? 2 : 1),
        opacity: 0.8,
      });
      
      // Store district code for later reference
      (marker as any).options.district = district.district;
      
      // Build tooltip with agreement and POI info
      let tooltipContent = `
        <div class="custom-tooltip">
          <div class="tooltip-header">${district.district}</div>
          <div class="tooltip-content">
            <span class="tooltip-label">Agreement:</span>
            <span class="tooltip-value">${agreementCount} of ${maxAg}</span>
          </div>
      `;
      if (districtPoiInfo) {
        const poiNames = districtPoiInfo.pois.map(p => p.name).join(', ');
        tooltipContent += `
          <div class="tooltip-content">
            <span class="tooltip-label">Stores:</span>
            <span class="tooltip-value">${poiNames}</span>
          </div>
        `;
      }
      tooltipContent += `</div>`;
      
      marker.bindTooltip(tooltipContent, {
        permanent: false,
        direction: 'top',
        className: 'custom-map-tooltip',
        interactive: false,
      });

      marker.addTo(layerGroup);
    }
  }, [includedDistricts, maxAgreement, overlayMode, poiDistricts]);

  // Update POI markers (always visible, separate layer)
  // Memoize marker IDs to avoid unnecessary updates
  const poiMarkerIds = useMemo(() => {
    return poiMarkers.map(m => m.id).sort().join('|');
  }, [poiMarkers]);

  useEffect(() => {
    if (!poiLayerGroupRef.current) {
      return;
    }

    const layerGroup = poiLayerGroupRef.current;
    layerGroup.clearLayers();

    // Create markers for each POI
    for (const poi of poiMarkers) {
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: 5,
        fillColor: '#666666',
        fillOpacity: 0.8,
        color: '#333333',
        weight: 2,
        opacity: 1,
      });

      // Tooltip with POI info
      const tooltipContent = `
        <div class="custom-tooltip">
          <div class="tooltip-header">${poi.label}</div>
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
  }, [poiMarkerIds, poiMarkers]);

  // Centroid lookup for battle zones (from battleZoneCentroids, not includedDistricts)
  const centroidByDistrictBattle = useMemo(() => {
    const lookup: Record<string, { lat: number; lng: number }> = {};
    for (const centroid of battleZoneCentroids) {
      const normalized = normalizeDistrict(centroid.district);
      if (centroid.centroid_lat && centroid.centroid_lng) {
        lookup[normalized] = {
          lat: centroid.centroid_lat,
          lng: centroid.centroid_lng,
        };
      }
    }
    return lookup;
  }, [battleZoneCentroids]);

  // Stable key for battle zones to prevent unnecessary updates
  const battleKey = useMemo(() => {
    if (!battleZonesEnabled || battleZoneDistricts.length === 0) return '';
    return battleZoneDistricts
      .map(d => `${d.district}:${d.category}:${d.base_store_count}:${d.competitor_store_count}`)
      .sort()
      .join('|');
  }, [battleZonesEnabled, battleZoneDistricts]);

  // Update battle zones markers
  useEffect(() => {
    if (!battleLayerGroupRef.current) {
      return;
    }

    const layerGroup = battleLayerGroupRef.current;
    layerGroup.clearLayers();

    if (!battleZonesEnabled || battleZoneDistricts.length === 0) {
      return;
    }

    let skippedCount = 0;
    const totalBattleDistricts = battleZoneDistricts.length;

    for (const bz of battleZoneDistricts) {
      const normalized = normalizeDistrict(bz.district);
      const centroid = centroidByDistrictBattle[normalized];

      if (!centroid) {
        skippedCount++;
        continue;
      }

      // Styling based on category (grey-only)
      let markerOptions: L.CircleMarkerOptions;
      const categoryLabel = bz.category === 'owned' ? 'Owned' : bz.category === 'contested' ? 'Contested' : 'Competitor-only';

      if (bz.category === 'owned') {
        markerOptions = {
          radius: 6,
          color: '#666',
          weight: 2,
          fillColor: '#999',
          fillOpacity: 0.18,
          opacity: 0.8,
        };
      } else if (bz.category === 'contested') {
        markerOptions = {
          radius: 7,
          color: '#444',
          weight: 3,
          fillColor: '#777',
          fillOpacity: 0.35,
          opacity: 0.8,
        };
      } else {
        // competitor_only
        markerOptions = {
          radius: 6,
          color: '#555',
          weight: 2,
          fillColor: '#888',
          fillOpacity: 0.25,
          opacity: 0.8,
        };
        // Try to add dash array (may not work for CircleMarker, but try)
        (markerOptions as any).dashArray = '4 4';
      }

      const marker = L.circleMarker([centroid.lat, centroid.lng], markerOptions);

      // Build tooltip
      const competitorBrands = bz.competitor_brands_present || [];
      const brandList = competitorBrands.length > 0
        ? competitorBrands.slice(0, 3).join(', ') + (competitorBrands.length > 3 ? ` +${competitorBrands.length - 3} more` : '')
        : 'None';

      const tooltipContent = `
        <div class="custom-tooltip">
          <div class="tooltip-header">${bz.district}</div>
          <div class="tooltip-content">
            <span class="tooltip-label">Zone:</span>
            <span class="tooltip-value">${categoryLabel}</span>
          </div>
          <div class="tooltip-content">
            <span class="tooltip-label">Base stores:</span>
            <span class="tooltip-value">${bz.base_store_count}</span>
          </div>
          <div class="tooltip-content">
            <span class="tooltip-label">Competitor stores:</span>
            <span class="tooltip-value">${bz.competitor_store_count}</span>
          </div>
          ${competitorBrands.length > 0 ? `
          <div class="tooltip-content">
            <span class="tooltip-label">Competitors here:</span>
            <span class="tooltip-value">${brandList}</span>
          </div>
          ` : ''}
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

    const centroidsFound = totalBattleDistricts - skippedCount;
    if (process.env.NODE_ENV === 'development' && totalBattleDistricts > 0) {
      console.log(`[BattleZones] ${centroidsFound}/${totalBattleDistricts} districts mapped to centroids`);
      if (skippedCount > 0) {
        console.warn(`[BattleZones] Skipped ${skippedCount} districts without centroids`);
      }
    }
  }, [battleZonesEnabled, battleKey, centroidByDistrictBattle, battleZoneDistricts]);

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
  overlayMode = 'hex', // Default to hex mode
  hexResolution = 5, // Default to 5 for hex
  onOverlayModeChange,
  onHexResolutionChange,
  center = [54.5, -2.5], // UK center
  zoom = 7, // More zoomed in by default
  poiMarkers = [],
  poiDistricts = {},
  battleZonesEnabled = false,
  battleZoneDistricts = [],
  battleZoneCentroids = [],
  battleZoneBaseBrand,
  battleZoneCompetitorBrands = [],
}: StableValidationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

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
          poiMarkers={poiMarkers}
          poiDistricts={poiDistricts}
          battleZonesEnabled={battleZonesEnabled}
          battleZoneDistricts={battleZoneDistricts}
          battleZoneCentroids={battleZoneCentroids}
          battleZoneBaseBrand={battleZoneBaseBrand}
          battleZoneCompetitorBrands={battleZoneCompetitorBrands}
        />
      </MapContainer>

      {/* Overlay Mode Toggle - Top right */}
      {onOverlayModeChange && (
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
            minWidth: 180,
          }}
        >
          <ToggleButtonGroup
            value={overlayMode}
            exclusive
            onChange={(_, newMode) => {
              if (newMode !== null && onOverlayModeChange) {
                onOverlayModeChange(newMode);
              }
            }}
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
                color: '#999',
                borderColor: 'rgba(0, 0, 0, 0.12)',
                bgcolor: 'white',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(2, 181, 231, 0.1)',
                  color: '#02b5e7',
                  borderColor: 'rgba(2, 181, 231, 0.3)',
                  '&:hover': {
                    backgroundColor: 'rgba(2, 181, 231, 0.15)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
              },
            }}
          >
            <ToggleButton value="district">Points</ToggleButton>
            <ToggleButton value="hex">Hex</ToggleButton>
          </ToggleButtonGroup>

          {overlayMode === 'hex' && onHexResolutionChange && (
            <ToggleButtonGroup
              value={hexResolution}
              exclusive
              onChange={(_, value) => {
                if (value !== null && onHexResolutionChange) {
                  onHexResolutionChange(value as number);
                }
              }}
              size="small"
              fullWidth
              sx={{
                mt: 0.5,
                '& .MuiToggleButton-root': {
                  flex: 1,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  color: '#999',
                  borderColor: 'rgba(0, 0, 0, 0.12)',
                  bgcolor: 'white',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(2, 181, 231, 0.1)',
                    color: '#02b5e7',
                    borderColor: 'rgba(2, 181, 231, 0.3)',
                    '&:hover': {
                      backgroundColor: 'rgba(2, 181, 231, 0.15)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                },
              }}
            >
              <ToggleButton value={3}>3</ToggleButton>
              <ToggleButton value={4}>4</ToggleButton>
              <ToggleButton value={5}>5</ToggleButton>
              <ToggleButton value={6}>6</ToggleButton>
              <ToggleButton value={7}>7</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Paper>
      )}

      {/* Battle Zones Legend - Bottom left */}
      {battleZonesEnabled && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 2000,
            p: 1.5,
            pointerEvents: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            borderRadius: 1,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            minWidth: 140,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 1,
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Battle Zones
          </Typography>
          {battleZoneDistricts.length === 0 ? (
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.65rem',
                color: 'text.secondary',
                fontStyle: 'italic',
              }}
            >
              No battle zones in current filter
            </Typography>
          ) : (
            <>
              {process.env.NODE_ENV === 'development' && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.6rem',
                    color: 'text.secondary',
                    display: 'block',
                    mb: 0.5,
                    fontStyle: 'italic',
                  }}
                >
                  {(() => {
                    const total = battleZoneDistricts.length;
                    const found = battleZoneCentroids.length;
                    return `Battle zones: ${found}/${total} mapped to centroids`;
                  })()}
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#999',
                    opacity: 0.18,
                    border: '1.5px solid #666',
                  }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                  Owned
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    bgcolor: '#777',
                    opacity: 0.35,
                    border: '2px solid #444',
                  }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                  Contested
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#888',
                    opacity: 0.25,
                    border: '1.5px dashed #555',
                  }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                  Competitor-only
                </Typography>
              </Box>
            </Box>
            </>
          )}
        </Paper>
      )}

    </Box>
  );
}
