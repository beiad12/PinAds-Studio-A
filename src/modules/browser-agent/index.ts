/**
 * browser-agent: drives a real Pinterest Ads Manager tab like a human would —
 * read what's on screen, decide the next click/type, act, repeat. No fixed
 * selectors, no simulated/fake success: every action is a genuine DOM
 * interaction in a real tab, and "done" is only reported once the AI can see
 * on-page confirmation.
 */

import { ensurePinterestAdsTab, snapshotTab, actOnTab } from './tabController';
import { decideNextBrowserAction, type BrowserActionDecision } from '../ai-agent';
import type { Campaign } from '@/types';

export type { BrowserActionDecision };

export interface BrowserAgentResult {
  success: boolean;
  message: string;
  steps: BrowserActionDecision[];
}

const MAX_STEPS = 40;
const SETTLE_DELAY_MS = 700;

function buildGoalDescription(campaign: Campaign): string {
  const group = campaign.adGroups[0];
  const pin = group?.creative.pins.find((p) => p.imageUrl);
  return JSON.stringify({
    campaignName: campaign.name,
    objective: campaign.objective,
    dailyBudgetUSD: campaign.budget.type === 'daily' ? campaign.budget.amount : undefined,
    lifetimeBudgetUSD: campaign.budget.type === 'lifetime' ? campaign.budget.amount : undefined,
    audience: group
      ? {
          gender: group.audience.gender,
          ageMin: group.audience.ageRange.min,
          ageMax: group.audience.ageRange.max,
          countries: group.audience.locations.map((l) => l.countryName),
        }
      : undefined,
    headline: group?.creative.headlines.find((h) => h.isSelected)?.text ?? campaign.name,
    description: group?.creative.descriptions.find((d) => d.isSelected)?.text,
    pinImageUrl: pin?.imageUrl,
    pinTitle: pin?.title ?? campaign.name,
    pinDestinationUrl: pin?.destinationUrl || campaign.websiteUrl,
  });
}

/**
 * Opens (or reuses) a Pinterest Ads Manager tab and drives it step by step
 * toward creating and launching the given campaign. `onStep` fires after
 * every decision so the UI can render a live transcript.
 */
export async function launchCampaignInAdsManager(
  campaign: Campaign,
  onStep?: (step: BrowserActionDecision) => void
): Promise<BrowserAgentResult> {
  if (!campaign.adGroups[0]?.creative.pins.some((p) => p.imageUrl)) {
    return {
      success: false,
      message: 'Add a Pin image URL in the Pins tab before launching — Pinterest ads need a Pin.',
      steps: [],
    };
  }

  const tabId = await ensurePinterestAdsTab();
  const goal = buildGoalDescription(campaign);
  const steps: BrowserActionDecision[] = [];

  for (let i = 0; i < MAX_STEPS; i++) {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_DELAY_MS));

    const snapshot = await snapshotTab(tabId).catch((error) => {
      throw new Error(
        `Lost connection to the Pinterest tab (it may have been closed or navigated away): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });

    const decision = await decideNextBrowserAction(goal, snapshot.elements, snapshot.url, steps);
    steps.push(decision);
    onStep?.(decision);

    if (decision.action === 'done') {
      return { success: true, message: decision.reason, steps };
    }
    if (decision.action === 'fail') {
      return { success: false, message: decision.reason, steps };
    }
    if (decision.action === 'wait') continue;
    if (decision.index === undefined) {
      const errorStep: BrowserActionDecision = {
        action: 'wait',
        reason: `Model chose "${decision.action}" without an element index — skipping.`,
      };
      steps.push(errorStep);
      onStep?.(errorStep);
      continue;
    }

    const result = await actOnTab(tabId, decision.action, decision.index, decision.value);
    if (!result.ok) {
      const errorStep: BrowserActionDecision = {
        action: 'wait',
        reason: `Action failed: ${result.error}`,
      };
      steps.push(errorStep);
      onStep?.(errorStep);
    }
  }

  return {
    success: false,
    message: `Stopped after ${MAX_STEPS} steps without seeing confirmation — check the Pinterest tab directly.`,
    steps,
  };
}
