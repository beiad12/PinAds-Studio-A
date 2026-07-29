/**
 * audience-builder: translates natural-language audience descriptions into structured Audience objects.
 * Uses lightweight heuristic parsing for fast, deterministic updates from chat commands
 * (e.g. "target women 19-64"); website-analyzer recommendations are merged in separately.
 */

import { generateId } from '@/lib/id';
import type { Audience, Gender } from '@/types';

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  MX: 'Mexico',
};

export function createDefaultAudience(overrides: Partial<Audience> = {}): Audience {
  return {
    id: generateId(),
    gender: 'all',
    ageRange: { min: 25, max: 54 },
    locations: [{ countryCode: 'US', countryName: 'United States' }],
    languages: ['en'],
    interests: [],
    keywords: [],
    ...overrides,
  };
}

/** Parses a free-text audience instruction into a partial Audience patch. */
export function parseAudienceInstruction(text: string): Partial<Audience> {
  const patch: Partial<Audience> = {};
  const lower = text.toLowerCase();

  if (/\bwomen\b/.test(lower)) patch.gender = 'women' as Gender;
  else if (/\bmen\b/.test(lower)) patch.gender = 'men' as Gender;

  const ageMatch = lower.match(/(\d{2})\s*[-–to]+\s*(\d{2})/);
  if (ageMatch) {
    patch.ageRange = { min: Number(ageMatch[1]), max: Number(ageMatch[2]) };
  }

  const countryEntry = Object.entries(COUNTRY_NAMES).find(([, name]) =>
    lower.includes(name.toLowerCase())
  );
  if (countryEntry) {
    patch.locations = [{ countryCode: countryEntry[0], countryName: countryEntry[1] }];
  }

  return patch;
}

export function mergeAudiencePatch(current: Audience, patch: Partial<Audience>): Audience {
  return { ...current, ...patch };
}
