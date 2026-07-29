/**
 * campaign-manager: CRUD + business rules for campaigns/ad groups/pins; single source of truth for mutations.
 */

import { campaignsRepo, conversationsRepo } from '../storage';
import { computeAIScore } from '../analytics';
import { createDefaultAudience, mergeAudiencePatch, parseAudienceInstruction } from '../audience-builder';
import { generateHeadlines, generateDescriptions, createDefaultCTA } from '../creative-studio';
import * as pinterest from '../pinterest';
import { generateId, nowISO } from '@/lib/id';
import type {
  AdGroup,
  AgentToolCall,
  Campaign,
  CampaignObjective,
  Creative,
  CreativeTone,
} from '@/types';

export async function listCampaigns(): Promise<Campaign[]> {
  return campaignsRepo.getAll();
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return campaignsRepo.get(id);
}

function emptyCreative(): Creative {
  return { id: generateId(), headlines: [], descriptions: [], ctas: [createDefaultCTA()], pins: [] };
}

interface CreateCampaignSpec {
  name: string;
  objective: CampaignObjective;
  websiteUrl?: string;
  budgetAmount: number;
  budgetType?: 'daily' | 'lifetime';
  currency?: string;
  gender?: 'women' | 'men' | 'all';
  ageMin?: number;
  ageMax?: number;
  countryCode?: string;
  countryName?: string;
  headlines?: string[];
  descriptions?: string[];
}

export async function createCampaign(
  spec: CreateCampaignSpec,
  conversationId: string
): Promise<Campaign> {
  const audience = createDefaultAudience({
    gender: spec.gender ?? 'all',
    ageRange:
      spec.ageMin && spec.ageMax ? { min: spec.ageMin, max: spec.ageMax } : undefined,
    locations:
      spec.countryCode && spec.countryName
        ? [{ countryCode: spec.countryCode, countryName: spec.countryName }]
        : undefined,
  });

  const creative = emptyCreative();
  if (spec.headlines?.length) {
    creative.headlines = spec.headlines.map((text, i) => ({
      id: generateId(),
      text,
      tone: 'neutral',
      isSelected: i === 0,
      createdAt: nowISO(),
    }));
  }
  if (spec.descriptions?.length) {
    creative.descriptions = spec.descriptions.map((text, i) => ({
      id: generateId(),
      text,
      tone: 'neutral',
      isSelected: i === 0,
      createdAt: nowISO(),
    }));
  }

  const adGroup: AdGroup = { id: generateId(), name: `${spec.name} — Ad Group 1`, audience, creative };

  const now = nowISO();
  const campaign: Campaign = {
    id: generateId(),
    name: spec.name,
    objective: spec.objective,
    status: 'draft',
    budget: {
      amount: spec.budgetAmount,
      currency: spec.currency ?? 'USD',
      type: spec.budgetType ?? 'daily',
    },
    websiteUrl: spec.websiteUrl,
    adGroups: [adGroup],
    conversationId,
    createdAt: now,
    updatedAt: now,
  };
  campaign.aiScore = computeAIScore(campaign);

  await campaignsRepo.put(campaign);
  await linkCampaignToConversation(conversationId, campaign.id);
  return campaign;
}

async function linkCampaignToConversation(conversationId: string, campaignId: string) {
  const conversation = await conversationsRepo.get(conversationId);
  if (!conversation) return;
  if (!conversation.relatedCampaignIds.includes(campaignId)) {
    conversation.relatedCampaignIds.push(campaignId);
    conversation.updatedAt = nowISO();
    await conversationsRepo.put(conversation);
  }
}

async function saveWithScore(campaign: Campaign): Promise<Campaign> {
  campaign.updatedAt = nowISO();
  campaign.aiScore = computeAIScore(campaign);
  await campaignsRepo.put(campaign);
  return campaign;
}

export async function updateCampaign(
  id: string,
  patch: Partial<Pick<Campaign, 'name' | 'objective' | 'status'>>
): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  Object.assign(campaign, patch);
  return saveWithScore(campaign);
}

