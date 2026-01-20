'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { cellToBoundary, cellToLatLng } from 'h3-js';
import { HexAgg } from './hexAggregation';

interface HexOverlayLayerProps {
  hexes: HexAgg[];
  maxAgreementGlobal: number;
  visible: boolean;
}

/**
 * Convert H3 boundary to Leaflet lat/lng format
 * h3-js cellToBoundary returns coordinates in [lat, lng] order by default
 * But we need to verify and ensure polygon is closed
 */
function toLeafletLatLngs(boundary: number[][]): L.LatLng[] {
  if (boundary.length === 0) return [];
  
  const latLngs: L.LatLng[] = [];
  
  for (const coord of boundary) {
    if (coord.length < 2) continue;
    
    // Try [lat, lng] first (default h3-js format)
    let lat = coord[0];
    let lng = coord[1];
    
    // If values are outside valid lat range, they might be swapped
    // UK lat is ~50-60, lng is ~-8 to 2
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      // Invalid, skip
      console.warn(`[HexOverlay] Invalid coordinate: [${lat}, ${lng}]`);
      continue;
    }
    
    // If lat is in lng range and lng is in lat range, swap them
    if (Math.abs(lat) < 10 && Math.abs(lng) > 45 && Math.abs(lng) < 65) {
      // Likely swapped: first is lng, second is lat
      [lat, lng] = [lng, lat];
    }
    
    latLngs.push(L.latLng(lat, lng));
  }
  
  // Ensure polygon is closed (first point == last point)
  if (latLngs.length > 0) {
    const first = latLngs[0];
    const last = latLngs[latLngs.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) {
      latLngs.push(L.latLng(first.lat, first.lng));
    }
  }
  
  return latLngs;
}

/**
 * Leaflet hex overlay layer component
 * Creates and manages a LayerGroup of H3 hex polygons
 * Updates in-place when hexes change (via render key)
 */
