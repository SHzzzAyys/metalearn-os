# AI Boundary

AI in MetaLearn OS is intentionally limited. It is a helper for generating reviewable candidates and questions, not a substitute for learning or a source of automatic truth.

## Provider Modes

Current provider mode:

- `local_mock`: deterministic local behavior used for development, tests, and privacy-preserving demos.

Reserved provider modes:

- `server_env`: server-side provider configuration.
- `custom_endpoint`: user-configured endpoint routed through the server boundary.

## Required Flow

Every AI operation must follow this shape:

```text
build preview -> user confirms -> call provider/route -> validate schema
-> save candidate/draft result -> user reviews
```

Do not call a provider directly from UI state without a preview.

## Allowed AI Outputs

Allowed:

- candidate retrieval cards;
- Socratic questions;
- rubric scores for explanation structure;
- weekly report drafts;
- mistake reason suggestions.

Not allowed:

- auto-approved cards;
- standard answers for Feynman questions;
- claims that the user has mastered a topic;
- hidden uploads;
- unsourced factual corrections;
- provider calls that bypass schema validation.

## Card Generation Contract

Candidate cards must include:

- `question`;
- `expectedAnswer`;
- `sourceQuote`;
- `cardType`;
- `difficulty`;
- `tags`;
- `sourceChunkId`.

Candidates without source evidence must not be approved.

## Socratic Contract

Socratic output must:

- contain exactly three questions;
- ask about mechanism, example, boundary, ambiguity, or contrast;
- avoid giving the answer;
- avoid acting as a fact judge;
- preserve the user's responsibility to revise the explanation.

## Failure Handling

If AI output fails schema validation or provider calls fail:

- show an error state;
- do not write invalid candidates;
- preserve the option to create cards manually;
- record preview failure status where available;
- keep local data intact.
