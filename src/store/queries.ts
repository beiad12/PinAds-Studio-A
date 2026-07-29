import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryClient';
import { listCampaigns, getCampaign } from '../modules/campaign-manager';
import {
  listConversations,
  getConversation,
  createConversation,
  sendMessage,
} from '../modules/conversation-engine';
import { getSettings, saveSettings, saveProviderApiKey } from '../modules/settings';
import type { Settings } from '@/types';

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
