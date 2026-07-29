/**
 * CampaignWorkspace — the aggregate read-model the UI consumes for the
 * per-campaign workspace view (Summary / Audience / Budget / Creative /
 * Pins / Status / AI Score / Conversation history / Generated assets).
 * Assembled by `campaign-manager` from `Campaign` + related `Conversation`;
 * not persisted separately — it's a projection.
 */

import type { Campaign } from './campaign';
import type { Message } from './conversation';

export interface CampaignWorkspace {
  campaign: Campaign;
  /** Messages from the related conversation(s), filtered to those that
   *  reference this campaign's id — powers the workspace History tab. */
  history: Message[];
}
