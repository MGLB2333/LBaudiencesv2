import { GeoJSON } from 'geojson';

/**
 * GeoJSON coordinate type: [lng, lat]
 */
export type GeoCoord = [number, number];

/**
 * Leaflet/H3 coordinate type: [lat, lng]
 */
export type LatLng = [number, number];

/**
 * Check if coordinates are likely in [lng, lat] order (GeoJSON)
 * Uses UK-specific heuristics: lat ~50-60, lng ~-8 to 2
 */
export function isProbablyLngLat(coord: [number, number]): boolean {
  const [first, second] = coord;
  
  // UK-specific check: if first value is in lng range and second is in lat range
  const isLngRange = first >= -180 && first <= 180 && Math.abs(first) < 10; // UK lng is ~-8 to 2
  const isLatRange = second >= -90 && second <= 90 && second > 45 && second < 65; // UK lat is ~50-60
  
  // Also check if first is clearly lng (small absolute value) and second is clearly lat (larger)
  if (isLngRange && isLatRange) {
    return true;
  }
  
  // Generic check: if first is outside lat range but second is in lat range
  if (Math.abs(first) > 90 && Math.abs(second) <= 90) {
    return true;
  }
  
  return false;
}

/**
 * Convert GeoJSON coordinate [lng, lat] to Leaflet/H3 format [lat, lng]
 */
export function geoJsonToLatLng(coord: GeoCoord): LatLng {
  const [lng, lat] = coord;
  
  // DEV: Sanity check - throw if values are outside valid ranges
  if (process.env.NODE_ENV !== 'production') {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      console.error('[geoOrder] Invalid coordinate detected:', { lng, lat });
      throw new Error(`Invalid coordinate: lat=${lat} (must be -90..90), lng=${lng} (must be -180..180)`);
    }
  }
  
  return [lat, lng];
}

/**
 * Calculate polygon centroid from GeoJSON geometry
 * Input: GeoJSON Polygon or Feature with coordinates in [lng, lat] order
 * Output: [lat, lng] for Leaflet/H3
 */
export function polygonCentroidFromGeoJson(geometryOrFeature: any): LatLng | null {
  try {
    let geometry: GeoJSON.Polygon;
    
    // Handle Feature or Geometry
    if (geometryOrFeature.type === 'Feature') {
      geometry = geometryOrFeature.geometry;
    } else if (geometryOrFeature.type === 'Polygon') {
      geometry = geometryOrFeature;
    } else {
      console.warn('[geoOrder] Invalid geometry type:', geometryOrFeature.type);
      return null;
    }
    
    if (geometry.type !== 'Polygon') {
      console.warn('[geoOrder] Expected Polygon, got:', geometry.type);
      return null;
    }
    
    const coordinates = geometry.coordinates[0]; // First ring (exterior)
    if (!coordinates || coordinates.length === 0) {
      return null;
    }
    
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;
    
    // GeoJSON coordinates are [lng, lat]
    for (const coord of coordinates) {
      if (!Array.isArray(coord) || coord.length < 2) continue;
      
      const [lng, lat] = coord;
      
      if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
        continue;
      }
      
      // DEV: Sanity check
      if (process.env.NODE_ENV !== 'production') {
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          console.error('[geoOrder] Invalid coordinate in polygon:', { lng, lat });
          // Don't throw, just skip this coordinate
          continue;
        }
      }
      
      sumLat += lat;
      sumLng += lng;
      count++;
    }
    
    if (count === 0) return null;
    
    const avgLat = sumLat / count;
    const avgLng = sumLng / count;
    
    // Return [lat, lng] for Leaflet/H3
    return [avgLat, avgLng];
  } catch (error) {
    console.warn('[geoOrder] Failed to calculate centroid:', error);
    return null;
  }
}
