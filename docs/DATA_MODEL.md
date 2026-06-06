# Data Model

MetaLearn OS stores user learning data locally in IndexedDB. The current schema version is `v5`.

## Core Tables

Materials:

- `sourceDocuments`: imported materials and metadata.
- `sourceChunks`: chunked material text.
- `importJobs`: import status, input type, and chunk count.

Cards and review:

- `cardCandidates`: AI-generated or explanation-generated candidate cards.
- `cards`: approved cards in the review queue.
- `reviewLogs`: confidence prediction, answer, outcome, mistake reason, and evidence strength.
- `repairTasks`: high-confidence wrong or partial reviews that need source review, explanation, or remedial card creation.

Planning:

- `learningSessions`: planned and completed learning sessions.
- `checkIns`: optional low-frequency focus checks.
- `reflections`: post-session reflections.

Explanation:

- `explanationAttempts`: Feynman explanation versions, questions, rubric scores, and gap tags.
- `conceptNodes`: material, tag, card, explanation, or manual concepts.
- `conceptEdges`: user-confirmed relationships between concepts.

Insight and AI boundary:

- `insightSnapshots`: saved metrics and recommendations.
- `aiProviderConfigs`: local provider configuration.
- `aiRequestPreviews`: preview, confirmation, completion, and failure records for AI requests.
- `savedStudyViews`: user-pinned learning scopes for the home launcher.
- `learningEvents`: shared event log across modules.

Derived insight evidence:

- `calibrationTrend`: date-level Brier score, review count, high-confidence error rate, accuracy, and average confidence.
- `reviewSessionSummary`: today's review count, target progress, due remaining, answer distribution, Brier score, accuracy, high-confidence errors, average duration, and evidence-strength counts. It is derived from `reviewLogs` and current due cards; it is not stored as a separate table.
- `reliabilityEvidence`: five confidence buckets with expected correctness, actual correctness, sample count, gap, and `empty | thin | enough` status.
- `insightEvidenceThresholds`: local evidence gates for trend and reliability readability. These are derived from review logs and are not stored in IndexedDB.
- `scopedInsights`: derived material, tag, and concept groups. Each item carries an evidence status, a metric label, detail chips, and an action link back to the relevant workspace.
- `studyViews`: derived home entries that turn repair tasks, due cards, pending candidates, and scoped insights into one-click learning views.
- `savedStudyViews`: persisted copies of user-pinned study views. They store a title, detail, href, scope kind, optional scope value, metric label, priority, `updatedAt`, and optional `lastOpenedAt`. They do not store duplicated material text or card content.
- Saved study view management is local metadata only: editing a pinned title, detail, or priority does not change cards, chunks, reviews, or repair tasks. Opening a pinned view updates `lastOpenedAt` and writes a `study_view_opened` event so the home launcher can keep useful views near the top without inventing learning evidence.
- Thin evidence must be shown as thin evidence. The UI must not present empty or one-sample metrics as stable learning conclusions.

Scoped insights are local selectors, not persisted analytics records:

- material scope resolves `Card.sourceChunkId -> SourceChunk.sourceId -> SourceDocument.id`;
- tag scope resolves card tags, pending candidate tags, and repair task tag snapshots;
- concept scope resolves Feynman explanation threads and linked card IDs;
- action links may include query parameters such as `tag`, `sourceId`, or `concept`, but they do not upload data or invoke AI.
- `/library?tag=...` filters the asset search and candidate review bench.
- `/review?tag=...` and `/review?sourceId=...` scope both the visible queue and the active review card, so review logs are written for the card the user is actually seeing.
- `/review/mistakes?tag=...` and `/review/mistakes?sourceId=...` filter repair tasks.

## Source Traceability

Approved cards must be traceable.

```text
Card.sourceChunkId -> SourceChunk.id
SourceChunk.sourceId -> SourceDocument.id
```

Cards generated from explanations use a source id shaped around the explanation version and must still remain visible to the user as explanation-derived evidence.

## Explanation Version Evidence

Explanation version evidence is derived runtime state, not a new table.

It groups `ExplanationAttempt` records by `concept`, sorts them by `versionIndex` and `createdAt`, then compares each version with the previous version.

Derived fields include:

- rubric average score;
- score delta from the previous version;
- rubric dimensions that improved or declined;
- gap tags resolved since the previous version;
- gap tags newly introduced in the current version;
- text length delta;
- newly added explanation signals such as mechanism, example, boundary, contrast, or counterexample language.

Important boundary: a better explanation version is evidence that the learner revised the explanation. It does not prove mastery by itself. Mastery still needs retrieval, feedback, and later review evidence.

## Insight Actions

Insight action cards are derived runtime state from current local evidence. They are not persisted.

Priority order:

1. unresolved high-confidence repair tasks;
2. due calibration reviews;
3. pending candidate approval;
4. weak explanation thread revision;
5. active material reading;
6. first material import when evidence is insufficient.

Insight actions are navigation aids only. They must not overwrite data, auto-approve cards, or claim that a task is mastered.

## Active Reading Track

The active reading track is derived runtime state, not an IndexedDB table.

It reads:

- `SourceChunk`;
- `CardCandidate`;
- `Card`;
- `ReviewLog`.

Each chunk is classified as:

- `uncovered`: no candidate, approved card, or review evidence;
- `candidate`: at least one pending candidate, but no approved card;
- `carded`: at least one approved card, but no review log;
- `reviewed`: at least one review log through an approved card.

The next reading action is chosen in this order:

