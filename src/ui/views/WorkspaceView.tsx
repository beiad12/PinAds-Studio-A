import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  useCampaign,
  useUpsertPin,
  usePublishCampaign,
  useSettings,
  useLaunchCampaignBrowserAgent,
  useUpdateBudget,
  useUpdateMaxCpcBid,
  useUpdateAudience,
} from '@/store/queries';
import { ScoreBadge } from '../components/ScoreBadge';
import type { BrowserActionDecision } from '@/modules/browser-agent';
import type { AdGroup, Budget, Pin } from '@/types';

const COUNTRY_OPTIONS: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'MX', name: 'Mexico' },
];

const TABS = ['Summary', 'Audience', 'Budget', 'Creative', 'Pins', 'History'] as const;
type Tab = (typeof TABS)[number];

export function WorkspaceView() {
  const { activeCampaignId, setActiveView } = useAppStore();
  const { data: campaign, isLoading } = useCampaign(activeCampaignId);
  const { data: settings } = useSettings();
  const upsertPin = useUpsertPin();
  const publish = usePublishCampaign();
  const launchAgent = useLaunchCampaignBrowserAgent();
  const updateBudget = useUpdateBudget();
  const updateMaxCpcBid = useUpdateMaxCpcBid();
  const updateAudience = useUpdateAudience();
  const [tab, setTab] = useState<Tab>('Summary');
  const [agentSteps, setAgentSteps] = useState<BrowserActionDecision[]>([]);

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

            <div className="rounded-xl bg-surface-raised p-4 ring-1 ring-surface-border">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/40">
                Launch via Ads Manager (browser automation)
              </p>
              <p className="mb-2 text-white/50">
                No developer app needed — this drives a real Pinterest Ads Manager tab: it reads
                what's on screen and clicks/types through campaign creation itself, step by step.
                Watch the Pinterest tab while it runs.
              </p>
              <button
                onClick={() => {
                  setAgentSteps([]);
                  launchAgent.mutate({
                    campaign,
                    onStep: (step) => setAgentSteps((prev) => [...prev, step]),
                  });
                }}
                disabled={launchAgent.isPending}
                className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
              >
                {launchAgent.isPending ? 'Working in the Pinterest tab…' : 'Launch on Pinterest now'}
              </button>

              {agentSteps.length > 0 && (
                <ol className="mt-3 space-y-1 border-t border-surface-border/60 pt-3">
                  {agentSteps.map((s, i) => (
                    <li key={i} className="text-[12px] text-white/60">
                      <span className="text-white/30">{i + 1}.</span> {s.action}
                      {s.index !== undefined ? ` #${s.index}` : ''}
                      {s.value ? ` "${s.value}"` : ''} — {s.reason}
                    </li>
                  ))}
                </ol>
              )}
              {launchAgent.data && (
                <p className={`mt-2 ${launchAgent.data.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {launchAgent.data.message}
                </p>
              )}
              {launchAgent.isError && (
                <p className="mt-2 text-red-400">{(launchAgent.error as Error).message}</p>
              )}
            </div>
          </div>
        )}

        {tab === 'Audience' && group && (
          <AudienceEditor
            campaignId={campaign.id}
            group={group}
            onSave={(patch) => updateAudience.mutate({ campaignId: campaign.id, patch })}
          />
        )}

        {tab === 'Budget' && (
          <BudgetEditor
            campaignId={campaign.id}
            budget={campaign.budget}
            maxCpcBid={campaign.maxCpcBid}
            onSaveBudget={(amount, type) => updateBudget.mutate({ campaignId: campaign.id, amount, type })}
            onSaveCpc={(amount) => updateMaxCpcBid.mutate({ campaignId: campaign.id, amount })}
          />
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
        Pinterest ads always attach to a Pin. If you publish via the API, paste a public image
        URL here and Pinterest fetches it directly. If you launch via browser automation, this
        title is what the agent searches your existing Pinterest Pins for — make sure a similar
        Pin already exists on your account.
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

function AudienceEditor({
  campaignId,
  group,
  onSave,
}: {
  campaignId: string;
  group: AdGroup;
  onSave: (patch: {
    gender: 'women' | 'men' | 'all';
    ageMin: number;
    ageMax: number;
    countryCode: string;
    countryName: string;
  }) => void;
}) {
  const [gender, setGender] = useState(group.audience.gender);
  const [ageMin, setAgeMin] = useState(group.audience.ageRange.min);
  const [ageMax, setAgeMax] = useState(group.audience.ageRange.max);
  const [countryCode, setCountryCode] = useState(
    group.audience.locations[0]?.countryCode ?? 'US'
  );

  useEffect(() => {
    setGender(group.audience.gender);
    setAgeMin(group.audience.ageRange.min);
    setAgeMax(group.audience.ageRange.max);
    setCountryCode(group.audience.locations[0]?.countryCode ?? 'US');
  }, [campaignId, group.audience.gender, group.audience.ageRange.min, group.audience.ageRange.max, group.audience.locations]);

  return (
    <div className="space-y-4 text-[13px] text-white/80">
      <label className="block">
        <span className="mb-1 block text-xs text-white/40">Gender</span>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as 'women' | 'men' | 'all')}
          className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none"
        >
          <option value="all">All genders</option>
          <option value="women">Women</option>
          <option value="men">Men</option>
        </select>
      </label>

      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="mb-1 block text-xs text-white/40">Min age</span>
          <input
            type="number"
            min={18}
            max={65}
            value={ageMin}
            onChange={(e) => setAgeMin(Number(e.target.value))}
            className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs text-white/40">Max age</span>
          <input
            type="number"
            min={18}
            max={65}
            value={ageMax}
            onChange={(e) => setAgeMax(Number(e.target.value))}
            className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-white/40">Country</span>
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <Row
        label="Interests"
        value={group.audience.interests.map((i) => i.label).join(', ') || '— (set via chat)'}
      />
      <Row
        label="Keywords"
        value={group.audience.keywords.map((k) => k.term).join(', ') || '— (set via chat)'}
      />

      <button
        onClick={() => {
          const country = COUNTRY_OPTIONS.find((c) => c.code === countryCode)!;
          onSave({ gender, ageMin, ageMax, countryCode: country.code, countryName: country.name });
        }}
        className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
      >
        Save audience
      </button>
    </div>
  );
}

function BudgetEditor({
  campaignId,
  budget,
  maxCpcBid,
  onSaveBudget,
  onSaveCpc,
}: {
  campaignId: string;
  budget: Budget;
  maxCpcBid?: number;
  onSaveBudget: (amount: number, type: 'daily' | 'lifetime') => void;
  onSaveCpc: (amount: number | undefined) => void;
}) {
  const [amount, setAmount] = useState(budget.amount);
  const [type, setType] = useState(budget.type);
  const [cpc, setCpc] = useState(maxCpcBid?.toString() ?? '');

  useEffect(() => {
    setAmount(budget.amount);
    setType(budget.type);
    setCpc(maxCpcBid?.toString() ?? '');
  }, [campaignId, budget.amount, budget.type, maxCpcBid]);

  return (
    <div className="space-y-4 text-[13px] text-white/80">
      <label className="block">
        <span className="mb-1 block text-xs text-white/40">Budget type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'daily' | 'lifetime')}
          className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none"
        >
          <option value="daily">Daily</option>
          <option value="lifetime">Lifetime</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-white/40">Amount ({budget.currency})</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
        />
      </label>
      <button
        onClick={() => onSaveBudget(amount, type)}
        className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
      >
        Save budget
      </button>

      <div className="border-t border-surface-border/60 pt-4">
        <label className="block">
          <span className="mb-1 block text-xs text-white/40">
            Max CPC bid ({budget.currency}) — leave blank for automatic bidding
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={cpc}
            onChange={(e) => setCpc(e.target.value)}
            placeholder="Automatic (Pinterest Performance+ bidding)"
            className="w-full rounded-xl bg-surface-raised px-3 py-2 text-[13px] text-white placeholder:text-white/30 ring-1 ring-surface-border focus:outline-none focus:ring-white/20"
          />
        </label>
        <button
          onClick={() => onSaveCpc(cpc.trim() ? Number(cpc) : undefined)}
          className="mt-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
        >
          Save CPC bid
        </button>
      </div>
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
