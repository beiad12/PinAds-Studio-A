import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useCampaign } from '@/store/queries';
import { ScoreBadge } from '../components/ScoreBadge';

const TABS = ['Summary', 'Audience', 'Budget', 'Creative', 'Pins', 'History'] as const;
type Tab = (typeof TABS)[number];

export function WorkspaceView() {
  const { activeCampaignId, setActiveView } = useAppStore();
  const { data: campaign, isLoading } = useCampaign(activeCampaignId);
  const [tab, setTab] = useState<Tab>('Summary');

  if (isLoading) {
    return <div className="p-6 text-white/40">Loading…</div>;
  }
  if (!campaign) {
    return (
      <div className="p-6 text-white/40">
        No campaign selected.{' '}
        <button className="text-accent underline" onClick={() => setActiveView('chat')}>
          Go to chat
        </button>
      </div>
    );
  }

  const group = campaign.adGroups[0];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{campaign.name}</h1>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-white/40">
              {campaign.objective.replace(/_/g, ' ')} · {campaign.status}
            </p>
          </div>
          {campaign.aiScore && <ScoreBadge value={campaign.aiScore.value} />}
        </div>
        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === t ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'Summary' && (
          <div className="space-y-4 text-[13px] text-white/80">
            <Row label="Website" value={campaign.websiteUrl ?? '—'} />
            <Row
              label="Budget"
              value={`$${campaign.budget.amount} ${campaign.budget.type} (${campaign.budget.currency})`}
            />
            <Row label="Ad groups" value={String(campaign.adGroups.length)} />
            {campaign.aiScore && (
              <div className="rounded-xl bg-surface-raised p-4 ring-1 ring-surface-border">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
                  Suggestions
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  {campaign.aiScore.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'Audience' && group && (
          <div className="space-y-4 text-[13px] text-white/80">
            <Row label="Gender" value={group.audience.gender} />
            <Row
              label="Age range"
              value={`${group.audience.ageRange.min}–${group.audience.ageRange.max}`}
            />
            <Row
              label="Locations"
              value={group.audience.locations.map((l) => l.countryName).join(', ') || '—'}
            />
            <Row
              label="Interests"
              value={group.audience.interests.map((i) => i.label).join(', ') || '—'}
            />
            <Row
              label="Keywords"
              value={group.audience.keywords.map((k) => k.term).join(', ') || '—'}
            />
          </div>
        )}

        {tab === 'Budget' && (
          <div className="space-y-4 text-[13px] text-white/80">
            <Row label="Amount" value={`$${campaign.budget.amount}`} />
            <Row label="Type" value={campaign.budget.type} />
            <Row label="Currency" value={campaign.budget.currency} />
          </div>
        )}

        {tab === 'Creative' && group && (
          <div className="space-y-5">
            <CreativeList title="Headlines" items={group.creative.headlines.map((h) => h.text)} />
            <CreativeList
              title="Descriptions"
              items={group.creative.descriptions.map((d) => d.text)}
            />
            <CreativeList
              title="Calls to action"
              items={group.creative.ctas.map((c) => c.label)}
            />
          </div>
        )}

        {tab === 'Pins' && group && (
          <div className="text-[13px] text-white/60">
            {group.creative.pins.length === 0
              ? 'No pins yet — ask the AI to generate creative for this campaign.'
              : group.creative.pins.map((p) => <div key={p.id}>{p.title}</div>)}
          </div>
        )}

        {tab === 'History' && (
          <p className="text-[13px] text-white/50">
            See the Chat tab for the full conversation that shaped this campaign.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border/60 pb-2">
      <span className="text-white/40">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function CreativeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">{title}</p>
      {items.length === 0 ? (
        <p className="text-[13px] text-white/40">None yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((text, i) => (
            <li
              key={i}
              className="rounded-lg bg-surface-raised px-3 py-2 text-[13px] text-white/80 ring-1 ring-surface-border"
            >
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
