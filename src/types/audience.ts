/**
 * Audience data models.
 * Produced by the `audience-builder` module, either from a natural-language
 * description ("women 19-64 in the US") or from `website-analyzer` recommendations.
 */

export type Gender = 'women' | 'men' | 'all';

export interface AgeRange {
  min: number; // Pinterest minimum is 18
  max: number; // 65 represents "65+"
}

export interface Location {
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "US"
  countryName: string;
  regions?: string[]; // optional state/province-level refinement
}

export type InterestSource = 'ai-recommended' | 'user-specified';

export interface Interest {
  id: string;
  label: string;
  source: InterestSource;
}

export type KeywordMatchType = 'broad' | 'phrase' | 'exact';

export interface Keyword {
  id: string;
  term: string;
  matchType: KeywordMatchType;
  source: InterestSource;
}

export type AudienceLanguage = string; // BCP-47, e.g. "en", "en-US"

export interface Audience {
  id: string;
  gender: Gender;
  ageRange: AgeRange;
  locations: Location[];
  languages: AudienceLanguage[];
  interests: Interest[];
  keywords: Keyword[];
  /** Free-text notes the AI attaches explaining its recommendation, shown in the UI. */
  aiRationale?: string;
}
