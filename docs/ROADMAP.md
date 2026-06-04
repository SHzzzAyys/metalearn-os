# Roadmap

MetaLearn OS is in early beta. The roadmap prioritizes durable learning loops, privacy-preserving data control, and open-source maintainability over feature volume.

## Product Direction

The project should become a reliable local-first study system for:

- importing real learning materials;
- creating source-grounded retrieval cards;
- predicting confidence before feedback;
- repairing high-confidence errors;
- revising Feynman explanations through questions and gap tags;
- keeping planning and reflection lightweight;
- exporting and restoring local data.

The project should not become a generic AI note summarizer, a brain-training game, or a product that promises guaranteed learning outcomes.

## v0.1.0-beta

Status: released baseline.

Included:

- unified `apps/metalearn-os` product shell;
- local IndexedDB schema v3;
- text and Markdown paste or file import, plus selectable text-layer PDF file extraction;
- chunking and source-grounded candidate card generation;
- AI request preview before generation;
- deterministic local mock AI provider;
- candidate review and approval;
- confidence-first review flow;
- high-confidence error surface;
- Feynman explanation attempts, questions, rubric scores, gap tags, and card handoff;
- learning sessions, check-ins, reflections, and insight snapshots;
- JSON export package, CSV export, and Anki TSV export;
- desktop and mobile E2E coverage;
- CI for typecheck, unit tests, lint, and production build.

## v0.2.0 - Materials and Durable Card Creation

Status: implemented.

Goal: make the material-to-review-card loop reliable without depending on AI.

Planned work:

- add material detail pages at `/library/[sourceId]`;
- show source metadata, chunks, candidates, approved cards, explanations, and review performance on the material detail page;
- add manual card creation from a source chunk;
- improve chunk metadata with heading path, character count, and quality flags;
- add candidate filtering by material, chunk, card type, difficulty, and tag;
- add batch reject and stronger candidate editing;
- add import failure and empty-state handling;
- expand tests for source tracing and candidate approval rules.

Acceptance criteria:

- a user can create review cards without AI;
- every approved card can be traced to a source chunk or explanation version;
- AI failure does not block card creation;
- material detail pages expose the full evidence chain.

## v0.3.0 - Review Quality and High-Confidence Error Repair

Status: implemented baseline.

Goal: turn review into a strict calibration evidence system.

Planned work:

- formalize the review state machine;
- add tests that prevent skipping confidence prediction or answer entry;
- enrich review logs with timestamps, answer length, latency, hint/source visibility, and evidence strength;
- add a high-confidence error workspace at `/review/mistakes`;
- group mistakes by material, tag, and mistake reason;
- let users jump from a mistake to source evidence, Feynman repair, or remedial card creation;
- add review modes for due cards, high-confidence errors, material-specific review, and tag-specific review;
- improve mobile review ergonomics.

Acceptance criteria:

- source reveal cannot happen before the user commits an answer without being recorded as weak evidence;
- high-confidence errors become actionable repair tasks;
- tag-level overconfidence is backed by review logs, not guessed.

## v0.4.0 - Explanation Versions and Insight Quality

Goal: make Feynman explanations and insights evidence-driven.

Planned work:

- show explanation version chains and v1/v2 differences;
- expose rubric trend and gap tag changes;
- strengthen concept nodes and confirmed concept edges;
- generate remedial candidates from explanation gap tags;
- improve Brier trend, reliability curve, tag overconfidence, and gap distribution charts;
- add explicit "not enough evidence" thresholds to each insight;
- add action links from insights into review, mistakes, explanation repair, or material detail pages.

Acceptance criteria:

- AI questions do not include standard answers;
- explanation improvement can be traced through versions and rubric changes;
- insights do not imply certainty when the underlying evidence is thin.

## v0.5.0 - Data Portability and Provider Boundary

Status: partially implemented for JSON restore.

Goal: make local-first data resilient and make real provider integration safe.

Planned work:

- add JSON import/restore from export packages;
- validate schema version and show import summary before import;
- support safe append modes without overwrite;
- add data integrity checks for dangling cards, chunks, sources, reviews, explanation links, and concept edges;
- add optional server-side provider proxy configuration;
- keep upload preview mandatory for every provider mode;
- document what each AI operation sends.

Acceptance criteria:

- export -> clear -> import restores the learning workspace;
- failed import does not corrupt existing local data;
- real provider mode cannot bypass preview, schema validation, or candidate review.

## Later Work

Deferred until the local-first core is stable:

- encrypted cloud sync;
- native mobile app;
- scanned-PDF OCR;
- voice explanation;
- full concept graph editor;
- account system;
- subscription or payment;
- collaboration;
- hosted demo with seeded sample data.

## Release Rules

- Keep release notes conservative and evidence-based.
- Do not claim adoption, impact, or learning gains without data.
- Run `npm run verify`, `npm run test:e2e`, and `npm audit --audit-level=moderate` before tagging.
- Preserve the AI and privacy boundary in every feature.
