/**
 * Conversation + agent-turn models. Owned by `conversation-engine`.
 */

import type { AgentToolCall } from './ai';

export type MessageRole = 'user' | 'agent' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  /** Structured actions the agent performed/proposed as part of this message. */
  toolCalls?: AgentToolCall[];
  createdAt: string; // ISO timestamp
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  /** Optional quick-reply choices rendered as chips in the UI. */
  suggestedAnswers?: string[];
  /** The field this question is trying to fill, e.g. "budget.amount". */
  targetField: string;
}

/**
 * A proposed set of campaign changes awaiting explicit user confirmation.
 * Never auto-applied — `PlanReviewCard` in the UI is the only path to
 * calling `campaign-manager.applyDraftPlan()`.
 */
export interface DraftPlan {
  id: string;
  summary: string;
  toolCalls: AgentToolCall[];
  createdAt: string; // ISO timestamp
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  pendingClarifications: ClarificationQuestion[];
  draftPlan?: DraftPlan;
  /** Campaign ids this conversation has created or modified. */
  relatedCampaignIds: string[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
