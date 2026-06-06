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

## v0.3.1 - Material Import and Candidate Generation Reliability

Status: implemented patch.

Goal: make the material import and candidate-generation path visible, diagnosable, and recoverable.

Included:

- explicit material import stages from file reading through candidate generation;
- local text-quality analysis for short materials, likely scanned PDFs, whitespace-heavy extraction, and garbled text;
- separate material-file import and JSON restore inputs;
- `保存并生成候选题` as the primary path from source save to upload preview;
- AI request previews that show source title, chunk count, and chunk summaries;
- candidate generation from a locked chunk snapshot instead of relying on asynchronous UI state refresh;
- diagnostic messages for unsaved files, missing chunks, pending preview confirmation, failed generation, and existing candidates;
- candidate review bench counts for all pending candidates, current material candidates, and recently generated candidates;
- manual-card fallback when AI generation fails.

Acceptance criteria:

- choosing a file is never treated as saving a material;
- PDF/TXT/Markdown files can enter the main flow through file selection;
- PDFs without enough readable text show an OCR limitation instead of silently failing;
- generation success always leads to visible candidate review work;
- generation failure preserves the material and exposes manual card creation;
- no account, cloud sync, OCR, auto-approval, or AI answer grading is introduced.

## v0.3.2 - Product Polish and Workflow Speed

Status: implemented patch.

Goal: make the unified app feel more like a mature learning workspace without weakening the source-evidence and local-first boundaries.

Included:

- home study mode launcher that asks the user what kind of learning action they want to take now;
- global `Ctrl/Cmd+K` command palette for navigation and high-frequency actions;
- command entries for material import, due review, high-confidence mistake repair, Feynman explanation, learning compass, insights, export, settings, and manual card creation;
- mobile-safe command dialog with keyboard dismissal and no horizontal overflow;
- E2E coverage for command palette navigation.

Design principles:

- use command and mode shortcuts to reduce friction, not to hide review gates;
- keep source-grounded workflows visible;
- do not introduce cloud accounts, public sharing, social features, or unsupported learning claims as polish.

## v0.3.3 - Material Reader Workbench

Status: implemented patch.

Goal: make each material page behave like a source-centered learning workspace instead of a passive chunk list.

Included:

- material reader workbench on `/library/[sourceId]`;
- chunk search and focused chunk reading area;
- evidence coverage map showing whether each chunk is uncovered, candidate-backed, card-backed, or reviewed;
- per-chunk counts for candidates, approved cards, and review evidence;
- quick actions from focused source evidence into manual card creation and Feynman explanation;
- local-only handoff to Feynman explanation through browser session state, without uploading material;
- E2E coverage for source reader visibility and source-to-Feynman handoff.

Design principles:

- prioritize source context over disconnected flashcards;
- make weak/uncovered source areas visible so users know where to act next;
- keep every AI-adjacent action reviewable and reversible.

## v0.3.4 - Active Reading Track

Status: implemented patch.

Goal: make material reading behave like a guided active-learning workflow, not a passive document viewer.

Included:

- deterministic active reading track on `/library/[sourceId]`;
- source chunk prioritization by evidence state: uncovered, candidate-only, carded-not-reviewed, reviewed;
- next-step recommendation for the highest-priority chunk;
- per-chunk recall prompts that ask the learner to explain, question, and identify boundaries before relying on AI;
- quick actions from the recommended chunk into manual card creation, Feynman explanation, candidate review, calibration review, or review evidence;
- previous/next chunk navigation in the focused reader;
- unit coverage for reading-track priority and prompt derivation;
- E2E coverage for reader visibility and source-to-explanation flow.

Design principles:

- treat reading as preparation for retrieval, explanation, and correction;
- do not mark a chunk as learned merely because it was viewed;
- keep the reading track derived from local evidence instead of adding hidden progress state;
- use AI-product references only for interaction inspiration, not for unsupported learning claims.

## v0.4.0 - Explanation Versions and Insight Quality

Status: partially implemented.

Goal: make Feynman explanations and insights evidence-driven.

Implemented:

- explanation version evidence cards on `/explain`;
- rubric average and per-dimension improvement/decline between explanation versions;
- resolved and newly introduced gap tags across versions;
- text-change signals for newly added mechanism, example, boundary, contrast, or counterexample language;
- deterministic insight action cards on `/insights` that link back to review, mistake repair, candidate approval, explanation revision, or active material reading;
- calibration evidence thresholds that label insufficient review data before showing trend or reliability conclusions;
- Brier trend by review date and confidence reliability buckets on `/insights`;
- scoped material, tag, and concept insight drilldowns with evidence status and action links;
- scoped query handling for high-confidence repair filters and Feynman concept prefill;
- unit coverage for explanation threads, insight action priority, calibration trend, reliability bucket status, evidence thresholds, and scoped insight derivation.

Planned work:

- strengthen concept nodes and confirmed concept edges;
- generate remedial candidates from explanation gap tags;
- improve tag overconfidence and gap distribution charts;
- deepen scoped filters on review, library, and explanation workspaces beyond the current high-confidence repair and concept prefill paths.

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
