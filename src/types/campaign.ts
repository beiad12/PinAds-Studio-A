/**
 * Campaign schema — the central aggregate of the product.
 * Owned by the `campaign-manager` module; all mutations go through it.
 */

import type { Audience } from './audience';
import type { Creative } from './creative';

export type CampaignObjective =
  | 'awareness'
  | 'traffic'
  | 'conversions'
  | 'catalog_sales'
  | 'video_views';

export type CampaignStatus =
  | 'draft' // being planned in conversation, not yet reviewed
  | 'ready' // reviewed by user, not yet published
  | 'active' // published/running on Pinterest
  | 'paused'
  | 'archived';

export type CurrencyCode = string; // ISO 4217, e.g. "USD"

export interface Budget {
  amount: number;
  currency: CurrencyCode;
  type: 'daily' | 'lifetime';
}

export interface AIScore {
  /** 0-100 composite score. */
  value: number;
  /** Sub-scores that compose `value`, for display + explanation. */
  breakdown: {
    audienceFit: number;
    creativeStrength: number;
    budgetHealth: number;
  };
  suggestions: string[]; // human-readable improvement suggestions
  computedAt: string; // ISO timestamp
}

export interface AdGroup {
  id: string;
  name: string;
  audience: Audience;
  creative: Creative;
}

export interface Campaign {
  id: string;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  budget: Budget;
  websiteUrl?: string;
  adGroups: AdGroup[];
  aiScore?: AIScore;
  /** Ids of conversation messages that led to this campaign's current state,
   *  rendered in the workspace History tab. */
  conversationId: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  /** Set when this campaign was created via "duplicate" from another. */
  duplicatedFromCampaignId?: string;
}
