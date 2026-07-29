/**
 * browser-agent: drives a real Pinterest Ads Manager tab like a human would —
 * read what's on screen, decide the next click/type, act, repeat. No fixed
 * selectors, no simulated/fake success: every action is a genuine DOM
 * interaction in a real tab, and "done" is only reported once the AI can see
 * on-page confirmation.
 *
 * The playbook below was transcribed from a real screen recording of a
 * Pinterest Ads Manager campaign-creation session, so the steps and field
 * names are the actual ones Pinterest shows — the model follows this script
 * instead of guessing the flow from scratch, and only falls back to open
 * reasoning where the recording didn't cover something (e.g. the very first
 * click into "Create campaign" from the dashboard).
 */

import { ensurePinterestAdsTab, snapshotTab, actOnTab } from './tabController';
import { decideNextBrowserAction, type BrowserActionDecision } from '../ai-agent';
import type { Campaign, CampaignObjective } from '@/types';

export type { BrowserActionDecision };

export interface BrowserAgentResult {
  success: boolean;
  message: string;
  steps: BrowserActionDecision[];
}

const MAX_STEPS = 60;
const SETTLE_DELAY_MS = 700;

const OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  awareness: 'Brand awareness',
  traffic: 'Consideration',
  conversions: 'Sales',
  catalog_sales: 'Sales',
  video_views: 'Video completion',
};

function buildGoalDescription(campaign: Campaign) {
  const group = campaign.adGroups[0];
  const pin = group?.creative.pins.find((p) => p.imageUrl);
  return JSON.stringify({
    campaignName: campaign.name,
    objectiveLabel: OBJECTIVE_LABEL[campaign.objective],
    campaignStatus: campaign.status === 'paused' ? 'Paused' : 'Active',
    budgetType: campaign.budget.type === 'daily' ? 'Daily' : 'Lifetime',
    budgetAmount: campaign.budget.amount,
    maxCpcBid: campaign.maxCpcBid,
    audience: group
      ? {
          gender: group.audience.gender, // 'women' | 'men' | 'all'
          ageMin: group.audience.ageRange.min,
          ageMax: group.audience.ageRange.max,
          countries: group.audience.locations.map((l) => l.countryName),
        }
      : undefined,
    pinTitle: pin?.title ?? campaign.name,
    pinDestinationUrl: pin?.destinationUrl || campaign.websiteUrl,
  });
}

function buildPlaybook(campaign: Campaign): string {
  const group = campaign.adGroups[0];
  const pin = group?.creative.pins.find((p) => p.imageUrl);
  const countries = group?.audience.locations.map((l) => l.countryName) ?? [];
  const genderLabel =
    group?.audience.gender === 'women' ? 'Female' : group?.audience.gender === 'men' ? 'Male' : null;

  const cpcStep = campaign.maxCpcBid
    ? `12. In "Optimisation and delivery", open the "Bidding" dropdown and choose "Custom". A "Maximum CPC bid" field appears — type "${campaign.maxCpcBid}" into it. If no such option exists, leave the default "Pinterest Performance+ bidding" and move on.`
    : `12. In "Optimisation and delivery", leave "Bidding" on its default "Pinterest Performance+ bidding (recommended)" — no manual CPC needed.`;

  return `0. If you're not already on a "Create campaign" page (URL containing "/ads/create/", with a "Campaign objective" heading visible), you're on the Ads Manager dashboard — find and click a "Create" control (often a red button/dropdown near the top) and then "Create campaign" (or "Create ad") from it.
1. Under "Campaign objective", click the radio option whose label is "${OBJECTIVE_LABEL[campaign.objective]}" (it may already be selected by default — if so, skip this step).
2. Near the top-right there is often a toggle labeled something like "Pinterest Performance+ on". Click it to turn it off — this reveals more manual controls needed later. A confirmation dialog "Are you sure you want to switch from Pinterest Performance+ to manual?" will appear; click its "Switch to manual" button (not "Keep current setup"). If this toggle isn't present, skip.
3. Under "Creative source", leave the dropdown as "Pins" (it's the default).
4. Under "Campaign details": clear the "Campaign name" field and type "${campaign.name}". Under "Campaign status", click the "${campaign.status === 'paused' ? 'Paused' : 'Active'}" button.
5. Under "Campaign budget and schedule": open the "Budget type" dropdown and choose "${campaign.budget.type === 'daily' ? 'Daily' : 'Lifetime'}". Then click into the "Budget amount" field (placeholder like "Enter amount in ...") and type "${campaign.budget.amount}". Leave "Campaign schedule" as "Run continuously".
6. Click the "Continue" button (bottom right) to move to ad group setup.
7. Under "Targeting details", there is a "Country" field with a default country chip already selected (has an "x" to remove it). Click that "x" to remove the default, then type into the Country field and select from the dropdown, once for each of: ${countries.length ? countries.join(', ') : '(no specific country requested — leave the current default)'}.
8. Below "Ages" there is a link "Switch to manual setup" — click it. A confirmation dialog "Are you sure you want to switch?" appears; click "Switch to manual" (not "Keep default setup"). This unlocks full Demographics/Location/Interests controls. If this link isn't present (already in manual mode), skip.
9. In the now-visible "Demographics" section, find the "Genders" field (a chip input, default chip "All genders" with an "x"). ${genderLabel ? `Click the "x" on the "All genders" chip to remove it, then click the field and select "${genderLabel}" from the dropdown list that appears.` : 'Leave it as "All genders".'}
10. Still in Demographics, find "Ages" — click it, choose "Pick specific ages" if not already, then set "Minimum age" to the closest available option to ${group?.audience.ageRange.min ?? 18} and "Maximum age" to the closest available option to ${group?.audience.ageRange.max ?? 65} (dropdowns list values like 18, 19, 20 ... up to "65+").
11. Leave "Languages" and "Devices" at their defaults ("All languages", "All devices") unless told otherwise.
${cpcStep}
13. Scroll to the "Ads" section and click the "Select Pins" button. A "Select Pins" panel slides in from the right with a search box labeled "Search by keyword or Pin ID".
14. Click into that search box and type "${pin?.title ?? campaign.name}". Wait for results to filter, then click the checkbox on the LEFT of the row whose "Name and ID" matches most closely (it doesn't need to be an exact match — pick the closest one). If genuinely nothing relevant appears after searching, use "fail" and explain that no matching Pin exists on the account yet — the user needs a Pin with a similar title/topic saved to a board first.
15. Click the red "Add Pins" button (bottom-right of that panel) to confirm the selection and close the panel. This creates one ad per selected Pin — for a single Pin, you'll land on an "Ad details" step; its "Ad destination"/"Destination link" and "Call to action" are usually pre-filled correctly from the Pin — leave them as-is unless empty.
16. Finally, click the "Publish" button (bottom right — it replaces "Continue" once you're far enough into the flow). Its label may briefly change to "Publishing...".
17. Wait for a confirmation — either a toast/banner containing text like "Campaign successfully submitted for approval", or the Campaign Manager reporting table showing this campaign by name with an "Active" status. Once you see that, use "done".`;
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
      message:
        'Add a Pin title (and ideally an image URL) in the Pins tab before launching — the agent ' +
        'searches your existing Pinterest Pins by that title to attach one to this campaign.',
      steps: [],
    };
  }

  const tabId = await ensurePinterestAdsTab();
  const goal = buildGoalDescription(campaign);
  const playbook = buildPlaybook(campaign);
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

    const decision = await decideNextBrowserAction(goal, playbook, snapshot.elements, snapshot.url, steps);
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
