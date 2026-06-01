# Architecture

MetaLearn OS is a TypeScript monorepo centered on one active app, `apps/metalearn-os`, with three legacy apps retained as references.

## System Shape

```text
apps/
  metalearn-os/          Primary product
  calibrate-memory/      Legacy standalone retrieval app
  learning-compass/      Legacy standalone planning app
  feynman-workshop/      Legacy standalone explanation app
packages/
  core/                  Shared types, templates, product contracts
  ui/                    Reusable UI primitives and shell
  storage/               IndexedDB/Dexie persistence and export helpers
  ai/                    AI schemas, local mock behavior, prompt boundaries
  learning-science/      Metrics, queues, scheduling, insight calculations
tests/
  e2e/                   Playwright full-loop tests
```

New product capabilities should land in `apps/metalearn-os` first. The legacy apps should not receive new feature branches unless they are being used to preserve compatibility or extract reusable behavior.

## Client Architecture

The unified workspace is intentionally separated into:

- view components: render the workspace UI;
- action hook: owns local UI state and persistence actions;
- selectors: derive daily plan, insight data, queues, assets, and navigation badges.

This separation keeps business behavior testable and prevents the main client component from becoming the only place where product logic lives.

## Storage Architecture

The MVP is local-first. The browser stores learning data in IndexedDB through Dexie. The server exists only for API route boundaries and future provider proxy integration.

Current persistence categories:

- materials and chunks;
- candidates and approved cards;
- review logs;
- learning sessions, check-ins, and reflections;
- explanation attempts and concept graph items;
- insight snapshots;
- AI provider config and request previews;
- learning events.

## Data Flow

Primary material-to-review flow:

```text
SourceDocument -> SourceChunk -> AIRequestPreview -> CardCandidate
-> user approval -> Card -> ReviewLog -> InsightSnapshot
```

Primary Feynman flow:

```text
ExplanationAttempt v1 -> Socratic questions -> revised attempt
-> gap tags -> candidate remedial cards -> review queue
```

Primary planning flow:

```text
LearningSession -> optional CheckIn -> Reflection -> DailyPlan/InsightSnapshot
```

## AI Boundary

AI is behind schemas and product rules:

- generation requests are previewed before execution;
- local mock is the default provider;
- structured output is validated with Zod;
- AI output is candidate or draft state only;
- no AI result is automatically treated as correct.

## UI Architecture

`packages/ui` provides product-level primitives:

- shell and navigation;
- panels, cards, and badges;
- form fields and controls;
- evidence and review surfaces;
- empty, loading, and error states;
- progress indicators.

UI should remain dense and work-focused. Avoid marketing-page patterns, decorative gradients as a primary design device, or hidden evidence surfaces.

## Testing Architecture

The current baseline is:

- TypeScript across all workspaces;
- unit tests with Vitest;
- lint with ESLint;
- production builds with Next.js;
- Playwright desktop and mobile E2E tests.

Every feature that changes a learning loop should include at least one unit or integration test and should not break the unified E2E path.
