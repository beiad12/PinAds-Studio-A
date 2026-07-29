/**
 * User settings models. Owned by the `settings` module, persisted via `storage`.
 */

import type { AIProviderId } from './ai';

export type MarketingMode = 'beginner' | 'professional' | 'autopilot';

export interface ProviderCredentials {
  providerId: AIProviderId;
  /** Stored via chrome.storage, never synced in plaintext to disk beyond that. */
  apiKey: string;
}

export interface Settings {
  activeProviderId: AIProviderId;
  credentials: ProviderCredentials[];
  marketingMode: MarketingMode;
  /** Default currency for new campaigns until overridden per-campaign. */
  defaultCurrency: string;
  updatedAt: string; // ISO timestamp
}
