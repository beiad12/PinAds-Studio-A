/**
 * website-analyzer: fetches and summarizes a landing page into structured strategy signals.
 * Requires the target origin to be granted via chrome.permissions (requested on demand,
 * since we can't list every possible landing page in the manifest's host_permissions).
 */

import { generateText } from '../ai-agent';
import { generateId, nowISO } from '@/lib/id';
import { websiteAnalysesRepo } from '../storage';
import type { WebsiteAnalysis, WebsiteSignal } from '@/types';

async function ensureHostPermission(url: string): Promise<void> {
  const origin = new URL(url).origin + '/*';
  const has = await chrome.permissions.contains({ origins: [origin] });
  if (has) return;
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    throw new Error(
      `Permission to read ${origin} was denied. I need it to analyze this website.`
    );
  }
}

function extractSignals(doc: Document): { signals: WebsiteSignal[]; headings: string[] } {
  const headings = Array.from(doc.querySelectorAll('h1, h2'))
    .map((el) => el.textContent?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, 10);

  const signals: WebsiteSignal[] = headings.map((label) => ({
    kind: 'topic',
    label,
    confidence: 0.6,
  }));

  const ctaWords = ['shop', 'buy', 'sign up', 'download', 'get started', 'subscribe', 'learn more'];
  const bodyText = doc.body?.textContent?.toLowerCase() ?? '';
  for (const word of ctaWords) {
    if (bodyText.includes(word)) {
      signals.push({ kind: 'call_to_action', label: word, confidence: 0.5 });
    }
  }

  return { signals, headings };
}

export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  await ensureHostPermission(url);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url} (${response.status})`);
  const html = await response.text();

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim();
  const metaDescription = doc
    .querySelector('meta[name="description"]')
    ?.getAttribute('content')
    ?.trim();
  const { signals, headings } = extractSignals(doc);

  let summary = [title, metaDescription, ...headings.slice(0, 5)].filter(Boolean).join(' — ');
  try {
    summary = await generateText(
      `In 2-3 short bullet points, summarize what this website sells/offers based on this ` +
        `page title, meta description, and headings, for the purpose of planning a Pinterest ad ` +
        `campaign. Title: "${title}". Meta: "${metaDescription}". Headings: ${headings.join('; ')}.`
    );
  } catch {
    // AI summarization is best-effort; fall back to the raw extracted text above.
  }

  const analysis: WebsiteAnalysis = {
    id: generateId(),
    url,
    title,
    metaDescription,
    signals,
    summary,
    analyzedAt: nowISO(),
  };

  await websiteAnalysesRepo.put(analysis);
  return analysis;
}
