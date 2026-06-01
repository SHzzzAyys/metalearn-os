# Data Model

MetaLearn OS stores user learning data locally in IndexedDB. The current schema version is `v4`.

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
- `learningEvents`: shared event log across modules.

## Source Traceability

Approved cards must be traceable.

```text
Card.sourceChunkId -> SourceChunk.id
SourceChunk.sourceId -> SourceDocument.id
```

Cards generated from explanations use a source id shaped around the explanation version and must still remain visible to the user as explanation-derived evidence.

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
- sessions;
- check-ins;
- reflections;
- explanations;
- concept nodes;
- concept edges;
- insights;
- AI request previews.

## Import and Restore

The current restore format is the same schema `v4` JSON package produced by the app. The importer also accepts schema `v3` packages and treats missing `repairTasks` as an empty array. The importer recognizes:

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

- `schemaVersion` must equal `3` or `4`;
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

## Migration Rules

For future schema versions:

- migrations must be additive where possible;
- v3 exports should remain readable with `repairTasks` defaulting to an empty array;
- older unsupported exports should be clearly rejected with an actionable message;
- dangling references should be detected by integrity checks;
- migration tests must cover representative v3 data.
