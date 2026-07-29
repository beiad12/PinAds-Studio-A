# PinAds Studio AI — Architecture

Status: **implemented through Phase 6**. This document was written during Phase 1
(architecture-only) and is kept as the design record; §2's module table has been updated
to reflect two modules added after Phase 1 (`pinterest`, `browser-agent`) — see the
top-level `README.md` for a plain-language summary of what's actually built and working.

## 1. Product framing

PinAds Studio AI is a conversational Pinterest-advertising co-pilot delivered as a
Chrome MV3 extension. The user describes an outcome in natural language; the AI Agent
plans, asks clarifying questions, and produces editable **Campaign Workspaces**. Nothing
publishes to Pinterest without explicit user review and confirmation. This is a fully
separate codebase/extension from the existing Pinterest Auto Saver — no shared code,
storage namespace, manifest, or build output.

## 2. Module map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Extension Popup / Side Panel (React)        │
│  ┌───────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │  Chat View     │  │ Campaign Workspace │  │ Settings / Modes  │   │
│  │  (Conversation │  │ View               │  │ View              │   │
│  │  Engine UI)    │  │ (Campaign Manager  │  │                   │   │
│  │                │  │  UI)               │  │                   │   │
│  └───────┬────────┘  └─────────┬─────────┘  └─────────┬──────────┘  │
└──────────┼──────────────────────┼───────────────────────┼───────────┘
           │                      │                       │
           ▼                      ▼                       ▼
   ┌───────────────┐   ┌───────────────────┐    ┌─────────────────┐
   │ Conversation   │   │ Campaign Manager   │    │ Settings Module │
   │ Engine         │◄──┤ (CRUD, scoring,    │    │ (AI provider,   │
   │ (turn loop,    │   │  duplication)      │    │  marketing mode,│
   │  intent →      │   └─────────┬──────────┘    │  keys)          │
   │  action)       │             │               └─────────────────┘
   └───────┬────────┘   ┌─────────┴──────────┐
           │            │                    │
           ▼            ▼                    ▼
   ┌───────────────┐ ┌──────────────┐  ┌──────────────────┐
   │  AI Agent      │ │ Audience     │  │ Creative Studio   │
   │ (orchestrator, │ │ Builder      │  │ (copy/headline/   │
   │  tool-calling, │ └──────────────┘  │  CTA generation)  │
   │  provider-     │ ┌──────────────┐  └──────────────────┘
   │  agnostic)     │ │ Website      │
   └───────┬────────┘ │ Analyzer     │
           │           └──────────────┘
           ▼
   ┌───────────────┐   ┌──────────────┐   ┌────────────────┐
   │ Queue Manager  │   │ Analytics    │   │ Storage Module  │
   │ (rate-limited, │   │ (AI score,   │   │ (IndexedDB      │
   │  retryable AI  │   │  suggestions)│   │  repositories)  │
   │  jobs)         │   └──────────────┘   └────────────────┘
   └───────────────┘

   Background Service Worker: sets side-panel-on-click behavior (composition root).

   Content Scripts: scoped to pinterest.com/ads.pinterest.com. Snapshot visible
   interactive elements and execute single actions on request — see `pinterest`
   and `browser-agent` in the table below for the two real publish paths.
