import type { AIChatRequest, AIChatResponse, AIProvider, AgentToolCall } from '@/types';
import { generateId } from '@/lib/id';

function toGeminiTools(tools: AIChatRequest['tools']) {
  if (!tools?.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parametersSchema,
      })),
    },
  ];
}

export function createGeminiProvider(apiKey: string): AIProvider {
  return {
    id: 'gemini',
    async chat(request: AIChatRequest): Promise<AIChatResponse> {
      const model = request.config.model || 'gemini-1.5-flash';
      const systemMessage = request.messages.find((m) => m.role === 'system');
      const contents = request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: systemMessage
              ? { parts: [{ text: systemMessage.content }] }
              : undefined,
            tools: toGeminiTools(request.tools),
            generationConfig: {
              temperature: request.config.temperature ?? 0.7,
              maxOutputTokens: request.config.maxOutputTokens ?? 1000,
            },
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini request failed (${response.status}): ${body}`);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const textParts = parts.filter((p: { text?: string }) => typeof p.text === 'string');
      const functionCallParts = parts.filter(
        (p: { functionCall?: unknown }) => p.functionCall
      );

      const toolCalls: AgentToolCall[] | undefined = functionCallParts.length
        ? functionCallParts.map((p: { functionCall: { name: string; args: Record<string, unknown> } }) => ({
            id: generateId(),
            name: p.functionCall.name,
            arguments: p.functionCall.args ?? {},
            status: 'proposed' as const,
          }))
        : undefined;

      return {
        message: {
          role: 'assistant',
          content: textParts.map((p: { text: string }) => p.text).join('\n'),
        },
        toolCalls,
        usage: data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount,
              completionTokens: data.usageMetadata.candidatesTokenCount,
            }
          : undefined,
      };
    },
  };
}
