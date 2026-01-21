import { createClient } from '@/lib/supabase/client';
import { GeoUnit } from '@/lib/types';
import { getConstructionSettings } from './construction';
import { generateBaseGeoUnits, scoreAndSaveGeoUnits } from '../services/geo.generation';

export async function getGeoUnits(audienceId: string): Promise<GeoUnit[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('geo_units')
    .select('*')
    .eq('audience_id', audienceId)
    .order('score', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function generateGeoUnitsFromSignals(
  audienceId: string,
  scaleAccuracy: number = 50
): Promise<void> {
  const supabase = createClient();
  
  // Get construction settings
  const settings = await getConstructionSettings(audienceId);
  if (!settings) {
    throw new Error('Construction settings not found. Please configure signals first.');
  }

  // Generate base geo units (deterministic grid)
  const baseGeoUnits = generateBaseGeoUnits(audienceId, 200);

  // Score and save geo units
  await scoreAndSaveGeoUnits(audienceId, baseGeoUnits, settings, scaleAccuracy);
}

export async function rescoreGeoUnits(
  audienceId: string,
  scaleAccuracy: number
): Promise<void> {
  const supabase = createClient();
  
  // Get existing geo units
  const existing = await getGeoUnits(audienceId);
  if (existing.length === 0) {
    await generateGeoUnitsFromSignals(audienceId, scaleAccuracy);
    return;
  }

  // Get construction settings
  const settings = await getConstructionSettings(audienceId);
  if (!settings) {
    throw new Error('Construction settings not found.');
  }

  // Rescore existing geo units
  // Map GeoUnit[] to ProviderGeoUnit[] format
  const mappedExisting = existing.map(unit => ({
    ...unit,
    drivers: (unit.drivers as any) || {},
  })) as any;
  await scoreAndSaveGeoUnits(audienceId, mappedExisting, settings, scaleAccuracy);
}
