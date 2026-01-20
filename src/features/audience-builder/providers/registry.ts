import { ProviderAdapter } from './types';
import { CCSProvider } from './mock/ccs';
import { ONSProvider } from './mock/ons';
import { ExperianProvider } from './mock/experian';
import { MobilityProvider } from './mock/mobility';

export type ProviderName = 'CCS' | 'ONS' | 'Experian' | 'Mobility';

const providers: Record<ProviderName, ProviderAdapter> = {
  CCS: new CCSProvider(),
  ONS: new ONSProvider(),
  Experian: new ExperianProvider(),
  Mobility: new MobilityProvider(),
};

export function getProvider(name: ProviderName): ProviderAdapter {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Provider ${name} not found`);
  }
  return provider;
}

export function getAllProviders(): ProviderAdapter[] {
  return Object.values(providers);
}

export function getProviderNames(): ProviderName[] {
  return Object.keys(providers) as ProviderName[];
}
