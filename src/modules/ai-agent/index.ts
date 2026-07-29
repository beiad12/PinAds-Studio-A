/**
 * ai-agent: provider-agnostic AI orchestration (prompting, tool-call schema, provider adapters).
 * Core logic depends only on the AIProvider interface from src/types/ai.ts.
 */

import { getSettings, getProviderCredentials } from '../settings';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { createMistralProvider } from './providers/mistral';
import { createUnavailableProvider } from './providers/unavailable';
import { AGENT_TOOLS } from './toolDefinitions';
import type {
  AIChatRequest,
  AIChatResponse,
  AIProvider,
  AIProviderId,
  ChatMessage,
  MarketingMode,
} from '@/types';

export const DEFAULT_MODELS: Record<AIProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  mistral: 'mistral-small-latest',
};

export interface ModelOption {
  id: string;
  label: string;
}

/** Static model choices shown in Settings — kept independent of any live API call. */
export const MODEL_OPTIONS: Record<AIProviderId, ModelOption[]> = {
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini (fast, cheap)' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (fast)' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8B (fastest, highest free quota)' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  mistral: [
    { id: 'mistral-small-latest', label: 'Mistral Small (fast, higher rate limit)' },
    { id: 'mistral-large-latest', label: 'Mistral Large' },
    { id: 'open-mistral-nemo', label: 'Mistral Nemo' },
  ],
};

/** Order providers are tried in when falling back — active provider is always tried first. */
const FALLBACK_ORDER: AIProviderId[] = ['openai', 'anthropic', 'gemini', 'mistral'];

function createProvider(providerId: AIProviderId, apiKey: string): AIProvider {
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

interface ResolvedProvider {
  providerId: AIProviderId;
  provider: AIProvider;
  model: string;
}

async function resolveProvider(providerId: AIProviderId): Promise<ResolvedProvider> {
  const credentials = await getProviderCredentials(providerId);
  if (!credentials?.apiKey) {
    throw new Error(
      `No API key configured for ${providerId}. Add one in Settings to start chatting.`
    );
  }
  return {
    providerId,
    provider: createProvider(providerId, credentials.apiKey),
    model: credentials.model || DEFAULT_MODELS[providerId],
  };
}

/** Active provider first, then every other provider with a saved key, in a fixed order. */
async function resolveProviderChain(): Promise<AIProviderId[]> {
  const settings = await getSettings();
  const configured = new Set(
    settings.credentials.filter((c) => c.apiKey).map((c) => c.providerId)
  );
  const chain = [settings.activeProviderId, ...FALLBACK_ORDER].filter(
    (id, index, arr) => configured.has(id) && arr.indexOf(id) === index
  );
  return chain.length ? chain : [settings.activeProviderId];
}

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

/**
 * Runs `send` against the active provider; on failure, if fallback is enabled and other
 * providers have keys configured, retries against each of them in turn (e.g. a Mistral
 * 429 rate-limit falls through to Gemini/OpenAI/Anthropic automatically). Throws a
 * combined error only if every configured provider fails.
 */
async function withProviderFallback<T>(
  send: (resolved: ResolvedProvider) => Promise<T>
): Promise<T> {
  const settings = await getSettings();
  const chain = settings.providerFallbackEnabled
    ? await resolveProviderChain()
    : [settings.activeProviderId];

  const failures: string[] = [];
  for (const providerId of chain) {
    try {
      const resolved = await resolveProvider(providerId);
      return await send(resolved);
    } catch (error) {
      failures.push(`${providerId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`All configured AI providers failed:\n${failures.join('\n')}`);
}

export type InterpretResult = AIChatResponse;

/**
 * Sends the conversation history to the active provider with the full tool
 * schema and returns its reply + any proposed tool calls. Execution of tool
 * calls happens in conversation-engine, never here.
 */
export async function interpret(history: ChatMessage[]): Promise<InterpretResult> {
  const settings = await getSettings();
  const systemPrompt = buildSystemPrompt(settings.marketingMode);

  return withProviderFallback(({ provider, providerId, model }) =>
    provider.chat({
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      tools: AGENT_TOOLS,
      config: { providerId, model, temperature: 0.7, maxOutputTokens: 1200 },
    })
  );
}

/** Lightweight single-shot text generation, used by creative-studio (no tools). */
export async function generateText(prompt: string): Promise<string> {
  const response = await withProviderFallback(({ provider, providerId, model }) =>
    provider.chat({
      messages: [
        { role: 'system', content: 'You are an expert Pinterest ads copywriter.' },
        { role: 'user', content: prompt },
      ],
      config: { providerId, model, temperature: 0.8, maxOutputTokens: 500 },
    })
  );
  return response.message.content;
}

/**
 * Tests one specific provider directly (no fallback) with a minimal request, for the
 * Settings "Test connection" button. Never throws — always resolves with the outcome.
 */
export async function testProviderConnection(
  providerId: AIProviderId
): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  try {
    const resolved = await resolveProvider(providerId);
    const request: AIChatRequest = {
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      config: { providerId, model: resolved.model, temperature: 0, maxOutputTokens: 10 },
    };
    await resolved.provider.chat(request);
    return { ok: true, model: resolved.model };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
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
  playbook: string,
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
      .slice(-10)
      .map(
        (h, i) =>
          `${i}. ${h.action}${h.index !== undefined ? ` #${h.index}` : ''}${h.value ? ` "${h.value}"` : ''} — ${h.reason}`
      )
      .join('\n') || '(none yet)';

  const prompt = `You control a real, live web browser tab open on Pinterest's Ads Manager to
create and launch an ad campaign matching this goal (JSON): ${goalJson}

Follow this known playbook, step by step, in order — it was captured from a real recording of
this exact flow, so trust its field names and ordering over guessing. Only deviate if the page
in front of you genuinely doesn't match a step (different UI variant, unexpected dialog, etc.):

${playbook}

Current page URL: ${currentUrl}

Visible interactive elements right now (index: tag "accessible name" = "current value"):
${elementLines || '(none detected — the page may still be loading)'}

Actions already taken (most recent last):
${historyLines}

Pick exactly ONE next action to move toward fully creating and launching this campaign.
Reply with ONLY compact JSON, no prose, no markdown fences, no explanation outside the JSON:
{"action":"click|type|select|wait|done|fail","index":<element index, omit for wait/done/fail>,"value":"<text for type/select, omit otherwise>","reason":"<one short sentence>"}

Rules:
- "click" presses a button/link/tab/checkbox/radio/chip-remove(x) by index.
- "type" fills a text input/textarea by index with "value" (this replaces the field's content).
- "select" is for a native <select> dropdown by index using the option's visible text as "value". Most of Pinterest's dropdowns are custom (a button/div you click to open, then a list of new options appears in the next snapshot) — for those, use two separate "click" actions instead: one to open it, one on the option once it appears.
- "wait" if the page looks like it's still loading, transitioning, or a spinner/skeleton is visible.
- "done" only once there is clear on-page confirmation the campaign was created and submitted (e.g. a toast/message saying it was submitted for approval, or it appears in the campaigns table).
- "fail" if you're blocked (login required, no ad account, permission error, no matching Pin found) or have retried the same element 3+ times with no progress — explain clearly in "reason" so a human can take over from here.
- Never invent an index that isn't listed above.
- Ignore promotional tooltips/callouts unrelated to the current step (e.g. "Use creative from more places", "Switch default campaign creation setting") unless a step explicitly tells you to interact with one.`;

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
