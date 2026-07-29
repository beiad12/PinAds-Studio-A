import type { AIProvider, AIProviderId } from '@/types';

/**
 * Placeholder adapter for providers not yet wired up (Gemini, Mistral).
 * Swapping this for a real adapter is a single-file change — see
 * `providers/openai.ts` / `providers/anthropic.ts` for the pattern.
 */
export function createUnavailableProvider(id: AIProviderId): AIProvider {
  return {
    id,
    async chat() {
      throw new Error(
        `The ${id} provider is not yet implemented. Choose OpenAI or Anthropic in Settings.`
      );
    },
  };
}
