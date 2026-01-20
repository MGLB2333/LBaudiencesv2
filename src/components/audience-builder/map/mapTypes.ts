export type OverlayMode = 'districts' | 'hex';

export interface DistrictFeature {
  district: string;
  geometry: GeoJSON.Polygon;
  centroid_lat?: number;
  centroid_lng?: number;
}

export interface MapFeatureInfo {
  district?: string;
  hexId?: string;
  agreementCount: number;
  maxAgreement: number;
  contributingDistricts?: number;
}
