import { Database } from './supabase/database.types';

export type Audience = Database['public']['Tables']['audiences']['Row'];
export type AudienceSegment = Database['public']['Tables']['audience_segments']['Row'] & {
  origin?: 'brief' | 'validated' | 'suggested' | null;
  match_type?: 'name_match' | 'inferred' | null;
  evidence?: any;
  source_providers?: string[] | null;
  metadata?: any;
  added_at?: string | null;
  created_by_mode?: 'validation' | 'extension' | 'manual' | null;
  is_recommended?: boolean | null;
};
export type AudienceProfileSettings = Database['public']['Tables']['audience_profile_settings']['Row'];
export type GeoUnit = Database['public']['Tables']['geo_units']['Row'];
export type PoiLayer = Database['public']['Tables']['poi_layers']['Row'];
export type Export = Database['public']['Tables']['exports']['Row'];

export type ConstructionMode = 'validation' | 'extension';
export type SegmentType = 'primary' | 'secondary';
