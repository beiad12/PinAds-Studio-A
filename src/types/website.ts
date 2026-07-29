/**
 * Website analysis models — output of the `website-analyzer` module,
 * used to seed strategy (audience + creative) recommendations.
 */

export type WebsiteSignalKind =
  | 'topic'
  | 'offer'
  | 'tone'
  | 'product'
  | 'call_to_action';

export interface WebsiteSignal {
  kind: WebsiteSignalKind;
  label: string;
  confidence: number; // 0-1
}

export interface WebsiteAnalysis {
  id: string;
  url: string;
  title?: string;
  metaDescription?: string;
  signals: WebsiteSignal[];
  /** Short natural-language summary the AI presents to the user. */
  summary: string;
  analyzedAt: string; // ISO timestamp
}
