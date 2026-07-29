# PinAds Studio AI

A conversational, AI-powered Chrome Extension (Manifest V3) dedicated exclusively to
Pinterest advertising. You describe campaigns in natural language; an AI agent plans,
generates, and organizes Pinterest ad campaigns, and can actually launch them — either
through the official Pinterest Ads API or by driving a real Pinterest Ads Manager tab
itself. This is a standalone project — no code, storage, or manifest is shared with any
other extension.

## Status: working build

This is a real, buildable Chrome extension, not a mockup. `npm run build` produces a
loadable `dist/` you can install via `chrome://extensions` → Load unpacked.

## What's implemented

**Conversational campaign planning**
- Persistent chat with a Pinterest Ads–specialist system prompt, tool-calling loop, and
  three Marketing Modes (Beginner / Professional / Autopilot)
- Four AI providers behind one interface — OpenAI, Anthropic, Gemini, Mistral — switch
  any time in Settings with just an API key
- Website analysis (fetches a URL, summarizes it via AI) to seed campaign strategy

**Campaign management**
- Create, duplicate, pause/resume campaigns; update budget, audience, and objective —
  from chat or directly in the workspace UI
- Per-campaign workspace: Summary, Audience, Budget, Creative, Pins, History tabs
- **Audience, Budget, and Max CPC bid are directly editable** in the workspace (not
  chat-only) — the "easy adjustments" path
- AI Score with a breakdown (audience fit / creative strength / budget health) and
  concrete improvement suggestions
- Creative Studio: AI-generated headlines, descriptions, and CTAs, regenerable by tone
  (emotional, premium, seasonal, etc.)

**Actually launching campaigns — two real paths, no simulation**
1. **Pinterest Ads API (v5)** — OAuth 2.0 connect flow, ad account + board selection,
   then a genuine `Campaign` → `Pin` → `Ad group` → `Ad` creation sequence via
   `api.pinterest.com`. Requires your own Pinterest Developer app (Client ID/Secret).
2. **Browser automation** — no developer app needed. A content script reads whatever is
   actually on screen in a real `ads.pinterest.com` tab (no hardcoded selectors) and the
   AI decides the next click/type, following a step-by-step playbook transcribed from an
   actual recorded campaign-creation session (objective → budget → targeting →
   Select Pins → Publish). Every action is a real DOM interaction; "done" is only
   reported on genuine on-page confirmation, and the full transcript is shown live.

## Setup

1. `npm install && npm run build`, then load `dist/` as an unpacked extension
2. Open the side panel → **Settings**:
   - Pick an AI provider and add its API key
   - *(Optional, for API publishing)* Register a Pinterest Developer app, add its
     redirect URI (shown in Settings), then paste Client ID/Secret and connect
3. In **Chat**, describe a campaign; in the campaign **Workspace**, adjust budget/
   audience/CPC and set a Pin image/title, then publish via either path in the
   **Summary** tab

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the module map, data models,
state management, and design rationale.

## Stack

React · TypeScript · Chrome Manifest V3 (Vite + CRXJS) · IndexedDB · Tailwind CSS ·
Zustand · React Query · Framer Motion

## Known limitations

- No image generation — you supply a Pin image URL (API path) or rely on an existing
  Pinterest Pin (browser-automation path)
- Browser automation is best-effort against Pinterest's real UI; if it stalls on an
  unfamiliar screen, describe (or record) that step and the playbook can be tuned
- No automated test suite yet
