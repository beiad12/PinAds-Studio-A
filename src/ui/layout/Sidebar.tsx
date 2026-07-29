import { useAppStore } from '@/store/useAppStore';
import { useCampaigns, useCreateConversation } from '@/store/queries';

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-white/30',
  ready: 'bg-blue-400',
  active: 'bg-emerald-400',
  paused: 'bg-amber-400',
  archived: 'bg-white/10',
};

export function Sidebar() {
  const { activeView, activeCampaignId, setActiveView, openWorkspace, setActiveConversationId } =
    useAppStore();
  const { data: campaigns = [] } = useCampaigns();
  const createConversation = useCreateConversation();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-surface-border bg-surface-raised">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold">
          P
        </div>
        <span className="font-semibold tracking-tight">PinAds Studio AI</span>
      </div>

      <div className="px-3">
        <button
          onClick={async () => {
            const conversation = await createConversation.mutateAsync(undefined);
            setActiveConversationId(conversation.id);
            setActiveView('chat');
          }}
          className="w-full rounded-xl bg-white/5 px-3 py-2 text-left text-sm font-medium text-white/90 transition hover:bg-white/10"
        >
          + New conversation
        </button>
      </div>

      <nav className="mt-4 flex flex-col gap-0.5 px-2">
        {(['chat', 'settings'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`rounded-lg px-3 py-2 text-left capitalize transition ${
              activeView === view ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
            }`}
          >
            {view === 'chat' ? 'Chat' : 'Settings'}
          </button>
        ))}
      </nav>

      <div className="mt-5 flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-white/40">
          Campaigns
        </div>
        {campaigns.length === 0 && (
          <p className="px-2 text-xs text-white/40">
            None yet — describe a campaign in chat to get started.
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => openWorkspace(c.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
                activeView === 'workspace' && activeCampaignId === c.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[c.status]}`} />
              <span className="truncate text-[13px]">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
