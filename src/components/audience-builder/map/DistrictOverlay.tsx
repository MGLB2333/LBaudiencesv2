'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { GeoJSON } from 'geojson';
import L from 'leaflet';

interface DistrictOverlayProps {
  features: GeoJSON.Feature<GeoJSON.Polygon>[];
  includedDistrictIds: Set<string>;
  agreementByDistrict: Record<string, number>;
  maxAgreement: number;
  onHover?: (info: { district: string; agreementCount: number; maxAgreement: number }) => void;
  visible: boolean;
  layerRef: React.MutableRefObject<L.Layer | null>;
}

/**
 * Renders GeoJSON polygon overlay for postcode districts
 * Creates layer once on mount, updates styles imperatively
 */
export function DistrictOverlay({
  features,
  includedDistrictIds,
  agreementByDistrict,
  maxAgreement,
  onHover,
  visible,
  layerRef,
}: DistrictOverlayProps) {
  const map = useMap();
  
  // Store latest lookups in refs so style function can read them without forcing remounts
  const includedDistrictIdsRef = useRef<Set<string>>(includedDistrictIds);
  const agreementByDistrictRef = useRef<Record<string, number>>(agreementByDistrict);
  const maxAgreementRef = useRef<number>(maxAgreement);
  
  // Update refs when props change
  useEffect(() => {
    includedDistrictIdsRef.current = includedDistrictIds;
    agreementByDistrictRef.current = agreementByDistrict;
    maxAgreementRef.current = Math.max(1, maxAgreement);
  }, [includedDistrictIds, agreementByDistrict, maxAgreement]);

  // Stable style function that reads from refs (doesn't change identity)
  const getStyle = useCallback((feature: GeoJSON.Feature<GeoJSON.Polygon>): L.PathOptions => {
    const district = feature.properties?.district || feature.id;
    const isIncluded = includedDistrictIdsRef.current.has(district as string);
    const agreementCount = agreementByDistrictRef.current[district as string] ?? 0;
    const maxAg = maxAgreementRef.current;
    
    // Calculate opacity based on agreement (0.1 to 0.7 for included, 0.05 for excluded)
    const baseOpacity = isIncluded 
      ? 0.1 + (agreementCount / maxAg) * 0.6 
      : 0.05;
    
    return {
      fillColor: '#808080', // Grey
      fillOpacity: baseOpacity,
      color: '#666666', // Darker grey for stroke
      weight: isIncluded ? 1 : 0.5,
      opacity: 0.6,
    };
  }, []); // Empty deps - function identity never changes, reads from refs

  // Memoize onEachFeature handler - only runs when features change
  const onEachFeature = useCallback((feature: GeoJSON.Feature<GeoJSON.Polygon>, layer: L.Layer) => {
    const district = feature.properties?.district || feature.id;

    // Store district ID on layer for later lookup
    (layer as any)._districtId = district;

    // Initial tooltip binding
    layer.bindTooltip('', {
      permanent: false,
      direction: 'top',
      className: 'district-tooltip',
      style: {
        fontSize: '12px',
        padding: '4px 8px',
      },
    });

    // Mouse events - will use current style from refs
    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        const districtId = (layer as any)._districtId;
        const isIncluded = includedDistrictIdsRef.current.has(districtId);
        const agreementCount = agreementByDistrictRef.current[districtId] ?? 0;
        const maxAg = maxAgreementRef.current;
        
        const baseStyle = getStyle(feature);
        const hoverStyle: L.PathOptions = {
          ...baseStyle,
          weight: 2,
          opacity: 0.8,
          fillOpacity: Math.min(1, (baseStyle.fillOpacity as number) + 0.08),
        };
        layer.setStyle(hoverStyle);
        
        // Update tooltip
        let tooltipText = `District: ${districtId}\n`;
        if (isIncluded) {
          tooltipText += `Providers agreeing: ${agreementCount} / ${maxAg}`;
        } else {
          tooltipText += 'Not included';
        }
        layer.setTooltipContent(tooltipText);
        
        if (onHover && isIncluded) {
          onHover({
            district: districtId,
            agreementCount,
            maxAgreement: maxAg,
          });
        }
      },
      mouseout: (e) => {
        const layer = e.target;
        const baseStyle = getStyle(feature);
        layer.setStyle(baseStyle);
      },
    });
  }, [getStyle, onHover]);

  // Create layer ONCE on mount (only when features change)
  useEffect(() => {
    if (!features || features.length === 0) {
      // Remove existing layer if features become empty
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    // Only create if we don't have a layer yet
    if (!layerRef.current) {
      const geoJsonLayer = L.geoJSON(features as any, {
        style: getStyle,
        onEachFeature,
      });

      geoJsonLayer.addTo(map);
      layerRef.current = geoJsonLayer;
    }

    // Cleanup on unmount
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, features, getStyle, onEachFeature, layerRef]);

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

  // Update styles in-place when lookups change (slider movement)
  useEffect(() => {
    if (!layerRef.current || !visible) return;

    // Update each layer's style based on current lookups
    layerRef.current.eachLayer((layer) => {
      if (layer instanceof L.Path) {
        const districtId = (layer as any)._districtId;
        if (districtId) {
          // Find the feature for this district
          const feature = features.find(
            f => (f.id || f.properties?.district) === districtId
          );
          if (feature) {
            const newStyle = getStyle(feature);
            layer.setStyle(newStyle);
            
            // Update tooltip content
            const isIncluded = includedDistrictIdsRef.current.has(districtId);
            const agreementCount = agreementByDistrictRef.current[districtId] ?? 0;
            const maxAg = maxAgreementRef.current;
            
            let tooltipText = `District: ${districtId}\n`;
            if (isIncluded) {
              tooltipText += `Providers agreeing: ${agreementCount} / ${maxAg}`;
            } else {
              tooltipText += 'Not included';
            }
            layer.setTooltipContent(tooltipText);
          }
        }
      }
    });
  }, [includedDistrictIds, agreementByDistrict, maxAgreement, getStyle, features, visible]);

  return null;
}
