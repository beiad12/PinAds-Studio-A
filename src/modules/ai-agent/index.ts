/**
 * ai-agent: provider-agnostic AI orchestration (prompting, tool-call schema, provider adapters).
 * Core logic depends only on the AIProvider interface from src/types/ai.ts.
 */

import { getSettings, getProviderApiKey } from '../settings';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { createMistralProvider } from './providers/mistral';
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
    case 'gemini':
      return createGeminiProvider(apiKey);
    case 'mistral':
      return createMistralProvider(apiKey);
    default:
      return createUnavailableProvider(providerId);
  }
}

const DEFAULT_MODELS: Record<AIProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  mistral: 'mistral-large-latest',
};

function buildSystemPrompt(mode: MarketingMode): string {
  const base = `You are the AI agent inside PinAds Studio AI, a Chrome extension that helps
marketers plan, create, and optimize Pinterest advertising campaigns entirely through
conversation. You are an experienced Pinterest Ads specialist, not a form.

Rules:
- Never invent a budget, country, or audience the user hasn't given you or approved from your own recommendation. Ask for missing required fields (country, daily budget, audience) before calling create_campaigns, unless the user has already supplied them in this conversation.
- Prefer calling tools to perform actions (create_campaigns, update_budget, update_audience, generate_headlines, etc.) over describing what you would do.
- After proposing campaigns, summarize what was created/changed in plain language.
- Never claim a campaign was published/live on Pinterest yourself — publishing only happens when the user explicitly clicks Publish in the campaign workspace, never from chat.`;

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
      model: DEFAULT_MODELS[settings.activeProviderId],
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
      model: DEFAULT_MODELS[settings.activeProviderId],
      temperature: 0.8,
      maxOutputTokens: 500,
    },
  });
  return response.message.content;
}

export interface BrowserSnapshotElement {
  index: number;
  tag: string;
  type?: string;
  name: string;
  value?: string;
  disabled: boolean;
}

export interface BrowserActionDecision {
  action: 'click' | 'type' | 'select' | 'wait' | 'done' | 'fail';
  index?: number;
  value?: string;
  reason: string;
}

/**
 * Reads a snapshot of the currently visible, interactive elements on a
 * Pinterest Ads Manager page (no fixed selectors — same "read the page and
 * find the button" approach the original extension used) and decides the
 * single next action to take toward creating/launching the given campaign.
 */
export async function decideNextBrowserAction(
  goalJson: string,
  elements: BrowserSnapshotElement[],
  currentUrl: string,
  history: BrowserActionDecision[]
): Promise<BrowserActionDecision> {
  const elementLines = elements
    .map(
      (e) =>
        `${e.index}: ${e.tag}${e.type ? `[${e.type}]` : ''} "${e.name}"${e.value ? ` = "${e.value}"` : ''}${e.disabled ? ' (disabled)' : ''}`
    )
    .join('\n');
  const historyLines =
    history
      .slice(-8)
      .map(
        (h, i) =>
          `${i}. ${h.action}${h.index !== undefined ? ` #${h.index}` : ''}${h.value ? ` "${h.value}"` : ''} — ${h.reason}`
      )
      .join('\n') || '(none yet)';

  const prompt = `You control a real, live web browser tab open on Pinterest's Ads Manager to
create and launch an ad campaign matching this goal (JSON): ${goalJson}

Current page URL: ${currentUrl}

Visible interactive elements right now (index: tag "accessible name" = "current value"):
${elementLines || '(none detected — the page may still be loading)'}

Actions already taken (most recent last):
${historyLines}

Pick exactly ONE next action to move toward fully creating and launching this campaign.
Reply with ONLY compact JSON, no prose, no markdown fences, no explanation outside the JSON:
{"action":"click|type|select|wait|done|fail","index":<element index, omit for wait/done/fail>,"value":"<text for type/select, omit otherwise>","reason":"<one short sentence>"}

Rules:
- "click" presses a button/link/tab by index.
- "type" fills a text input/textarea by index with "value".
- "select" picks a dropdown option by index using the option's visible text as "value".
- "wait" if the page looks like it's still loading or transitioning.
- "done" only once there is clear on-page confirmation the campaign was created and is live (e.g. a success message, or it appears in a campaigns list with an active status).
- "fail" if you're blocked (login required, no ad account, permission error) or have retried the same element 3+ times with no progress — explain clearly in "reason" so a human can take over from here.
- Never invent an index that isn't listed above.`;

  const raw = await generateText(prompt);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    if (!parsed.action) throw new Error('missing action');
    return { reason: 'No reason given.', ...parsed };
  } catch {
    return {
      action: 'fail',
      reason: `Could not understand the model's response: ${raw.slice(0, 200)}`,
    };
  }
}
