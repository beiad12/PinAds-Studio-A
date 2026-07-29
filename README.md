# PinAds Studio AI

A conversational, AI-powered Chrome Extension (Manifest V3) dedicated exclusively to
Pinterest advertising. Users describe campaigns in natural language; an AI Agent plans,
generates, and organizes Pinterest ad campaigns for review before anything is ever
published. This is a standalone project — no code, storage, or manifest is shared with
any other extension.

## Status

**Phase 1 — Architecture (this commit).** Design only: module map, data models, AI
provider abstraction, campaign schema, folder scaffolding. No UI, storage engine, or AI
integration is implemented yet.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design, including:

- Module responsibilities and dependency rules
- Marketing Modes (Beginner / Professional / Autopilot)
- AI provider abstraction (OpenAI, Anthropic, Gemini, Mistral)
- State management (Zustand + React Query + IndexedDB)
- Component hierarchy
- Folder structure
- Open questions pending approval before Phase 2

## Planned stack

React · TypeScript · Chrome Manifest V3 · Vite · IndexedDB · Tailwind CSS · Zustand ·
React Query · Framer Motion

## Phases

1. Architecture (this commit) — **awaiting approval**
2. UI framework
3. AI chat engine
4. Campaign management
5. Creative generation
6. Integrations
7. Testing
8. Optimization
