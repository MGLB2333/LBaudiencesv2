import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Simple hash function for deterministic values
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Deterministic "random" number between 0 and 1 based on seed
 */
function deterministicRandom(seed: string): number {
  const hash = simpleHash(seed);
  return (hash % 10000) / 10000;
}

/**
 * Provider-specific configuration for signal generation
 */
interface ProviderConfig {
  coverageBias: number; // Threshold for coverage (0-1) - DEPRECATED, using dropoutRate instead
  noiseAmplitude: number; // How much noise to add (0-1)
  skew: number; // Bias adjustment (-1 to 1)
  dropoutRate: number; // Probability of forcing confidence below 0.5 (0-1)
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  // CCS: 35-60% eligible (confidence >= 0.5)
  CCS: { coverageBias: 0.65, noiseAmplitude: 0.12, skew: 0.05, dropoutRate: 0.00 },
  // Other providers: varied agreement to create meaningful slider distribution
  Experian: { coverageBias: 0.55, noiseAmplitude: 0.14, skew: 0.15, dropoutRate: 0.18 },
  ONS: { coverageBias: 0.45, noiseAmplitude: 0.10, skew: 0.05, dropoutRate: 0.25 },
  TwentyCI: { coverageBias: 0.40, noiseAmplitude: 0.18, skew: 0.20, dropoutRate: 0.30 },
  Outra: { coverageBias: 0.50, noiseAmplitude: 0.12, skew: 0.10, dropoutRate: 0.22 },
};

/**
 * Generate deterministic confidence score for a provider/district/audience combination
 * All randomness is deterministic and includes provider in the seed
 */
function calculateProviderConfidence(
  district: string,
  audienceKey: string,
  provider: string
): number {
  // Base score from district + audience hash (deterministic, same for all providers)
  const baseSeed = `${district}|${audienceKey}`;
  const baseScore = deterministicRandom(baseSeed);

  // Get provider config
  const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.CCS;

  if (provider === 'CCS') {
    // CCS: 35-60% eligible (confidence >= 0.5)
    // Use baseScore + bias to push more districts above 0.5
    const ccsNoiseSeed = `${district}|${audienceKey}|CCS`;
    const ccsNoise = deterministicRandom(ccsNoiseSeed);
    const ccsNoiseSigned = (ccsNoise - 0.5) * 0.12; // Noise range
    // Add slight positive bias to increase coverage
    let confidence = baseScore + ccsNoiseSigned + 0.08;
    confidence = Math.max(0, Math.min(1, confidence));
    return Math.round(confidence * 1000) / 1000;
  }

  // Other providers: Use baseScore + provider-specific noise + skew
  // Provider noise seed MUST include provider
  const providerNoiseSeed = `${district}|${audienceKey}|${provider}`;
  const providerNoiseValue = deterministicRandom(providerNoiseSeed);
  const providerNoise = (providerNoiseValue - 0.5) * 2; // -1 to +1
  
  // Calculate raw confidence
  let confidenceRaw = baseScore + config.skew + (providerNoise * config.noiseAmplitude);
  
  // Apply dropout mechanism (deterministic, provider-specific)
  const dropoutSeed = `drop|${district}|${audienceKey}|${provider}`;
  const dropoutRoll = deterministicRandom(dropoutSeed);
  
  if (dropoutRoll < config.dropoutRate) {
    // Force confidence down (pushes below 0.5 for many cases)
    confidenceRaw = confidenceRaw * 0.35;
  }

  // Clamp to 0-1
  const confidence = Math.max(0, Math.min(1, confidenceRaw));

  return Math.round(confidence * 1000) / 1000; // Round to 3 decimal places
}

/**
 * Generate audience signals for all districts and providers
 */
