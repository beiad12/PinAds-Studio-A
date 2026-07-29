/**
 * AI provider abstraction + agent tool-calling contract.
 * `ai-agent` depends only on these types, never on a concrete provider SDK.
 */

export type AIProviderId = 'openai' | 'anthropic' | 'gemini' | 'mistral';

export interface ProviderModelConfig {
  providerId: AIProviderId;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present on role: 'tool' messages — the tool call this responds to. */
  toolCallId?: string;
}

export interface AIChatRequest {
  messages: ChatMessage[];
  tools?: AgentToolDefinition[];
  config: ProviderModelConfig;
}

export interface AIChatResponse {
  message: ChatMessage;
  toolCalls?: AgentToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIChatStreamChunk {
  delta: string;
  done: boolean;
}

/**
 * Every provider adapter (`modules/ai-agent/providers/*`) implements this
 * interface. Adding a new provider means adding one adapter — no changes
 * to `ai-agent` core logic.
 */
export interface AIProvider {
  id: AIProviderId;
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  streamChat?(request: AIChatRequest): AsyncIterable<AIChatStreamChunk>;
}

/**
 * Tool names the agent can invoke. Each maps to a `campaign-manager`,
 * `audience-builder`, `creative-studio`, or `website-analyzer` operation.
 * Keeping mutation logic in those modules (not in prompt strings) is a
 * hard architectural rule — the AI proposes, the modules execute.
 */
export type AgentToolName =
  | 'analyze_website'
  | 'create_campaigns'
  | 'update_campaign'
  | 'duplicate_campaign'
  | 'update_audience'
  | 'update_budget'
  | 'generate_headlines'
  | 'generate_descriptions'
  | 'regenerate_creative'
  | 'pause_campaign'
  | 'resume_campaign'
  | 'compute_ai_score';

export interface AgentToolDefinition {
  name: AgentToolName;
  description: string;
  /** JSON Schema for the tool's arguments, passed to the provider's
   *  function-calling API. */
  parametersSchema: Record<string, unknown>;
}

export interface AgentToolCall {
  id: string;
  name: AgentToolName;
  arguments: Record<string, unknown>;
  /** Populated by conversation-engine after the module handles the call. */
  result?: Record<string, unknown>;
  status: 'proposed' | 'applied' | 'rejected' | 'failed';
}
