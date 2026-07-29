/**
 * storage: IndexedDB repository layer; only module permitted to touch the DB directly.
 */

import { Repository } from './repository';
import {
  STORE_CAMPAIGNS,
  STORE_CONVERSATIONS,
  STORE_SETTINGS,
  STORE_WEBSITE_ANALYSES,
} from './db';
import type { Campaign, Conversation, Settings, WebsiteAnalysis } from '@/types';

export const campaignsRepo = new Repository<Campaign>(STORE_CAMPAIGNS);
export const conversationsRepo = new Repository<Conversation>(STORE_CONVERSATIONS);
export const settingsRepo = new Repository<Settings & { id: 'singleton' }>(
  STORE_SETTINGS
);
export const websiteAnalysesRepo = new Repository<WebsiteAnalysis>(
  STORE_WEBSITE_ANALYSES
);

export { Repository };
