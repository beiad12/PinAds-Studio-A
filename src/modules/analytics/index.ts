/**
 * analytics: computes AI Score and performance suggestions from campaign + creative data.
 * Pure functions only — no external calls.
 */

import { nowISO } from '@/lib/id';
import type { AIScore, Campaign } from '@/types';

function scoreAudienceFit(campaign: Campaign): number {
  if (campaign.adGroups.length === 0) return 0;
  let total = 0;
  for (const group of campaign.adGroups) {
    let score = 40;
    const { ageRange, locations, interests, keywords } = group.audience;
    const ageSpan = ageRange.max - ageRange.min;
    if (ageSpan > 0 && ageSpan <= 40) score += 20;
    if (locations.length > 0) score += 20;
    if (interests.length + keywords.length >= 3) score += 20;
    total += Math.min(100, score);
  }
  return Math.round(total / campaign.adGroups.length);
}

function scoreCreativeStrength(campaign: Campaign): number {
  if (campaign.adGroups.length === 0) return 0;
  let total = 0;
  for (const group of campaign.adGroups) {
    let score = 20;
    if (group.creative.headlines.length >= 3) score += 30;
    else if (group.creative.headlines.length > 0) score += 15;
    if (group.creative.descriptions.length >= 2) score += 25;
    else if (group.creative.descriptions.length > 0) score += 10;
    if (group.creative.ctas.some((c) => c.isSelected)) score += 25;
    total += Math.min(100, score);
  }
  return Math.round(total / campaign.adGroups.length);
}

function scoreBudgetHealth(campaign: Campaign): number {
  const { amount, type } = campaign.budget;
  if (amount <= 0) return 0;
  const dailyEquivalent = type === 'daily' ? amount : amount / 30;
  if (dailyEquivalent < 5) return 40;
  if (dailyEquivalent < 15) return 75;
  if (dailyEquivalent <= 100) return 100;
  return 70; // very high budgets flagged as worth double-checking, not penalized hard
}

function buildSuggestions(
  audienceFit: number,
  creativeStrength: number,
  budgetHealth: number,
  campaign: Campaign
): string[] {
  const suggestions: string[] = [];
  if (audienceFit < 70) {
    suggestions.push('Narrow or enrich the audience with more interests or keywords for better targeting precision.');
  }
  if (creativeStrength < 70) {
    suggestions.push('Generate more headline and description variants so Pinterest can optimize delivery.');
  }
  if (budgetHealth < 70) {
    suggestions.push("Consider raising the daily budget — very low budgets limit Pinterest's ability to optimize delivery.");
  }
  if (campaign.adGroups.some((g) => !g.creative.ctas.some((c) => c.isSelected))) {
    suggestions.push('Select a call-to-action for each ad group.');
  }
  if (suggestions.length === 0) {
    suggestions.push('This campaign looks solid — consider an A/B test with an alternate tone to keep improving performance.');
  }
  return suggestions;
}

export function computeAIScore(campaign: Campaign): AIScore {
  const audienceFit = scoreAudienceFit(campaign);
  const creativeStrength = scoreCreativeStrength(campaign);
  const budgetHealth = scoreBudgetHealth(campaign);
  const value = Math.round((audienceFit + creativeStrength + budgetHealth) / 3);

  return {
    value,
    breakdown: { audienceFit, creativeStrength, budgetHealth },
    suggestions: buildSuggestions(audienceFit, creativeStrength, budgetHealth, campaign),
    computedAt: nowISO(),
  };
}
