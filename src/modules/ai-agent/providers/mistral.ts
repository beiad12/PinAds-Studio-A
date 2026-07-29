import type { AIChatRequest, AIChatResponse, AIProvider, AgentToolCall } from '@/types';
import { generateId } from '@/lib/id';

function toMistralTools(tools: AIChatRequest['tools']) {
  return tools?.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parametersSchema,
    },
  }));
}

export function createMistralProvider(apiKey: string): AIProvider {
  return {
    id: 'mistral',
    async chat(request: AIChatRequest): Promise<AIChatResponse> {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: request.config.model || 'mistral-large-latest',
          temperature: request.config.temperature ?? 0.7,
          max_tokens: request.config.maxOutputTokens ?? 1000,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
          tools: toMistralTools(request.tools),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Mistral request failed (${response.status}): ${body}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      const toolCalls: AgentToolCall[] | undefined = message?.tool_calls?.map(
        (tc: { function: { name: string; arguments: string } }) => ({
          id: generateId(),
          name: tc.function.name,
          arguments: safeParseJSON(tc.function.arguments),
          status: 'proposed' as const,
        })
      );

      return {
        message: { role: 'assistant', content: message?.content ?? '' },
        toolCalls,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
            }
          : undefined,
      };
    },
  };
}

function safeParseJSON(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
