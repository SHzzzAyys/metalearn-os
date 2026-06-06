# Testing

The project uses a layered validation strategy. The goal is not only to keep the app compiling, but to protect the learning and privacy contracts.

## Commands

Run the main verification gate:

```bash
npm run verify
```

This runs:

- TypeScript checks;
- Vitest unit tests;
- ESLint;
- production builds.

Run E2E tests:

```bash
npm run test:e2e
```

Run dependency audit:

```bash
npm audit --audit-level=moderate
```

## Unit Test Priorities

High-value unit tests should cover:

- confidence mapping;
- Brier score;
- overconfidence index;
- high-confidence error rate;
- review evidence strength;
- review state machine legal and illegal transitions;
- high-confidence repair task creation and resolution;
- review queue ordering;
- source traceability through chunks;
- material text quality analysis for short text, scanned-PDF risk, whitespace-heavy text, and garbled extraction;
- candidate generation diagnostics for unsaved text, saved sources without chunks, pending previews, failed previews, and existing candidates;
- tag overconfidence;
- passive learning risk;
- prediction bias;
- explanation gap summaries;
- export manifest shape;
- import package parse and schema rejection;
- import preview warnings, repairable issues, and fatal problems;
- import conflict planning for `keep_both` and `skip_duplicates`;
- v3/v4 export and restore compatibility for repair tasks;
- AI output schemas.

## Integration Test Priorities

Important integration paths:

- import material -> chunk -> preview -> candidates;
- file selection -> text preview -> save and generate -> upload preview -> candidate review bench;
- material detail -> reader workbench -> focused chunk -> manual card or Feynman explanation handoff;
- failed AI candidate generation -> saved material remains available -> manual card creation;
- edit candidate -> approve -> review queue;
- high-confidence error -> mistake reason -> explanation repair;
- high-confidence error -> repair task -> source/Feynman/remedial card -> resolved;
- explanation version -> gap tags -> candidate handoff;
- session -> check-in -> reflection -> daily plan;
- export -> clear -> import restore -> review restored card;
- failed import -> no IndexedDB mutation.

## E2E Priorities

Desktop and mobile should cover:

- first material import;
- PDF/TXT/Markdown file selection and visible local text preview;
- unsaved selected file cannot be treated as an imported material;
- text-layer PDF succeeds and scanned/no-text PDF shows an OCR limitation;
- AI request preview;
- candidate generation and approval;
- AI failure shows a concrete error and manual-card fallback;
- review with confidence prediction;
- strict review state machine and keyboard shortcuts;
- home study mode launcher and global command palette navigation;
- material reader workbench, evidence coverage map, and source-to-Feynman handoff;
- high-confidence error repair task visibility;
- Feynman questions and explanation save;
- insight and privacy copy;
- JSON restore preview and import report;
- invalid JSON and fatal import problems;
- no unsupported learning claims.

## Visual and Accessibility Checks

Recommended visual targets:

- home desktop;
- library mobile;
- review desktop;
- review mistakes desktop;
- review mistakes mobile;
- explain desktop;
- insights desktop;
- settings mobile.
- library import preview, success report, and failure state.
- library material import stages, text-quality warnings, candidate-generation diagnostic, and candidate review highlight.

Recommended accessibility checks:

- keyboard navigation;
- focus visibility;
- form labels;
- color contrast;
- no horizontal overflow on mobile;
- no button text clipping;
- axe checks for core routes.

## Release Validation

Before a release tag:

```bash
npm run verify
npm run test:e2e
npm audit --audit-level=moderate
```

The release should not proceed if:

- CI is failing;
- dependency audit has unresolved moderate or higher issues;
- privacy scan finds credentials or local personal paths;
- public docs include unsupported outcome claims.
