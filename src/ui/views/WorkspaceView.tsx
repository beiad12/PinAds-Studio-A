import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useCampaign, useUpsertPin, usePublishCampaign, useSettings } from '@/store/queries';
import { ScoreBadge } from '../components/ScoreBadge';
import type { Pin } from '@/types';

const TABS = ['Summary', 'Audience', 'Budget', 'Creative', 'Pins', 'History'] as const;
type Tab = (typeof TABS)[number];

export function WorkspaceView() {
  const { activeCampaignId, setActiveView } = useAppStore();
  const { data: campaign, isLoading } = useCampaign(activeCampaignId);
  const { data: settings } = useSettings();
  const upsertPin = useUpsertPin();
  const publish = usePublishCampaign();
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
            {campaign.pinterestCampaignId && (
              <Row label="Pinterest campaign" value={campaign.pinterestCampaignId} />
            )}
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

            <div className="rounded-xl bg-surface-raised p-4 ring-1 ring-surface-border">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
                Publish to Pinterest
              </p>
              {campaign.pinterestCampaignId ? (
                <p className="text-emerald-400">
                  Live on Pinterest since{' '}
                  {campaign.publishedAt ? new Date(campaign.publishedAt).toLocaleString() : '—'}.
                </p>
              ) : (
                <>
                  {!settings?.pinterestConnection && (
                    <p className="mb-2 text-white/50">
                      Connect a Pinterest account in Settings first.
                    </p>
                  )}
                  <button
                    onClick={() => publish.mutate(campaign.id)}
                    disabled={publish.isPending || !settings?.pinterestConnection}
                    className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                  >
                    {publish.isPending ? 'Publishing…' : 'Publish this campaign for real'}
                  </button>
                </>
              )}
              {(campaign.publishError || publish.isError) && (
                <p className="mt-2 text-red-400">
                  {campaign.publishError ?? (publish.error as Error)?.message}
                </p>
              )}
            </div>
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
          <PinEditor
            campaignId={campaign.id}
            pin={group.creative.pins[0]}
            defaultTitle={campaign.name}
            defaultDestination={campaign.websiteUrl ?? ''}
            onSave={(patch) => upsertPin.mutate({ campaignId: campaign.id, patch })}
          />
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

function PinEditor({
  campaignId,
  pin,
  defaultTitle,
  defaultDestination,
  onSave,
}: {
  campaignId: string;
  pin?: Pin;
  defaultTitle: string;
  defaultDestination: string;
  onSave: (patch: { imageUrl?: string; title?: string; destinationUrl?: string }) => void;
}) {
  const [imageUrl, setImageUrl] = useState(pin?.imageUrl ?? '');
  const [title, setTitle] = useState(pin?.title ?? defaultTitle);
  const [destinationUrl, setDestinationUrl] = useState(pin?.destinationUrl ?? defaultDestination);

  useEffect(() => {
    setImageUrl(pin?.imageUrl ?? '');
    setTitle(pin?.title ?? defaultTitle);
    setDestinationUrl(pin?.destinationUrl ?? defaultDestination);
  }, [campaignId, pin?.imageUrl, pin?.title, pin?.destinationUrl, defaultTitle, defaultDestination]);

  return (
    <div className="space-y-3 text-[13px] text-white/80">
      <p className="text-white/50">
        Pinterest ads always attach to a Pin, and Pins require an image. Paste a public image URL
        — Pinterest fetches it directly, no upload needed.
      </p>
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Pin preview"
          className="max-h-48 w-auto rounded-xl ring-1 ring-surface-border"
        />
      )}
      <label className="block">
        <span className="mb-1 block text-xs text-white/40">Image URL</span>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white placeholder:text-white/30 ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-white/40">Pin title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-white/40">Destination URL</span>
        <input
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
        />
      </label>
      <button
        onClick={() => onSave({ imageUrl, title, destinationUrl })}
        className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
      >
        Save pin
      </button>
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