export async function duplicateCampaign(
  id: string,
  overrides: { newName?: string; countryCode?: string; countryName?: string } = {}
): Promise<Campaign> {
  const source = await requireCampaign(id);
  const now = nowISO();
  const clone: Campaign = {
    ...structuredClone(source),
    id: generateId(),
    name: overrides.newName ?? `${source.name} (Copy)`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    duplicatedFromCampaignId: source.id,
  };
  clone.adGroups = clone.adGroups.map((group) => ({
    ...group,
    id: generateId(),
    audience:
      overrides.countryCode && overrides.countryName
        ? mergeAudiencePatch(group.audience, {
            locations: [{ countryCode: overrides.countryCode, countryName: overrides.countryName }],
          })
        : group.audience,
    creative: { ...group.creative, id: generateId() },
  }));
  clone.aiScore = computeAIScore(clone);
  await campaignsRepo.put(clone);
  await linkCampaignToConversation(source.conversationId, clone.id);
  return clone;
}

export async function updateBudget(
  id: string,
  amount: number,
  type?: 'daily' | 'lifetime'
): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  campaign.budget = { ...campaign.budget, amount, type: type ?? campaign.budget.type };
  return saveWithScore(campaign);
}

export async function updateAllBudgets(amount: number, type?: 'daily' | 'lifetime'): Promise<Campaign[]> {
  const campaigns = await listCampaigns();
  const updated: Campaign[] = [];
  for (const campaign of campaigns) {
    campaign.budget = { ...campaign.budget, amount, type: type ?? campaign.budget.type };
    updated.push(await saveWithScore(campaign));
  }
  return updated;
}

export async function updateAudience(
  id: string,
  instructionOrPatch: string | Record<string, unknown>
): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  const patch =
    typeof instructionOrPatch === 'string'
      ? parseAudienceInstruction(instructionOrPatch)
      : structuredPatchFromArgs(instructionOrPatch);

  campaign.adGroups = campaign.adGroups.map((group) => ({
    ...group,
    audience: mergeAudiencePatch(group.audience, patch),
  }));
  return saveWithScore(campaign);
}

function structuredPatchFromArgs(args: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if (args.gender) patch.gender = args.gender;
  if (args.ageMin && args.ageMax) patch.ageRange = { min: args.ageMin, max: args.ageMax };
  if (args.countryCode && args.countryName) {
    patch.locations = [{ countryCode: args.countryCode, countryName: args.countryName }];
  }
  return patch;
}

export async function pauseCampaign(id: string): Promise<Campaign> {
  const campaign = await updateCampaign(id, { status: 'paused' });
  await syncStatusBestEffort(campaign);
  return campaign;
}

export async function resumeCampaign(id: string): Promise<Campaign> {
  const current = await requireCampaign(id);
  const campaign = await updateCampaign(id, {
    status: current.status === 'draft' ? 'draft' : 'active',
  });
  await syncStatusBestEffort(campaign);
  return campaign;
}

async function syncStatusBestEffort(campaign: Campaign): Promise<void> {
  if (!campaign.pinterestCampaignId) return;
  try {
    await pinterest.syncCampaignStatus(campaign);
  } catch {
    // Local status already saved; a failed remote sync isn't fatal here —
    // the next publish/refresh attempt will surface the real error.
  }
}

/**
 * Actually publishes a campaign to Pinterest: creates the live Campaign, Pin(s),
 * ad group(s), and ad(s) via the Ads API, then persists the resulting Pinterest
 * object ids. This is the only path that puts a campaign live — it is never
 * triggered automatically by the AI, only by an explicit user action in the UI.
 */
export async function publishCampaignToPinterest(id: string): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  try {
    const published = await pinterest.publishCampaign(campaign);
    return saveWithScore(published);
  } catch (error) {
    campaign.publishError = error instanceof Error ? error.message : String(error);
    await saveWithScore(campaign);
    throw error;
  }
}

/**
 * Creates or updates the Pin image/copy for a campaign's (first) ad group.
 * Publishing requires a real image URL here — Pinterest ads always attach to
 * a Pin, and Pins always require media.
 */
export async function upsertPin(
  id: string,
  patch: { imageUrl?: string; title?: string; destinationUrl?: string },
  adGroupIndex = 0
): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  const group = campaign.adGroups[adGroupIndex];
  if (!group) throw new Error(`Campaign ${id} has no ad group at index ${adGroupIndex}`);

  const existing = group.creative.pins[0];
  if (existing) {
    Object.assign(existing, patch);
  } else {
    group.creative.pins.push({
      id: generateId(),
      imageUrl: patch.imageUrl,
      title: patch.title ?? campaign.name,
      destinationUrl: patch.destinationUrl ?? campaign.websiteUrl ?? '',
    });
  }
  return saveWithScore(campaign);
}

