# Contributing to MetaLearn OS

Thanks for considering a contribution. The project is early beta, so the most useful work is focused, testable, and aligned with the product constraints.

## Product Boundaries

Please preserve these boundaries:

- Do not add claims that the app improves intelligence or guarantees learning outcomes.
- Do not upload user materials without an explicit preview and confirmation step.
- Do not treat AI output as a fact judge.
- Do not auto-approve generated cards.
- Keep learning data local-first unless a future encrypted sync feature is explicitly designed.
- Keep planning, check-ins, and reflection lightweight.

## Useful Contributions

Good areas for issues or pull requests:

- accessibility improvements;
- mobile layout fixes;
- IndexedDB migration tests;
- import and export edge cases;
- calibration metric visualization;
- review queue and scheduling improvements;
- fallback flows when AI generation fails;
- documentation and onboarding improvements.

## Local Checks

Before opening a pull request, run:

```bash
npm run verify
```

For workflow changes, also run:

```bash
npm run test:e2e
```

## Pull Request Style

Keep PRs small enough to review. Include:

- what changed;
- why it changed;
- user impact;
- privacy or AI-boundary implications if relevant;
- validation commands.
