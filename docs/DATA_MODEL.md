# Data Model

MetaLearn OS stores user learning data locally in IndexedDB. The current schema version is `v3`.

## Core Tables

Materials:

- `sourceDocuments`: imported materials and metadata.
- `sourceChunks`: chunked material text.
- `importJobs`: import status, input type, and chunk count.

Cards and review:

- `cardCandidates`: AI-generated or explanation-generated candidate cards.
- `cards`: approved cards in the review queue.
- `reviewLogs`: confidence prediction, answer, outcome, mistake reason, and evidence strength.

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
- sessions;
- check-ins;
- reflections;
- explanations;
- concept nodes;
- concept edges;
- insights;
- AI request previews.

Future import/restore must validate package shape before mutating local data.

## Migration Rules

For future schema versions:

- migrations must be additive where possible;
- old exports should remain readable or clearly rejected with an actionable message;
- dangling references should be detected by integrity checks;
- migration tests must cover representative v3 data.