1. uncovered chunks should be explained or turned into source-grounded candidate cards;
2. candidate-only chunks should go to human candidate review;
3. carded chunks should go to calibration review;
4. reviewed chunks should show evidence rather than invent more work.

Important boundary: viewing or focusing a chunk is not stored as learning evidence and does not imply mastery. Only candidate creation, card approval, explanation attempts, review logs, and repair tasks count as durable learning evidence.

## Material Import Runtime State

Material file reading and candidate-generation diagnosis are client runtime state, not IndexedDB schema. This keeps the import flow observable without turning every transient UI step into durable learning evidence.

The runtime draft tracks:

- current import stage;
- file name and file kind;
- title and input type;
- extracted text length;
- PDF page count when available;
- saved source id;
- chunk count;
- AI preview id;
- recently generated candidate ids;
- blocking error when a step fails.

The derived diagnostic reads the runtime draft plus local `SourceDocument`, `SourceChunk`, `AIRequestPreview`, and `CardCandidate` records. It should explain whether the next action is to read a file, save a source, create a preview, confirm a preview, review candidates, or create cards manually.

Important boundary: selecting a file does not create `SourceDocument` or `SourceChunk` records. Those records exist only after the user saves the material.

## Candidate Approval Rules

A candidate must not become an approved card unless it has:

- a non-empty `question`;
- a non-empty `expectedAnswer`;
- a non-empty `sourceQuote`;
- a non-empty `sourceChunkId`;
- at least one tag;
- a valid card type;
- a valid difficulty.

AI-generated candidates are never auto-approved.

## Review Evidence

Review logs distinguish strong retrieval from weak evidence.

Signals include:

- confidence prediction;
- active answer text;
- outcome;
- mistake reason;
- source visibility before answer;
- self-rated effort;
- duration;
- derived evidence strength.

If the source was visible before answer, the review should be treated as weak extraction evidence even when the user marks the answer correct.

## Repair Tasks

High-confidence repair tasks are created when a review has confidence `4` or `5` and the user marks the outcome as `again` or `partial`.

Repair tasks:

- point to the review log, card, source, and source chunk;
- keep a snapshot of the card tags and mistake reason;
- can be `open`, `in_progress`, `resolved`, or `dismissed`;
- may link to one Feynman explanation and remedial candidate cards;
- do not mean the system has judged mastery. Closing a task only records that a repair action was completed or dismissed.

## Export Package

Export packages should include:

- `schemaVersion`;
- `exportedAt`;
- manifest counts;
- materials;
- chunks;
- import jobs;
- candidates;
- cards;
- reviews;
- repair tasks;
- saved study views;
- sessions;
- check-ins;
- reflections;
- explanations;
- concept nodes;
- concept edges;
- insights;
- AI request previews.

## Import and Restore

The current restore format is the same schema `v5` JSON package produced by the app. The importer also accepts schema `v3` and `v4` packages and treats missing newer tables such as `repairTasks` or `savedStudyViews` as empty arrays. The importer recognizes:

- `full_backup`: a full local workspace export;
- `material_package`: one material plus its related chunks, candidates, cards, reviews, explanations, sessions, insights, and audit records;
- `unknown`: a malformed or unsupported package shape.

Import is intentionally staged:

1. Parse JSON text.
2. Validate schema and payload shape.
3. Create a preview with counts, conflicts, warnings, repairable issues, and fatal problems.
4. Ask the user to confirm a conflict strategy.
5. Write all inserts in one IndexedDB transaction.

The importer must not mutate IndexedDB during parse, validation, or preview. A failed transaction must not leave partial imported data.

## Import Integrity Rules

Import validation checks:

- `schemaVersion` must equal `3`, `4`, or `5`;
- manifest counts should match payload counts, otherwise a warning is shown;
- `SourceChunk.sourceId` must resolve to a material;
- `CardCandidate.sourceChunkId` must resolve to a chunk;
- `Card.sourceChunkId` must resolve to a chunk;
- `ReviewLog.cardId` must resolve to a card;
- `ReviewLog.sourceId` must resolve to a material, or be repairable through `cardId -> card.sourceChunkId -> chunk.sourceId`;
- `RepairTask.reviewLogId`, `cardId`, `sourceId`, and `sourceChunkId` must resolve to imported records;
- candidate and card `sourceQuote` must be present and match the referenced chunk text;
- source-grounded cards without valid evidence are rejected.

Fatal problems disable import confirmation. Repairable problems are shown in the preview and fixed in the import plan before write.

## Import Conflict Strategies

Two conflict strategies are supported:

- `keep_both`: default. Existing local data is preserved. Conflicting imported ids are remapped, references are rewritten, and imported material titles are marked as imported copies.
- `skip_duplicates`: conflicting objects and their dependent objects are skipped. This is useful when importing the same package repeatedly.

The importer does not support overwrite. This is deliberate: local learning records are user-owned evidence, so restoring a backup must not silently replace current work.

Saved study views follow the same conflict rules. In `keep_both`, material-scoped saved views have their `scopeValue` and href rewritten when a material id is remapped. In `skip_duplicates`, saved views are skipped when their id already exists or their material dependency was skipped.

## Migration Rules

For future schema versions:

- migrations must be additive where possible;
- v3 exports should remain readable with `repairTasks` and `savedStudyViews` defaulting to empty arrays;
- v4 exports should remain readable with `savedStudyViews` defaulting to an empty array;
- older unsupported exports should be clearly rejected with an actionable message;
- dangling references should be detected by integrity checks;
- migration tests must cover representative v3 data.