async function generateAudienceSignals(audienceKeys: string[] = ['home_movers']) {
  console.log(`Generating signals for audiences: ${audienceKeys.join(', ')}`);

  // Fetch all districts (with pagination)
  // Simple pagination helper inline for seed script
  async function fetchAllDistricts() {
    const pageSize = 1000;
    const allDistricts: Array<{ district: string }> = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('geo_districts')
        .select('district')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allDistricts.push(...data);
        hasMore = data.length === pageSize;
        from += pageSize;
      } else {
        hasMore = false;
      }
    }
    return allDistricts;
  }

  const districts = await fetchAllDistricts();

  if (districts.length === 0) {
    throw new Error('No districts found. Please seed geo_districts first.');
  }

  if (districts.length !== 3000) {
    console.warn(`⚠️  Warning: Expected 3000 districts, found ${districts.length}`);
  }

  console.log(`Found ${districts.length} districts`);

  const providers = ['CCS', 'ONS', 'Experian', 'TwentyCI', 'Outra'];

  for (const audienceKey of audienceKeys) {
    console.log(`\n=== Processing ${audienceKey} ===`);
    const signals: Array<{
      district: string;
      audience_key: string;
      provider: string;
      confidence: number;
      evidence: any;
    }> = [];

    // Generate signals for each district/provider combination
    for (const district of districts) {
      for (const provider of providers) {
        const confidence = calculateProviderConfidence(district.district, audienceKey, provider);
        
        signals.push({
          district: district.district,
          audience_key: audienceKey,
          provider,
          confidence,
          evidence: {
            model: 'deterministic_mock',
            notes: 'Aggregated provider-level signal',
          },
        });
      }
    }

    console.log(`Generated ${signals.length} signals for ${audienceKey}`);

    // Delete existing signals for this audience (idempotent)
    console.log('Clearing existing signals...');
    const { error: deleteError } = await supabase
      .from('geo_audience_signals')
      .delete()
      .eq('audience_key', audienceKey);

    if (deleteError) {
      console.warn('Warning: Could not clear existing signals:', deleteError);
    }

    // Insert in batches of 100
    console.log('Inserting signals...');
    const batchSize = 100;
    for (let i = 0; i < signals.length; i += batchSize) {
      const batch = signals.slice(i, i + batchSize);
      const { error } = await supabase
        .from('geo_audience_signals')
        .upsert(batch, { onConflict: 'district,audience_key,provider' });

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        throw error;
      }
      if ((i / batchSize + 1) % 10 === 0) {
        console.log(`Inserted batch ${i / batchSize + 1} of ${Math.ceil(signals.length / batchSize)}`);
      }
    }

    // Generate summary statistics
    const ccsSignals = signals.filter(s => s.provider === 'CCS' && s.confidence >= 0.5);
    const ccsCount = ccsSignals.length;
    const ccsPercentage = ((ccsCount / districts.length) * 100).toFixed(1);
    
    console.log(`\nSummary for ${audienceKey}:`);
    console.log(`  Districts where CCS >= 0.5: ${ccsCount} (${ccsPercentage}%)`);

    // Count agreement distribution (excluding CCS) - within CCS-eligible districts only
    const validatingProviders = providers.filter(p => p !== 'CCS');
    const agreementDistribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

    for (const district of districts) {
      const districtSignals = signals.filter(s => s.district === district.district);
      const ccsSignal = districtSignals.find(s => s.provider === 'CCS');
      
      // Only count if CCS is in base universe (CCS-eligible)
      if (ccsSignal && ccsSignal.confidence >= 0.5) {
        const agreeingCount = validatingProviders.filter(provider => {
          const signal = districtSignals.find(s => s.provider === provider);
          return signal && signal.confidence >= 0.5;
        }).length;
        
        agreementDistribution[agreeingCount] = (agreementDistribution[agreeingCount] || 0) + 1;
      }
    }

    console.log(`  Agreement distribution (excluding CCS, within CCS-eligible districts):`);
    const totalEligible = ccsCount;
    for (let i = 0; i <= 4; i++) {
      const count = agreementDistribution[i] || 0;
      const percentage = totalEligible > 0 ? ((count / totalEligible) * 100).toFixed(1) : '0.0';
      console.log(`    ${i} providers: ${count} districts (${percentage}%)`);
    }
    
    // Verify we have a spread (all buckets 1-4 should be non-zero)
    const hasSpread = [1, 2, 3, 4].every(i => (agreementDistribution[i] || 0) > 0);
    if (hasSpread) {
      console.log(`  ✅ Good spread: All buckets 1-4 have districts`);
    } else {
      console.log(`  ⚠️  Warning: Not all buckets 1-4 have districts. Consider adjusting dropout rates.`);
    }

    console.log(`✅ Successfully generated signals for ${audienceKey}`);
  }

  console.log('\n✅ Successfully generated all audience signals');
}

// Run if called directly
if (require.main === module) {
  const audienceKeys = [
    'home_movers',
    'home_renovators',
    'new_build_buyers',
    'high_affluence_homeowners',
  ];
  
  generateAudienceSignals(audienceKeys)
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { generateAudienceSignals, calculateProviderConfidence };
