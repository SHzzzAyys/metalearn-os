# Privacy Model

MetaLearn OS is designed as a local-first learning tool. Learning materials, self-assessments, mistakes, explanations, and reflections can be sensitive, so the default product should keep them under user control.

## Current Behavior

- Data is stored in the browser's IndexedDB.
- No account is required.
- No cloud sync is implemented.
- No payment or analytics provider is integrated.
- Export is user-triggered.
- JSON import/restore is user-triggered and parsed locally in the browser.
- Local deletion clears the IndexedDB tables.
- AI generation uses a local mock provider by default.

## Upload Boundary

User materials must not be sent to an external model before the user confirms an AI request preview.

Every AI request preview should show:

- provider mode;
- provider name;
- model name;
- chunk count;
- payload summary;
- source id when relevant.

Confirmation must happen before generation.

## Export and Delete

The export package is a local download. It may include user materials, review logs, repair tasks, explanations, reflections, and AI request records. Users should treat it as sensitive data.

Deletion should clear all local tables and should not leave a preserved deletion event in the cleared database.

## JSON Import and Restore

JSON restore files are read by the browser from the selected local file. The app parses and validates the package in memory before writing to IndexedDB. The selected JSON file is not uploaded to a server by the restore flow.

Before import confirmation, the preview should show:

- package kind;
- schema version;
- exported timestamp;
- payload counts;
- conflicts with existing local ids;
- repairable reference issues;
- fatal problems that block import.

If a package contains restored `aiRequestPreviews`, they are treated as local audit records only. Restoring them must not trigger a new AI request.

The default conflict strategy keeps both local and imported data. The app should not overwrite local learning records during restore.

## Future Provider Integrations

If real providers are added:

- client-side API keys should not be required for normal operation;
- server-side proxy calls must preserve preview and schema validation;
- provider configuration should explain what is sent;
- local mock mode must remain available;
- failures should not block manual learning workflows.

## Public Claims

Do not claim:

- guaranteed learning gains;
- improved intelligence;
- medical, psychological, or educational diagnosis;
- factual mastery based only on AI judgment.

Allowed claims:

- supports retrieval practice;
- helps track confidence calibration;
- surfaces high-confidence errors;
- helps organize explanation gaps;
- keeps MVP data local-first.
