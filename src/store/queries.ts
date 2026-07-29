import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryClient';
import {
  listCampaigns,
  getCampaign,
  upsertPin,
  publishCampaignToPinterest,
  updateBudget,
  updateAudience,
  updateMaxCpcBid,
} from '../modules/campaign-manager';
import {
  listConversations,
  getConversation,
  createConversation,
  sendMessage,
} from '../modules/conversation-engine';
import { getSettings, saveSettings, saveProviderApiKey, saveProviderModel } from '../modules/settings';
import { testProviderConnection } from '../modules/ai-agent';
import * as pinterest from '../modules/pinterest';
import { launchCampaignInAdsManager, type BrowserActionDecision } from '../modules/browser-agent';
import type { AIProviderId, Campaign, Settings } from '@/types';

export function useCampaigns() {
  return useQuery({ queryKey: queryKeys.campaigns, queryFn: listCampaigns });
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: queryKeys.campaign(id ?? ''),
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(id),
  });
}

export function useConversations() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: listConversations });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? ''),
    queryFn: () => getConversation(id as string),
    enabled: Boolean(id),
  });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: getSettings });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => createConversation(title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, text }: { conversationId: string; text: string }) =>
      sendMessage(conversationId, text),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversation.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
      for (const id of conversation.relatedCampaignIds) {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaign(id) });
      }
    },
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => saveSettings(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useSaveProviderApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, apiKey }: { providerId: Settings['activeProviderId']; apiKey: string }) =>
      saveProviderApiKey(providerId, apiKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useSaveProviderModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, model }: { providerId: AIProviderId; model: string }) =>
      saveProviderModel(providerId, model),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useTestProviderConnection() {
  return useMutation({
    mutationFn: (providerId: AIProviderId) => testProviderConnection(providerId),
  });
}

export function useUpsertPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      patch,
    }: {
      campaignId: string;
      patch: { imageUrl?: string; title?: string; destinationUrl?: string };
    }) => upsertPin(campaignId, patch),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(campaign.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      amount,
      type,
    }: {
      campaignId: string;
      amount: number;
      type?: 'daily' | 'lifetime';
    }) => updateBudget(campaignId, amount, type),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(campaign.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
    },
  });
}

export function useUpdateMaxCpcBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, amount }: { campaignId: string; amount: number | undefined }) =>
      updateMaxCpcBid(campaignId, amount),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(campaign.id) });
    },
  });
}

export function useUpdateAudience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      patch,
    }: {
      campaignId: string;
      patch: {
        gender?: 'women' | 'men' | 'all';
        ageMin?: number;
        ageMax?: number;
        countryCode?: string;
        countryName?: string;
      };
    }) => updateAudience(campaignId, patch),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(campaign.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
    },
  });
}

export function usePublishCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => publishCampaignToPinterest(campaignId),
    onSettled: (_data, _error, campaignId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
    },
  });
}

export function useConnectPinterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pinterest.connect(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useDisconnectPinterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pinterest.disconnect(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function usePinterestAdAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ['pinterest', 'adAccounts'],
    queryFn: () => pinterest.fetchAdAccounts(),
    enabled,
  });
}

export function usePinterestBoards(enabled: boolean) {
  return useQuery({
    queryKey: ['pinterest', 'boards'],
    queryFn: () => pinterest.fetchBoards(),
    enabled,
  });
}

export function useSelectPinterestAdAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => pinterest.selectAdAccount(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useSelectPinterestBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => pinterest.selectBoard(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useCreatePinterestBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => pinterest.createBoard(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pinterest', 'boards'] }),
  });
}

export function useLaunchCampaignBrowserAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaign,
      onStep,
    }: {
      campaign: Campaign;
      onStep?: (step: BrowserActionDecision) => void;
    }) => launchCampaignInAdsManager(campaign, onStep),
    onSettled: (_data, _error, { campaign }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(campaign.id) });
    },
  });
}
