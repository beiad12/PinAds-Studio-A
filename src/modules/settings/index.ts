/**
 * settings: AI provider selection/keys, marketing mode, and general preferences.
 */

import { settingsRepo } from '../storage';
import { nowISO } from '@/lib/id';
import type { Settings } from '@/types';

const SETTINGS_ID = 'singleton' as const;

const DEFAULT_SETTINGS: Settings = {
  activeProviderId: 'openai',
  credentials: [],
  marketingMode: 'professional',
  defaultCurrency: 'USD',
  updatedAt: nowISO(),
};

export async function getSettings(): Promise<Settings> {
  const stored = await settingsRepo.get(SETTINGS_ID);
  return stored ?? DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, updatedAt: nowISO() };
  await settingsRepo.put({ ...next, id: SETTINGS_ID });
  return next;
}

export async function getProviderApiKey(
  providerId: Settings['activeProviderId']
): Promise<string | undefined> {
  const settings = await getSettings();
  return settings.credentials.find((c) => c.providerId === providerId)?.apiKey;
}

export async function saveProviderApiKey(
  providerId: Settings['activeProviderId'],
  apiKey: string
): Promise<Settings> {
  const current = await getSettings();
  const credentials = current.credentials.filter((c) => c.providerId !== providerId);
  credentials.push({ providerId, apiKey });
  return saveSettings({ credentials });
}
