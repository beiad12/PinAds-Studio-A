/**
 * creative-studio: generates/regenerates headlines, descriptions, CTAs, and seasonal creative variants.
 * Calls ai-agent for generation; never calls providers directly.
 */

import { generateText } from '../ai-agent';
import { generateId, nowISO } from '@/lib/id';
import type { CallToAction, CreativeTone, Description, Headline } from '@/types';

function parseLines(raw: string, count: number): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^[\d.\-\)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, count);
}

export async function generateHeadlines(
  topic: string,
  tone: CreativeTone = 'neutral',
  count = 5
): Promise<Headline[]> {
  const prompt = `Write ${count} Pinterest ad headlines (max 100 characters each) for: "${topic}".
Tone: ${tone}. Return one headline per line, no numbering, no quotes.`;
  const raw = await generateText(prompt);
  const lines = parseLines(raw, count);

  return lines.map((text, i) => ({
    id: generateId(),
    text,
    tone,
    isSelected: i === 0,
    createdAt: nowISO(),
  }));
}

export async function generateDescriptions(
  topic: string,
  tone: CreativeTone = 'neutral',
  count = 3
): Promise<Description[]> {
  const prompt = `Write ${count} Pinterest ad descriptions (max 500 characters each) for: "${topic}".
Tone: ${tone}. Return one description per line, no numbering, no quotes.`;
  const raw = await generateText(prompt);
  const lines = parseLines(raw, count);

  return lines.map((text, i) => ({
    id: generateId(),
    text,
    tone,
    isSelected: i === 0,
    createdAt: nowISO(),
  }));
}

export function createDefaultCTA(type: CallToAction['type'] = 'shop_now'): CallToAction {
  const labels: Record<CallToAction['type'], string> = {
    shop_now: 'Shop Now',
    learn_more: 'Learn More',
    sign_up: 'Sign Up',
    download: 'Download',
    get_offer: 'Get Offer',
    custom: 'Custom',
  };
  return { id: generateId(), type, label: labels[type], isSelected: true };
}
