/**
 * ai-agent: provider-agnostic AI orchestration (prompting, tool-call schema, provider adapters).
 * Core logic depends only on the AIProvider interface from src/types/ai.ts.
 */

import { getSettings, getProviderApiKey } from '../settings';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createUnavailableProvider } from './providers/unavailable';
import { AGENT_TOOLS } from './toolDefinitions';
import type { AIChatResponse, AIProvider, AIProviderId, ChatMessage, MarketingMode } from '@/types';

async function resolveProvider(providerId: AIProviderId): Promise<AIProvider> {
  const apiKey = await getProviderApiKey(providerId);
  if (!apiKey) {
    throw new Error(
      `No API key configured for ${providerId}. Add one in Settings to start chatting.`
    );
  }
  switch (providerId) {
    case 'openai':
      return createOpenAIProvider(apiKey);
    case 'anthropic':
      return createAnthropicProvider(apiKey);
    default:
      return createUnavailableProvider(providerId);
  }
}

function buildSystemPrompt(mode: MarketingMode): string {
  const base = `You are the AI agent inside PinAds Studio AI, a Chrome extension that helps
marketers plan, create, and optimize Pinterest advertising campaigns entirely through
conversation. You are an experienced Pinterest Ads specialist, not a form.

Rules:
- Never invent a budget, country, or audience the user hasn't given you or approved from your own recommendation. Ask for missing required fields (country, daily budget, audience) before calling create_campaigns, unless the user has already supplied them in this conversation.
- Prefer calling tools to perform actions (create_campaigns, update_budget, update_audience, generate_headlines, etc.) over describing what you would do.
- After proposing campaigns, summarize what was created/changed in plain language.
- Never claim a campaign was published to Pinterest — this extension only prepares campaigns for review; publishing is a separate, explicit step not available yet.`;

  const modeInstructions: Record<MarketingMode, string> = {
    beginner:
      'Mode: Beginner. Explain your reasoning for each recommendation in a sentence or two, and confirm one field at a time before moving to the next.',
    professional:
      'Mode: Professional. Be concise, assume marketing vocabulary, and batch clarifying questions together instead of one at a time.',
    autopilot:
      'Mode: Autopilot. Ask only the minimum clarifying questions needed, then draft a complete multi-campaign strategy and present it as one consolidated plan for approval. Do not call create_campaigns until the user confirms the plan.',
  };

  return `${base}\n\n${modeInstructions[mode]}`;
}

export type InterpretResult = AIChatResponse;

/**
 * Sends the conversation history to the active provider with the full tool
 * schema and returns its reply + any proposed tool calls. Execution of tool
 * calls happens in conversation-engine, never here.
 */
export async function interpret(history: ChatMessage[]): Promise<InterpretResult> {
  const settings = await getSettings();
  const provider = await resolveProvider(settings.activeProviderId);
  const systemPrompt = buildSystemPrompt(settings.marketingMode);

  return provider.chat({
    messages: [{ role: 'system', content: systemPrompt }, ...history],
    tools: AGENT_TOOLS,
    config: {
      providerId: settings.activeProviderId,
      model: settings.activeProviderId === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxOutputTokens: 1200,
    },
  });
}

/** Lightweight single-shot text generation, used by creative-studio (no tools). */
export async function generateText(prompt: string): Promise<string> {
  const settings = await getSettings();
  const provider = await resolveProvider(settings.activeProviderId);
  const response = await provider.chat({
    messages: [
      { role: 'system', content: 'You are an expert Pinterest ads copywriter.' },
      { role: 'user', content: prompt },
    ],
    config: {
      providerId: settings.activeProviderId,
      model: settings.activeProviderId === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022',
      temperature: 0.8,
      maxOutputTokens: 500,
    },
  });
  return response.message.content;
}
