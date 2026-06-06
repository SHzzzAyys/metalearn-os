# Implementation Notes

## Scope

This beta implements the accepted plan as one primary product, `MetaLearn OS`, with the older three PWA apps retained as legacy module references. New product capabilities should be added to `apps/metalearn-os` first.

It deliberately excludes account sync, payments, collaboration, native mobile, scanned-PDF OCR, full concept graphs, and speech input.

## AI Proxy Behavior

The route handlers expose server-side AI boundaries, but the initial provider is deterministic and schema-checked. This keeps local development private and testable.

Every generation workflow must preserve the same guardrails:

- build an upload preview first;
- show provider mode, chunk count, and payload summary;
- wait for user confirmation;
- validate structured output;
- save AI output as candidate or draft state only.

A live provider can replace the fallback inside `packages/ai` without changing app workflows.

## Evidence Rules

Generated cards must include source evidence. The UI only lets candidates become review cards after user approval. The Feynman app asks questions and scores the user's explanation, but does not provide a canonical answer.

Review source tracing resolves `Card.sourceChunkId -> SourceChunk.sourceId -> SourceDocument`. Do not treat a chunk id as a source id.

## Storage

IndexedDB is currently on schema `v5`. New migrations should include focused unit tests and should keep export compatibility explicit through the package manifest. Schema `v3` and `v4` JSON imports remain supported by treating missing newer tables such as `repairTasks` and `savedStudyViews` as empty arrays.
