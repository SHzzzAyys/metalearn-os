# Security Policy

MetaLearn OS is an early beta local-first learning app. Please report security and privacy issues responsibly.

## Supported Versions

Only the latest `main` branch and latest beta release are currently supported.

## Reporting a Vulnerability

If you find a vulnerability, please open a private security advisory on GitHub when available, or contact the maintainer through the repository's GitHub profile.

Please include:

- affected version or commit;
- steps to reproduce;
- expected impact;
- whether user learning data, exports, AI request previews, or provider configuration are affected;
- any suggested fix.

## Sensitive Areas

High-priority areas:

- accidental upload of user materials before preview confirmation;
- exposed provider credentials;
- export package leaks;
- failure to clear local data;
- schema migration data loss;
- XSS or script injection through imported material text;
- unsafe custom endpoint handling.

## Current Constraints

- No authentication system is implemented.
- No cloud sync is implemented.
- Default AI mode is local mock.
- Live provider integration is not considered complete until it preserves preview, confirmation, and schema validation.
