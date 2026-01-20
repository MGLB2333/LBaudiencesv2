import { createClient } from '@/lib/supabase/client';
import { ConstructionSettings } from '../types/signals';
import { ProviderGeoUnit } from '../providers/types';
import { geoScoringEngine } from './scoring.engine';

/**
 * Generate base geo units (deterministic grid covering UK)
 */
export function generateBaseGeoUnits(audienceId: string, count: number = 200): ProviderGeoUnit[] {
  const units: ProviderGeoUnit[] = [];

  // UK coverage areas (deterministic)
  const baseAreas = [
    { lat: 51.5074, lng: -0.1278, name: 'London' },
    { lat: 53.4808, lng: -2.2426, name: 'Manchester' },
    { lat: 52.4862, lng: -1.8904, name: 'Birmingham' },
    { lat: 53.8008, lng: -1.5491, name: 'Leeds' },
    { lat: 51.4816, lng: -3.1791, name: 'Cardiff' },
    { lat: 52.9548, lng: -1.1581, name: 'Nottingham' },
    { lat: 50.9097, lng: -1.4044, name: 'Southampton' },
    { lat: 53.4084, lng: -2.9916, name: 'Liverpool' },
    { lat: 55.9533, lng: -3.1883, name: 'Edinburgh' },
    { lat: 54.9783, lng: -1.6178, name: 'Newcastle' },
  ];

  for (let i = 0; i < count; i++) {
    const base = baseAreas[i % baseAreas.length];
    
    // Deterministic positioning based on index and audienceId
    const seed = simpleHash(audienceId + i.toString());
    const lat = base.lat + ((seed % 1000) / 1000 - 0.5) * 0.4;
    const lng = base.lng + (((seed * 7) % 1000) / 1000 - 0.5) * 0.4;
    
    units.push({
      geo_type: 'h3',
      geo_id: `h3_${audienceId}_${i}_${seed}`,
      score: 0, // Will be scored by engine
      confidence_tier: 'low',
      drivers: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lng - 0.01, lat - 0.01],
          [lng + 0.01, lat - 0.01],
          [lng + 0.01, lat + 0.01],
          [lng - 0.01, lat + 0.01],
          [lng - 0.01, lat - 0.01],
        ]],
      },
    });
  }

  return units;
}

/**
 * Score geo units using the scoring engine and save to database
 */
export async function scoreAndSaveGeoUnits(
  audienceId: string,
  geoUnits: ProviderGeoUnit[],
  settings: ConstructionSettings,
  scaleAccuracy: number
): Promise<void> {
  const supabase = createClient();

  // Score each geo unit
  const scoredUnits = geoUnits.map((unit) => {
    const result = geoScoringEngine.scoreGeoUnit(unit, settings, scaleAccuracy);
    return {
      ...unit,
      score: result.score,
      confidence_tier: result.confidence_tier,
      drivers: result.drivers,
    };
  });

  // Delete existing geo units for this audience
  await supabase
    .from('geo_units')
    .delete()
    .eq('audience_id', audienceId);

  // Insert scored units
  const dbGeoUnits = scoredUnits.map((unit) => ({
    audience_id: audienceId,
    geo_type: unit.geo_type,
    geo_id: unit.geo_id,
    score: unit.score,
    confidence_tier: unit.confidence_tier,
    drivers: unit.drivers,
    geometry: unit.geometry,
  }));

  const { error } = await supabase
    .from('geo_units')
    .insert(dbGeoUnits);

  if (error) throw error;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
