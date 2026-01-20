'use client';

import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { cellToBoundary, latLngToCell } from 'h3-js';
import L from 'leaflet';
import { computeCentroidMap } from './geoUtils';
import { GeoJSON } from 'geojson';

interface HexOverlayProps {
  districtFeatures: Array<{
    district: string;
    geometry: GeoJSON.Polygon;
    centroid_lat?: number;
    centroid_lng?: number;
  }>;
  includedDistrictIds: Set<string>;
  agreementByDistrict: Record<string, number>;
  maxAgreement: number;
  resolution?: number;
  onHover?: (info: { hexId: string; agreementCount: number; contributingDistricts: number }) => void;
  visible: boolean;
  layerRef: React.MutableRefObject<L.Layer | null>;
}

const DEFAULT_RESOLUTION = 7;

/**
 * Renders H3 hex overlay aggregated from district centroids
 * Creates layer group once, updates styles imperatively
 */
export function HexOverlay({
  districtFeatures,
  includedDistrictIds,
  agreementByDistrict,
  maxAgreement,
  resolution = DEFAULT_RESOLUTION,
  onHover,
  visible,
  layerRef,
}: HexOverlayProps) {
  const map = useMap();
  const polygonLayersRef = useRef<L.Polygon[]>([]);
  
  // Store latest lookups in refs
  const includedDistrictIdsRef = useRef<Set<string>>(includedDistrictIds);
  const agreementByDistrictRef = useRef<Record<string, number>>(agreementByDistrict);
  const maxAgreementRef = useRef<number>(maxAgreement);
  
  // Update refs when props change
  useEffect(() => {
    includedDistrictIdsRef.current = includedDistrictIds;
    agreementByDistrictRef.current = agreementByDistrict;
    maxAgreementRef.current = Math.max(1, maxAgreement);
  }, [includedDistrictIds, agreementByDistrict, maxAgreement]);

  // Guardrail: ensure maxAgreement is at least 1
  const safeMaxAgreement = Math.max(1, maxAgreement);

  // Precompute centroids once (memoized on districtFeatures identity)
  const centroidMap = useMemo(() => {
    return computeCentroidMap(districtFeatures);
  }, [districtFeatures]);

  // Stable style function that reads from refs
  const getHexStyle = useCallback((agreement: number): L.PathOptions => {
    const maxAg = maxAgreementRef.current;
    const baseOpacity = 0.1 + (agreement / maxAg) * 0.6;
    return {
      fillColor: '#808080', // Grey
      fillOpacity: baseOpacity,
      color: '#666666',
      weight: 1,
      opacity: 0.6,
    };
  }, []); // Empty deps - reads from refs

  // Memoize hex aggregation: convert districts to hex cells and aggregate agreement
  const hexData = useMemo(() => {
    const hexMap = new Map<string, { agreement: number; districts: Set<string> }>();

    districtFeatures.forEach((feature) => {
      const district = feature.district;
      if (!includedDistrictIds.has(district)) return;

      // Get centroid from precomputed map
      const centroid = centroidMap.get(district);
      if (!centroid) {
        return;
      }

      const [lat, lng] = centroid;

      // Convert to H3 cell
      try {
        const hexId = latLngToCell(lat, lng, resolution);
        const agreement = agreementByDistrict[district] ?? 0;

        const existing = hexMap.get(hexId);
        if (existing) {
          // Aggregate: use max agreement, track contributing districts
          existing.agreement = Math.max(existing.agreement, agreement);
          existing.districts.add(district);
        } else {
          hexMap.set(hexId, {
            agreement,
            districts: new Set([district]),
          });
        }
      } catch (error) {
        // Skip invalid coordinates
        console.warn(`Failed to convert district ${district} to H3:`, error);
      }
    });

    return Array.from(hexMap.entries()).map(([hexId, data]) => ({
      hexId,
      agreement: data.agreement,
      contributingDistricts: data.districts.size,
    }));
  }, [districtFeatures, includedDistrictIds, agreementByDistrict, resolution, centroidMap]);

  // Create layer group ONCE on mount (only when hexData identity changes)
  useEffect(() => {
    // Clean up existing layers
    polygonLayersRef.current.forEach(layer => map.removeLayer(layer));
    polygonLayersRef.current = [];

    if (hexData.length === 0) {
      layerRef.current = null;
      return;
    }

    // Create a layer group to hold all hex polygons
    const layerGroup = L.layerGroup();
    
    hexData.forEach(({ hexId, agreement, contributingDistricts }) => {
      try {
        // Convert H3 cell to polygon boundary
        const boundary = cellToBoundary(hexId, true); // true = geoJson format
        const latLngs = boundary.map(([lat, lng]) => L.latLng(lat, lng));

        const baseStyle = getHexStyle(agreement);
        const polygon = L.polygon(latLngs, baseStyle);

        // Store hex data on layer for later updates
        (polygon as any)._hexId = hexId;
        (polygon as any)._agreement = agreement;
        (polygon as any)._contributingDistricts = contributingDistricts;

        // Build tooltip
        const tooltipText = `Hex: ${hexId.slice(0, 8)}...\nAgreement: ${agreement} / ${safeMaxAgreement}\nDistricts: ${contributingDistricts}`;
        polygon.bindTooltip(tooltipText, {
          permanent: false,
          direction: 'top',
          className: 'hex-tooltip',
        });

        // Mouse events
        polygon.on({
          mouseover: (e) => {
            const layer = e.target;
            const hoverStyle: L.PathOptions = {
              ...baseStyle,
              weight: 2,
              opacity: 0.8,
              fillOpacity: Math.min(1, (baseStyle.fillOpacity as number) + 0.08),
            };
            layer.setStyle(hoverStyle);
            if (onHover) {
              onHover({
                hexId,
                agreementCount: agreement,
                contributingDistricts,
              });
            }
          },
          mouseout: (e) => {
            const layer = e.target;
            layer.setStyle(baseStyle);
          },
        });

        layerGroup.addLayer(polygon);
        polygonLayersRef.current.push(polygon);
      } catch (error) {
        console.warn(`Failed to render hex ${hexId}:`, error);
      }
    });

    layerGroup.addTo(map);
    layerRef.current = layerGroup;

    // Cleanup on unmount
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      polygonLayersRef.current.forEach(layer => map.removeLayer(layer));
      polygonLayersRef.current = [];
    };
  }, [map, hexData, getHexStyle, safeMaxAgreement, onHover, layerRef]);

  // Control visibility imperatively
  useEffect(() => {
    if (!layerRef.current) return;
    
    if (visible) {
      if (!map.hasLayer(layerRef.current)) {
        map.addLayer(layerRef.current);
      }
    } else {
      if (map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    }
  }, [map, visible, layerRef]);

  // Update styles in-place when lookups change
  useEffect(() => {
    if (!layerRef.current || !visible) return;

    polygonLayersRef.current.forEach((polygon) => {
      const hexId = (polygon as any)._hexId;
      const agreement = agreementByDistrictRef.current[hexId] ?? (polygon as any)._agreement ?? 0;
      
      const newStyle = getHexStyle(agreement);
      polygon.setStyle(newStyle);
      
      // Update tooltip
      const maxAg = maxAgreementRef.current;
      const contributingDistricts = (polygon as any)._contributingDistricts ?? 0;
      const tooltipText = `Hex: ${hexId.slice(0, 8)}...\nAgreement: ${agreement} / ${maxAg}\nDistricts: ${contributingDistricts}`;
      polygon.setTooltipContent(tooltipText);
    });
  }, [includedDistrictIds, agreementByDistrict, maxAgreement, getHexStyle, visible]);

  return null;
}
