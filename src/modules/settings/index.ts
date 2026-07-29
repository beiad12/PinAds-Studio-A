/**
 * settings: AI provider selection/keys, marketing mode, and general preferences.
 */

import { settingsRepo } from '../storage';
import { nowISO } from '@/lib/id';
import type { ProviderCredentials, Settings } from '@/types';

const SETTINGS_ID = 'singleton' as const;

const DEFAULT_SETTINGS: Settings = {
  activeProviderId: 'openai',
  credentials: [],
  marketingMode: 'professional',
  defaultCurrency: 'USD',
  providerFallbackEnabled: true,
  updatedAt: nowISO(),
};

export async function getSettings(): Promise<Settings> {
  const stored = await settingsRepo.get(SETTINGS_ID);
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, updatedAt: nowISO() };
  await settingsRepo.put({ ...next, id: SETTINGS_ID });
  return next;
}

export async function getProviderCredentials(
  providerId: Settings['activeProviderId']
): Promise<ProviderCredentials | undefined> {
  const settings = await getSettings();
  return settings.credentials.find((c) => c.providerId === providerId);
}

export async function getProviderApiKey(
  providerId: Settings['activeProviderId']
): Promise<string | undefined> {
  return (await getProviderCredentials(providerId))?.apiKey;
}

export async function saveProviderApiKey(
  providerId: Settings['activeProviderId'],
  apiKey: string
): Promise<Settings> {
  const current = await getSettings();
  const existing = current.credentials.find((c) => c.providerId === providerId);
  const credentials = current.credentials.filter((c) => c.providerId !== providerId);
  credentials.push({ providerId, apiKey, model: existing?.model });
  return saveSettings({ credentials });
}

export async function saveProviderModel(
  providerId: Settings['activeProviderId'],
  model: string
): Promise<Settings> {
  const current = await getSettings();
  const existing = current.credentials.find((c) => c.providerId === providerId);
  const credentials = current.credentials.filter((c) => c.providerId !== providerId);
  credentials.push({ providerId, apiKey: existing?.apiKey ?? '', model });
  return saveSettings({ credentials });
}
