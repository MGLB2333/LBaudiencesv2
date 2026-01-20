export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      audiences: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          target_reach: number | null
          start_date: string | null
          end_date: string | null
          budget_total: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          target_reach?: number | null
          start_date?: string | null
          end_date?: string | null
          budget_total?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          target_reach?: number | null
          start_date?: string | null
          end_date?: string | null
          budget_total?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      audience_segments: {
        Row: {
          id: string
          audience_id: string
          segment_type: 'primary' | 'secondary'
          construction_mode: 'validation' | 'extension'
          provider: string
          segment_key: string
          segment_label: string
          description: string | null
          is_selected: boolean
          weight: number
          created_at: string
        }
        Insert: {
          id?: string
          audience_id: string
          segment_type: 'primary' | 'secondary'
          construction_mode: 'validation' | 'extension'
          provider: string
          segment_key: string
          segment_label: string
          description?: string | null
          is_selected?: boolean
          weight?: number
          created_at?: string
        }
        Update: {
          id?: string
          audience_id?: string
          segment_type?: 'primary' | 'secondary'
          construction_mode?: 'validation' | 'extension'
          provider?: string
          segment_key?: string
          segment_label?: string
          description?: string | null
          is_selected?: boolean
          weight?: number
          created_at?: string
        }
      }
      audience_profile_settings: {
        Row: {
          audience_id: string
          scale_accuracy: number
          reach_mode: 'accuracy' | 'balanced' | 'reach' | null
          derived_audience_size: number | null
          confidence_high: number | null
          confidence_medium: number | null
          confidence_low: number | null
          updated_at: string
        }
        Insert: {
          audience_id: string
          scale_accuracy?: number
          reach_mode?: 'accuracy' | 'balanced' | 'reach' | null
          derived_audience_size?: number | null
          confidence_high?: number | null
          confidence_medium?: number | null
          confidence_low?: number | null
          updated_at?: string
        }
        Update: {
          audience_id?: string
          scale_accuracy?: number
          reach_mode?: 'accuracy' | 'balanced' | 'reach' | null
          derived_audience_size?: number | null
          confidence_high?: number | null
          confidence_medium?: number | null
          confidence_low?: number | null
          updated_at?: string
        }
      }
      geo_units: {
        Row: {
          id: string
          audience_id: string
          geo_type: 'h3' | 'postcode_sector'
          geo_id: string
          score: number
          confidence_tier: 'high' | 'medium' | 'low' | 'discarded'
          drivers: Json | null
          geometry: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          audience_id: string
          geo_type: 'h3' | 'postcode_sector'
          geo_id: string
          score: number
          confidence_tier: 'high' | 'medium' | 'low' | 'discarded'
          drivers?: Json | null
          geometry?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          audience_id?: string
          geo_type?: 'h3' | 'postcode_sector'
          geo_id?: string
          score?: number
          confidence_tier?: 'high' | 'medium' | 'low' | 'discarded'
          drivers?: Json | null
          geometry?: Json | null
          created_at?: string
        }
      }
      poi_layers: {
        Row: {
          id: string
          audience_id: string
          layer_name: string
          layer_type: 'stores' | 'custom'
          metadata: Json | null
          is_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          audience_id: string
          layer_name: string
          layer_type: 'stores' | 'custom'
          metadata?: Json | null
          is_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          audience_id?: string
          layer_name?: string
          layer_type?: 'stores' | 'custom'
          metadata?: Json | null
          is_enabled?: boolean
          created_at?: string
        }
      }
      exports: {
        Row: {
          id: string
          audience_id: string
          user_id: string
          export_type: 'csv' | 'geojson'
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          audience_id: string
          user_id: string
          export_type: 'csv' | 'geojson'
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          audience_id?: string
          user_id?: string
          export_type?: 'csv' | 'geojson'
          storage_path?: string
          created_at?: string
        }
      }
    }
  }
}
