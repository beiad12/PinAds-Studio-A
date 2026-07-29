import type { AIChatRequest, AIChatResponse, AIProvider, AgentToolCall } from '@/types';
import { generateId } from '@/lib/id';

function toAnthropicTools(tools: AIChatRequest['tools']) {
  return tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parametersSchema,
  }));
}

export function createAnthropicProvider(apiKey: string): AIProvider {
  return {
    id: 'anthropic',
    async chat(request: AIChatRequest): Promise<AIChatResponse> {
      const systemMessage = request.messages.find((m) => m.role === 'system');
      const conversationMessages = request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: request.config.model || 'claude-3-5-sonnet-20241022',
          max_tokens: request.config.maxOutputTokens ?? 1000,
          temperature: request.config.temperature ?? 0.7,
          system: systemMessage?.content,
          messages: conversationMessages,
          tools: toAnthropicTools(request.tools),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Anthropic request failed (${response.status}): ${body}`);
      }

      const data = await response.json();
      const textBlocks = (data.content ?? []).filter(
        (b: { type: string }) => b.type === 'text'
      );
      const toolBlocks = (data.content ?? []).filter(
        (b: { type: string }) => b.type === 'tool_use'
      );

      const toolCalls: AgentToolCall[] | undefined = toolBlocks.length
        ? toolBlocks.map((b: { name: string; input: Record<string, unknown> }) => ({
            id: generateId(),
            name: b.name,
            arguments: b.input,
            status: 'proposed' as const,
          }))
        : undefined;

      return {
        message: {
          role: 'assistant',
          content: textBlocks.map((b: { text: string }) => b.text).join('\n'),
        },
        toolCalls,
        usage: data.usage
          ? {
              promptTokens: data.usage.input_tokens,
              completionTokens: data.usage.output_tokens,
            }
          : undefined,
      };
    },
  };
}
