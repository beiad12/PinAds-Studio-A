/**
 * User settings models. Owned by the `settings` module, persisted via `storage`.
 */

import type { AIProviderId } from './ai';
import type { PinterestAppCredentials, PinterestConnection } from './pinterest';

export type MarketingMode = 'beginner' | 'professional' | 'autopilot';

export interface ProviderCredentials {
  providerId: AIProviderId;
  /** Stored via chrome.storage, never synced in plaintext to disk beyond that. */
  apiKey: string;
  /** Model id to use for this provider; falls back to a per-provider default when unset. */
  model?: string;
}

export interface Settings {
  activeProviderId: AIProviderId;
  credentials: ProviderCredentials[];
  marketingMode: MarketingMode;
  /** Default currency for new campaigns until overridden per-campaign. */
  defaultCurrency: string;
  /** When true (default), a failed provider call automatically retries with the next
   *  configured provider instead of failing the whole request. */
  providerFallbackEnabled: boolean;
  pinterestApp?: PinterestAppCredentials;
  pinterestConnection?: PinterestConnection;
  updatedAt: string; // ISO timestamp
}