```

### Module responsibilities

| Module | Responsibility | Depends on |
|---|---|---|
| `ai-agent` | Provider-agnostic orchestration: turns a conversation state + user message into either a chat reply or a structured "action" (create campaign, update budget, etc). Owns prompt construction, tool/function-call schema, and provider adapters. | `types`, `storage` (read-only context) |
| `conversation-engine` | Owns the conversation thread: message history, pending clarification questions, marketing-mode behavior switch. Calls `ai-agent`, applies resulting actions via `campaign-manager`. | `ai-agent`, `campaign-manager`, `storage` |
| `campaign-manager` | CRUD + business rules for campaigns/ad groups/pins: duplication, budget updates, status transitions, AI score computation trigger. Single source of truth for campaign state mutations. | `storage`, `analytics` |
| `audience-builder` | Translates natural-language audience descriptions into structured `Audience` objects; recommends audiences from website analysis. | `types` |
| `creative-studio` | Generates/regenerates headlines, descriptions, CTAs, seasonal variants; scores creative strength. Calls `ai-agent` for generation, does not call providers directly. | `ai-agent`, `types` |
| `website-analyzer` | Fetches and summarizes a landing page (via background fetch, not content script) into structured signals (topic, offers, tone) used to seed strategy. | `ai-agent` (for summarization), `lib` |
| `analytics` | Computes AI Score and performance suggestions from campaign + creative data. Pure functions over stored data; no external calls. | `types` |
| `storage` | IndexedDB repository layer (Dexie-style API over raw IndexedDB) + typed repositories per entity. Only module allowed to touch the DB directly. | `types` |
| `settings` | AI provider selection/keys, marketing mode, general preferences. Persists via `storage`. | `storage`, `types` |
| `queue-manager` | Serializes/retries AI provider calls and long-running jobs (e.g., website analysis) so the UI stays responsive and providers aren't hammered. | `types` |
| `background` | MV3 service worker entry point. Sets side-panel-on-click behavior; the tab-driving work described below actually runs in the side panel, which holds the `tabs` permission. | — |
| `content` | Injected on `pinterest.com`/`ads.pinterest.com`. Snapshots currently visible interactive elements (no fixed selectors) and executes a single click/type/select action on request from `browser-agent`. Decides nothing itself. | — |
| `pinterest` | OAuth 2.0 connect flow (`chrome.identity.launchWebAuthFlow`) + a typed Ads API v5 client (ad accounts, boards, Pins, campaigns, ad groups, ads). The only module allowed to call `api.pinterest.com`. `campaign-manager.publishCampaignToPinterest` calls `publishCampaign` here and persists the result. | `settings`, `types` |
| `browser-agent` | Drives a real Pinterest Ads Manager tab: opens/reuses a tab, then loops snapshot → `ai-agent.decideNextBrowserAction` (given a playbook transcribed from a real recorded session) → act via `content`, until the model reports on-page confirmation ("done") or gets stuck ("fail"). | `ai-agent`, `content` (via `tabController`) |
| `ui` | React components/views/layout. Presentation only; talks to modules via Zustand stores + React Query, never imports module internals directly across the boundary except through documented store actions. | `store` |
| `store` | Zustand stores (client state) + React Query wiring (async/server-ish state backed by IndexedDB via `storage`). | modules above |

Rule: modules never import UI. UI never imports `storage` directly — always through
`store`. Cross-module calls go through each module's public `index.ts` export, not deep
imports.

## 3. Marketing Modes

A single setting (`MarketingMode = 'beginner' | 'professional' | 'autopilot'`) lives in
`settings` and is read by `ai-agent` on every turn to adjust prompt behavior:

- **beginner** — agent explains reasoning, confirms each field before moving on, defines
  jargon.
- **professional** — agent is terse, assumes marketing vocabulary, batches questions.
- **autopilot** — agent asks the minimum number of clarifying questions, drafts a
  complete multi-campaign strategy up front, then presents one consolidated plan for
  approval. Never publishes without explicit confirmation, same as other modes.

This is a behavioral parameter passed into prompt construction — not a separate code
path per mode.

## 4. AI provider abstraction

Defined in `src/types/ai.ts` and implemented per-provider under
`src/modules/ai-agent/providers/*`. The agent core only depends on the
`AIProvider` interface, never on a concrete SDK, so adding Gemini/Mistral/etc. later
means adding one adapter file.

Key contract (see file for full types):

```ts
interface AIProvider {
  id: AIProviderId; // 'openai' | 'anthropic' | 'gemini' | 'mistral'
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  streamChat?(request: AIChatRequest): AsyncIterable<AIChatStreamChunk>;
}
```

The agent talks to providers only through structured "tool calls" (e.g.
`create_campaigns`, `update_budget`, `generate_headlines`) defined in
`src/types/ai.ts` as `AgentToolName` / `AgentToolCall`. This keeps campaign mutation
logic inside `campaign-manager`, never inside a prompt string.

## 5. State management

- **Zustand** — ephemeral/UI + session state: active conversation, active workspace id,
  in-flight AI request status, marketing mode toggle, draft (unsaved) plan before
  confirmation.
- **React Query** — cache layer over `storage` reads/writes (campaigns list, single
  campaign, conversation history), giving consistent loading/error states and
  invalidation after `campaign-manager` mutations.
- **IndexedDB** (via `storage` repositories) — durable source of truth: campaigns,
  audiences, creatives, conversations, settings. No campaign data ever lives only in
  memory.

Data flow for a mutating command (e.g. "increase budget to $20"):

```
UI (chat input)
  → store.conversation.sendMessage()
  → conversation-engine.handleUserMessage()
      → ai-agent.interpret() → AgentToolCall[]
      → campaign-manager.applyToolCall() → storage.campaigns.update()
      → analytics.recompute() → storage.campaigns.update(score)
  → React Query cache invalidated (['campaigns'], ['campaign', id])
  → UI re-renders workspace + chat confirmation message
```

## 6. Component hierarchy (UI)

```
<App>
 ├─ <AppShell>                     (layout/, top-level chrome, mode switch)
 │   ├─ <Sidebar>                  (campaign list, new-conversation button)
 │   ├─ <MainPanel>
 │   │   ├─ <ChatView>             (views/)
 │   │   │   ├─ <MessageList>
 │   │   │   │   └─ <MessageBubble variant="user|agent|system">
 │   │   │   ├─ <ClarificationPrompt>   (quick-reply chips for AI questions)
 │   │   │   ├─ <PlanReviewCard>        (shows draft plan pre-publish)
 │   │   │   └─ <ChatComposer>
 │   │   └─ <WorkspaceView>        (views/, shown when a campaign is selected)
 │   │       ├─ <WorkspaceHeader>  (name, status, AI Score badge)
 │   │       ├─ <WorkspaceTabs>    (Summary | Audience | Budget | Creative | Pins | History)
 │   │       ├─ <SummaryTab>
 │   │       ├─ <AudienceTab>
 │   │       ├─ <BudgetTab>
 │   │       ├─ <CreativeTab>      (headline/description variants, regenerate actions)
 │   │       ├─ <PinsTab>
 │   │       └─ <HistoryTab>       (conversation turns that shaped this campaign)
 │   └─ <SettingsPanel>            (AI provider, API keys, marketing mode)
 └─ <ToastLayer> / <CommandPalette> (shared components/)
```

All components in `ui/components` are presentation-only and typed against `types/`;
data fetching happens in `views/` via `store` hooks.

## 7. Data models (see `src/types/`)

- `campaign.ts` — `Campaign`, `AdGroup`, `Pin`, `CampaignStatus`, `Budget`, `AIScore`
- `audience.ts` — `Audience`, `AgeRange`, `Gender`, `Location`, `Interest`, `Keyword`
- `creative.ts` — `Creative`, `Headline`, `Description`, `CallToAction`, `CreativeTone`
- `conversation.ts` — `Conversation`, `Message`, `MessageRole`, `ClarificationQuestion`, `DraftPlan`
- `ai.ts` — `AIProvider`, `AIProviderId`, `AIChatRequest/Response`, `AgentToolCall`, `AgentToolName`
- `website.ts` — `WebsiteAnalysis`, `WebsiteSignal`
- `settings.ts` — `Settings`, `MarketingMode`, `ProviderCredentials`
- `workspace.ts` — `CampaignWorkspace` (aggregate view combining the above for the UI)

Full field-level definitions are in the files themselves (single source of truth —
not duplicated here to avoid drift).

## 8. Folder structure

```
PinAds-Studio-A/
├─ docs/
│   └─ ARCHITECTURE.md
├─ public/
│   └─ icons/
├─ src/
│   ├─ background/          # MV3 service worker entry (composition root)
│   ├─ content/              # Pinterest-scoped content script (DOM snapshot/act)
│   ├─ modules/
│   │   ├─ ai-agent/
│   │   │   └─ providers/    # openai, anthropic, gemini, mistral, unavailable
│   │   ├─ conversation-engine/
│   │   ├─ campaign-manager/
│   │   ├─ audience-builder/
│   │   ├─ creative-studio/
│   │   ├─ website-analyzer/
│   │   ├─ analytics/
│   │   ├─ storage/
│   │   ├─ settings/
│   │   ├─ queue-manager/
│   │   ├─ pinterest/        # OAuth + Ads API v5 client (real publish path)
│   │   └─ browser-agent/    # drives a real Ads Manager tab (real publish path)
│   ├─ store/                # Zustand stores + React Query hooks
│   ├─ types/                # Shared data models (see §7)
│   ├─ lib/                  # Cross-cutting pure utilities (no module state)
│   └─ ui/
│       ├─ components/       # Presentational, reusable
│       ├─ layout/           # AppShell, Sidebar, panels
│       └─ views/             # ChatView, WorkspaceView, SettingsView
├─ manifest.config.ts        # MV3 manifest (source of truth; CRXJS builds manifest.json)
├─ package.json
├─ tsconfig.json
├─ tailwind.config.ts
└─ vite.config.ts
```

Each module directory contains an `index.ts` (public API surface) plus internal files
not imported from outside the module.

## 9. Implementation status

Phases 1–6 are implemented (see the top-level `README.md` for a plain-language feature
list). Not yet built: automated tests, image generation for Pins, and any further
optimization pass (Phases 7–8).

## 10. Decisions made since Phase 1

The three open questions originally listed here have been resolved in the shipped build:

1. **AI providers**: all four (OpenAI, Anthropic, Gemini, Mistral) are implemented behind
   the same `AIProvider` interface — switchable anytime in Settings.
2. **Popup vs. side panel**: side panel, as recommended — persistent, resizable, fits the
   chat-first UX.
3. **Visual identity**: a clean dark theme with Pinterest red as a single sparing accent
   was used; no existing brand assets were supplied.
