import { useState } from 'react';
import { useSettings, useSaveSettings, useSaveProviderApiKey } from '@/store/queries';
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
    </div>
  );
}
