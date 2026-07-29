import { useState } from 'react';
import {
  useSettings,
  useSaveSettings,
  useSaveProviderApiKey,
  useConnectPinterest,
  useDisconnectPinterest,
  usePinterestAdAccounts,
  usePinterestBoards,
  useSelectPinterestAdAccount,
  useSelectPinterestBoard,
  useCreatePinterestBoard,
} from '@/store/queries';
import { getPinterestRedirectUri } from '@/lib/pinterestRedirectUri';
import type { AIProviderId, MarketingMode } from '@/types';

const PROVIDERS: { id: AIProviderId; label: string; available: boolean }[] = [
  { id: 'openai', label: 'OpenAI', available: true },
  { id: 'anthropic', label: 'Anthropic', available: true },
  { id: 'gemini', label: 'Gemini', available: true },
  { id: 'mistral', label: 'Mistral', available: true },
];

const MODES: { id: MarketingMode; label: string; description: string }[] = [
  { id: 'beginner', label: 'Beginner', description: 'Explains every recommendation, step by step.' },
  { id: 'professional', label: 'Professional', description: 'Concise, assumes marketing knowledge.' },
  { id: 'autopilot', label: 'Autopilot', description: 'Drafts a full strategy up front for your approval.' },
];

export function SettingsView() {
  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();
  const saveKey = useSaveProviderApiKey();
  const [apiKeyDraft, setApiKeyDraft] = useState('');

  const [pinterestClientId, setPinterestClientId] = useState('');
  const [pinterestClientSecret, setPinterestClientSecret] = useState('');
  const [newBoardName, setNewBoardName] = useState('');

  const connectPinterest = useConnectPinterest();
  const disconnectPinterest = useDisconnectPinterest();
  const isPinterestConnected = Boolean(settings?.pinterestConnection);
  const adAccounts = usePinterestAdAccounts(isPinterestConnected);
  const boards = usePinterestBoards(isPinterestConnected);
  const selectAdAccount = useSelectPinterestAdAccount();
  const selectBoard = useSelectPinterestBoard();
  const createBoard = useCreatePinterestBoard();

  if (!settings) return null;

  return (
    <div className="mx-auto max-w-lg space-y-8 px-6 py-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-white/90">AI provider</h2>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              disabled={!p.available}
              onClick={() => saveSettings.mutate({ activeProviderId: p.id })}
              className={`rounded-xl px-3 py-2.5 text-left text-[13px] ring-1 transition ${
                settings.activeProviderId === p.id
                  ? 'bg-accent/10 text-white ring-accent/50'
                  : 'bg-surface-raised text-white/70 ring-surface-border hover:bg-white/5'
              } ${!p.available ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              {p.label}
              {!p.available && <span className="ml-1 text-[10px] text-white/40">(soon)</span>}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
            placeholder={`${settings.activeProviderId} API key`}
            className="flex-1 rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white placeholder:text-white/30 ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
          />
          <button
            onClick={() => {
              if (!apiKeyDraft.trim()) return;
              saveKey.mutate({ providerId: settings.activeProviderId, apiKey: apiKeyDraft.trim() });
              setApiKeyDraft('');
            }}
            className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
          >
            Save key
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          {settings.credentials.some((c) => c.providerId === settings.activeProviderId)
            ? 'Key saved for this provider.'
            : 'No key saved yet — chat will fail until one is added.'}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-white/90">Marketing mode</h2>
        <div className="space-y-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => saveSettings.mutate({ marketingMode: m.id })}
              className={`w-full rounded-xl px-3 py-2.5 text-left ring-1 transition ${
                settings.marketingMode === m.id
                  ? 'bg-accent/10 ring-accent/50'
                  : 'bg-surface-raised ring-surface-border hover:bg-white/5'
              }`}
            >
              <p className="text-[13px] font-medium text-white">{m.label}</p>
              <p className="text-[11px] text-white/50">{m.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-white/90">Pinterest account</h2>
        <p className="mb-3 text-[11px] text-white/40">
          Requires a Pinterest Developer app (
          <a
            className="underline"
            href="https://developers.pinterest.com/apps/"
            target="_blank"
            rel="noreferrer"
          >
            developers.pinterest.com/apps
          </a>
          ) with redirect URI <code className="text-white/60">{getPinterestRedirectUri()}</code>{' '}
          registered. Publishing calls the real Pinterest Ads API — nothing is simulated.
        </p>

        {!isPinterestConnected ? (
          <div className="space-y-2">
            <input
              value={pinterestClientId}
              onChange={(e) => setPinterestClientId(e.target.value)}
              placeholder="Pinterest App Client ID"
              className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white placeholder:text-white/30 ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
            />
            <input
              type="password"
              value={pinterestClientSecret}
              onChange={(e) => setPinterestClientSecret(e.target.value)}
              placeholder="Pinterest App Client Secret"
              className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white placeholder:text-white/30 ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
            />
            <button
              onClick={async () => {
                if (!pinterestClientId.trim() || !pinterestClientSecret.trim()) return;
                await saveSettings.mutateAsync({
                  pinterestApp: {
                    clientId: pinterestClientId.trim(),
                    clientSecret: pinterestClientSecret.trim(),
                  },
                });
                connectPinterest.mutate();
              }}
              disabled={connectPinterest.isPending}
              className="w-full rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-40"
            >
              {connectPinterest.isPending ? 'Connecting…' : 'Connect Pinterest account'}
            </button>
            {connectPinterest.isError && (
              <p className="text-[11px] text-red-400">{(connectPinterest.error as Error).message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-surface-raised px-3 py-2.5 ring-1 ring-surface-border">
              <span className="text-[13px] text-emerald-400">Connected</span>
              <button
                onClick={() => disconnectPinterest.mutate()}
                className="text-[11px] text-white/50 underline hover:text-white/80"
              >
                Disconnect
              </button>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-white/70">Ad account</p>
              <select
                value={settings.pinterestConnection?.adAccountId ?? ''}
                onChange={(e) => {
                  const account = adAccounts.data?.find((a) => a.id === e.target.value);
                  if (account) selectAdAccount.mutate({ id: account.id, name: account.name });
                }}
                className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none"
              >
                <option value="">
                  {adAccounts.isLoading ? 'Loading…' : 'Select an ad account'}
                </option>
                {adAccounts.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-white/70">Board (Pins publish here)</p>
              <select
                value={settings.pinterestConnection?.boardId ?? ''}
                onChange={(e) => {
                  const board = boards.data?.find((b) => b.id === e.target.value);
                  if (board) selectBoard.mutate({ id: board.id, name: board.name });
                }}
                className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none"
              >
                <option value="">{boards.isLoading ? 'Loading…' : 'Select a board'}</option>
                {boards.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <input
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="New board name"
                  className="flex-1 rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white placeholder:text-white/30 ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
                />
                <button
                  onClick={async () => {
                    if (!newBoardName.trim()) return;
                    const board = await createBoard.mutateAsync(newBoardName.trim());
                    selectBoard.mutate({ id: board.id, name: board.name });
                    setNewBoardName('');
                  }}
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