export function HexOverlayLayer({ hexes, maxAgreementGlobal, visible }: HexOverlayLayerProps) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const lastHexKeyRef = useRef<string>('');
  const lastFitKeyRef = useRef<string>('');

  // Create render key from hex list
  const hexKey = hexes.map(h => `${h.h3}:${h.count}:${Math.round(h.avgAgreement * 100)}`).join('|');

  // Create layer group once and ensure it's attached when visible
  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup();
    }
    
    // Immediately add to map if visible
    if (visible && layerGroupRef.current && !map.hasLayer(layerGroupRef.current)) {
      map.addLayer(layerGroupRef.current);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[HEX] Layer group added to map, visible:', visible, 'hexes:', hexes.length);
      }
    }
  }, [map, visible, hexes.length]);

  // Update hex polygons when hexKey changes
  useEffect(() => {
    if (!layerGroupRef.current || hexKey === lastHexKeyRef.current) {
      return;
    }

    // Clear existing layers
    layerGroupRef.current.clearLayers();

    if (hexes.length === 0) {
      lastHexKeyRef.current = hexKey;
      return;
    }

    // Add new hex polygons
    const maxAg = Math.max(1, maxAgreementGlobal);
    let bounds: L.LatLngBounds | null = null;
    // Use formatAsGeoJson=false (default) to get [lat, lng] pairs (Leaflet order)
    const rawBoundarySample = hexes.length > 0 ? cellToBoundary(hexes[0].h3, false) : null;

    for (const hex of hexes) {
      try {
        // Get boundary - try both formats to see which works
        // cellToBoundary with formatAsGeoJson=false returns [lat, lng] (Leaflet order)
        // cellToBoundary with formatAsGeoJson=true returns [lng, lat] (GeoJSON order)
        const boundary = cellToBoundary(hex.h3, false);
        
        // DEV: Log first hex boundary to debug coordinate order
        if (process.env.NODE_ENV !== 'production' && hex === hexes[0]) {
          console.log('[HEX] First hex boundary sample:', {
            h3: hex.h3,
            boundaryLength: boundary.length,
            firstPoint: boundary[0],
            lastPoint: boundary[boundary.length - 1],
            allPoints: boundary.slice(0, 3),
          });
        }
        
        const latLngs = toLeafletLatLngs(boundary);
        
        // DEV: Log first hex latLngs to verify conversion
        if (process.env.NODE_ENV !== 'production' && hex === hexes[0]) {
          console.log('[HEX] First hex Leaflet latLngs:', {
            count: latLngs.length,
            first: latLngs[0] ? [latLngs[0].lat, latLngs[0].lng] : null,
            last: latLngs[latLngs.length - 1] ? [latLngs[latLngs.length - 1].lat, latLngs[latLngs.length - 1].lng] : null,
          });
        }

        // Build bounds for fitBounds (optional)
        if (!bounds) {
          bounds = L.latLngBounds(latLngs);
        } else {
          latLngs.forEach(latLng => bounds!.extend(latLng));
        }

        // Calculate intensity
        const t = Math.max(0, Math.min(1, hex.avgAgreement / maxAg));
        const fillOpacity = 0.06 + t * 0.22;
        const weight = t > 0.7 ? 2 : 1;

        // Create polygon
        const polygon = L.polygon(latLngs, {
          fillColor: '#3bc8ea',
          fillOpacity,
          color: '#3bc8ea',
          weight,
          opacity: 0.6,
        });

        // Tooltip - styled with relevant info only
        const tooltipContent = `
          <div class="custom-tooltip">
            <div class="tooltip-header">Hex area</div>
            <div class="tooltip-content">
              <span class="tooltip-label">Districts:</span>
              <span class="tooltip-value">${hex.count}</span>
            </div>
            <div class="tooltip-content">
              <span class="tooltip-label">Avg agreement:</span>
              <span class="tooltip-value">${hex.avgAgreement.toFixed(1)}</span>
            </div>
          </div>
        `;
        polygon.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'top',
          className: 'custom-map-tooltip',
          interactive: false,
        });

        // Hover effects
        polygon.on({
          mouseover: (e) => {
            const layer = e.target;
            layer.setStyle({
              weight: weight + 1,
              opacity: 0.8,
              fillOpacity: Math.min(1, fillOpacity + 0.08),
            });
          },
          mouseout: (e) => {
            const layer = e.target;
            layer.setStyle({
              weight,
              opacity: 0.6,
              fillOpacity,
            });
          },
        });

        layerGroupRef.current.addLayer(polygon);
      } catch (error) {
        console.warn(`Failed to render hex ${hex.h3}:`, error);
      }
    }

    // DEV: Add debug marker at first hex center
    if (process.env.NODE_ENV !== 'production' && hexes.length > 0) {
      try {
        const topHex = hexes[0];
        const [lat, lng] = cellToLatLng(topHex.h3);
        const debugMarker = L.circleMarker([lat, lng], {
          radius: 4,
          fillOpacity: 0.8,
          color: '#222',
          fillColor: '#222',
          weight: 2,
        });
        debugMarker.bindTooltip('HEX DEBUG', { permanent: false });
        layerGroupRef.current.addLayer(debugMarker);
      } catch (error) {
        console.warn('[HEX DEBUG] Failed to add debug marker:', error);
      }
    }

    // Optional: Fit bounds on first render or when resolution changes
    if (visible && bounds && bounds.isValid() && hexKey !== lastFitKeyRef.current) {
      try {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 8 });
        lastFitKeyRef.current = hexKey;
      } catch (error) {
        console.warn('[HEX] Failed to fit bounds:', error);
      }
    }

    // DEV: Console diagnostics
    if (process.env.NODE_ENV !== 'production') {
      const latLngSample = hexes.length > 0 ? toLeafletLatLngs(cellToBoundary(hexes[0].h3, false))[0] : null;
      const debugCenter = hexes.length > 0 ? cellToLatLng(hexes[0].h3) : null;
      
      // Calculate hex bounds for sanity check
      let hexMinLat = Infinity, hexMaxLat = -Infinity;
      let hexMinLng = Infinity, hexMaxLng = -Infinity;
      if (bounds && bounds.isValid()) {
        hexMinLat = bounds.getSouth();
        hexMaxLat = bounds.getNorth();
        hexMinLng = bounds.getWest();
        hexMaxLng = bounds.getEast();
      }
      
      console.log('[HEX]', {
        visible,
        hexes: hexes.length,
        sample: hexes[0]?.h3,
        boundsValid: bounds?.isValid?.(),
        hexBounds: bounds?.isValid() ? {
          minLat: hexMinLat.toFixed(4),
          maxLat: hexMaxLat.toFixed(4),
          minLng: hexMinLng.toFixed(4),
          maxLng: hexMaxLng.toFixed(4),
        } : null,
        rawBoundarySample: rawBoundarySample?.[0],
        latLngSample: latLngSample ? [latLngSample.lat, latLngSample.lng] : null,
        debugCenter,
      });
      
      // Sanity check: UK should be lat ~50-60, lng ~-8 to 2
      if (bounds?.isValid()) {
        if (hexMinLat < 45 || hexMaxLat > 65 || hexMinLng < -10 || hexMaxLng > 5) {
          console.warn('[HEX] ⚠️  Hex bounds outside expected UK range!');
        }
      }
    }

    lastHexKeyRef.current = hexKey;
  }, [hexKey, hexes, maxAgreementGlobal, visible, map]);

  // Control visibility
  useEffect(() => {
    if (!layerGroupRef.current) return;

    if (visible) {
      if (!map.hasLayer(layerGroupRef.current)) {
        map.addLayer(layerGroupRef.current);
      }
    } else {
      if (map.hasLayer(layerGroupRef.current)) {
        map.removeLayer(layerGroupRef.current);
      }
    }
  }, [visible, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (layerGroupRef.current && map.hasLayer(layerGroupRef.current)) {
        map.removeLayer(layerGroupRef.current);
      }
    };
  }, [map]);

  return null;
}
