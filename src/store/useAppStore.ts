import { create } from 'zustand';

export type ActiveView = 'chat' | 'workspace' | 'settings';

interface AppState {
  activeView: ActiveView;
  activeConversationId: string | null;
  activeCampaignId: string | null;
  isAgentThinking: boolean;
  setActiveView: (view: ActiveView) => void;
  setActiveConversationId: (id: string | null) => void;
  openWorkspace: (campaignId: string) => void;
  setAgentThinking: (thinking: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'chat',
  activeConversationId: null,
  activeCampaignId: null,
  isAgentThinking: false,
  setActiveView: (view) => set({ activeView: view }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  openWorkspace: (campaignId) => set({ activeCampaignId: campaignId, activeView: 'workspace' }),
  setAgentThinking: (thinking) => set({ isAgentThinking: thinking }),
}));