export async function regenerateCreative(
  id: string,
  tone: CreativeTone = 'neutral',
  theme?: string
): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  const topic = theme ? `${campaign.name} — ${theme}` : campaign.name;

  for (const group of campaign.adGroups) {
    const [headlines, descriptions] = await Promise.all([
      generateHeadlines(topic, tone, 5),
      generateDescriptions(topic, tone, 3),
    ]);
    group.creative.headlines = headlines;
    group.creative.descriptions = descriptions;
  }
  return saveWithScore(campaign);
}

export async function addHeadlines(id: string, tone: CreativeTone = 'neutral', count = 5): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  for (const group of campaign.adGroups) {
    const headlines = await generateHeadlines(campaign.name, tone, count);
    group.creative.headlines = [...group.creative.headlines, ...headlines];
  }
  return saveWithScore(campaign);
}

export async function addDescriptions(id: string, tone: CreativeTone = 'neutral', count = 3): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  for (const group of campaign.adGroups) {
    const descriptions = await generateDescriptions(campaign.name, tone, count);
    group.creative.descriptions = [...group.creative.descriptions, ...descriptions];
  }
  return saveWithScore(campaign);
}

export async function recomputeScore(id: string): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  return saveWithScore(campaign);
}

async function requireCampaign(id: string): Promise<Campaign> {
  const campaign = await campaignsRepo.get(id);
  if (!campaign) throw new Error(`Campaign ${id} not found`);
  return campaign;
}

/**
 * Executes an agent-proposed tool call against this module (and the modules
 * it composes). Returns the applied AgentToolCall with its result attached.
 * The AI never mutates state directly — this is the only entry point.
 */
export async function applyToolCall(
  call: AgentToolCall,
  conversationId: string
): Promise<AgentToolCall> {
  try {
    const args = call.arguments as Record<string, any>;
    let result: Record<string, unknown> = {};

    switch (call.name) {
      case 'create_campaigns': {
        const specs = (args.campaigns ?? []) as CreateCampaignSpec[];
        const created = await Promise.all(specs.map((s) => createCampaign(s, conversationId)));
        result = { campaignIds: created.map((c) => c.id), campaigns: created };
        break;
      }
      case 'update_campaign': {
        const campaign = await updateCampaign(args.campaignId, {
          name: args.name,
          objective: args.objective,
        });
        result = { campaign };
        break;
      }
      case 'duplicate_campaign': {
        const campaign = await duplicateCampaign(args.campaignId, {
          newName: args.newName,
          countryCode: args.countryCode,
          countryName: args.countryName,
        });
        result = { campaign };
        break;
      }
      case 'update_audience': {
        const campaign = await updateAudience(args.campaignId, args);
        result = { campaign };
        break;
      }
      case 'update_budget': {
        if (args.campaignId) {
          result = { campaign: await updateBudget(args.campaignId, args.amount, args.type) };
        } else {
          result = { campaigns: await updateAllBudgets(args.amount, args.type) };
        }
        break;
      }
      case 'generate_headlines': {
        result = { campaign: await addHeadlines(args.campaignId, args.tone, args.count) };
        break;
      }
      case 'generate_descriptions': {
        result = { campaign: await addDescriptions(args.campaignId, args.tone, args.count) };
        break;
      }
      case 'regenerate_creative': {
        result = { campaign: await regenerateCreative(args.campaignId, args.tone, args.theme) };
        break;
      }
      case 'pause_campaign': {
        result = { campaign: await pauseCampaign(args.campaignId) };
        break;
      }
      case 'resume_campaign': {
        result = { campaign: await resumeCampaign(args.campaignId) };
        break;
      }
      case 'compute_ai_score': {
        result = { campaign: await recomputeScore(args.campaignId) };
        break;
      }
      case 'analyze_website': {
        // Handled by conversation-engine (delegates to website-analyzer) before reaching here.
        result = {};
        break;
      }
      default:
        throw new Error(`Unhandled tool call: ${call.name}`);
    }

    return { ...call, result, status: 'applied' };
  } catch (error) {
    return {
      ...call,
      result: { error: error instanceof Error ? error.message : String(error) },
      status: 'failed',
    };
  }
}
