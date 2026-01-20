import { GeoJSON } from 'geojson';
import { polygonCentroidFromGeoJson, LatLng } from './geoOrder';

/**
 * Calculate centroid of a GeoJSON polygon
 * Returns [lat, lng] for Leaflet/H3 (null if invalid)
 * @deprecated Use polygonCentroidFromGeoJson from geoOrder.ts instead
 */
export function calculateCentroid(geometry: GeoJSON.Polygon): LatLng | null {
  return polygonCentroidFromGeoJson(geometry);
}

/**
 * Precompute centroids for all district features
 * Returns a Map<district, [lat, lng]> for fast lookup
 */
export function computeCentroidMap(
  features: Array<{
    district: string;
    geometry: GeoJSON.Polygon;
    centroid_lat?: number;
    centroid_lng?: number;
  }>
): Map<string, [number, number]> {
  const centroidMap = new Map<string, [number, number]>();

  features.forEach((feature) => {
    // Use provided centroid if available
    if (feature.centroid_lat != null && feature.centroid_lng != null) {
      if (isFinite(feature.centroid_lat) && isFinite(feature.centroid_lng)) {
        centroidMap.set(feature.district, [feature.centroid_lat, feature.centroid_lng]);
        return;
      }
    }

    // Calculate from geometry
    const centroid = calculateCentroid(feature.geometry);
    if (centroid) {
      centroidMap.set(feature.district, centroid);
    }
  });

  return centroidMap;
}

/**
 * Calculate bounding box of a GeoJSON polygon
 */
export function calculateBbox(geometry: GeoJSON.Polygon): [[number, number], [number, number]] {
  const coordinates = geometry.coordinates[0];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lng, lat] of coordinates) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  return [[minLat, minLng], [maxLat, maxLng]];
}

/**
 * Format district code for display
 */
export function formatDistrictCode(district: string): string {
  return district;
}

/**
 * Format hex ID for display (shortened)
 */
export function formatHexId(hexId: string): string {
  return hexId.slice(0, 8) + '...';
}
