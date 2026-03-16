---
name: changelog-cleanup
description: >-
  Analyze and clean up the Upcoming Release section in CHANGELOG.md. Reviews
  each entry for grammar and logic issues, then sorts entries into categories.
  Use when the user mentions changelog cleanup, changelog sorting, release
  notes review, or preparing a release.
---

# Changelog Cleanup

Cleans up the `## Upcoming Release` section of `CHANGELOG.md` in two phases:
grammar/logic review, then sorting by category.

## Phase 1: Grammar and Logic Review

1. Read `CHANGELOG.md` and extract all entries under `## Upcoming Release`
   (stop at the next `## ` heading).
2. For each entry, check for:
   - Spelling and grammar mistakes
   - Unclear or ambiguous phrasing
   - Logical issues (e.g., an entry starting with "Fixed" that actually
     describes a new feature, or contradictory statements)
3. When an issue is found, use the `AskQuestion` tool to present the proposed
   fix to the user. Provide two options: "Accept" and "Reject".
   Batch related fixes into a single `AskQuestion` call when possible to
   reduce round-trips, but keep each fix clearly labeled.
4. Apply only accepted fixes. Do not modify entries the user rejects.

## Phase 2: Sort Entries

After grammar/logic fixes are applied, sort entries into four groups.
Keep this exact order (no blank lines between groups):

### Group 1 — New features and additions

Entries that semantically describe something new (e.g. `Added`), regardless of
the leading verb.

### Group 2 — Improvements and changes

Entries that describe enhancing, changing, or updating existing behavior
(e.g. `Improved`, `Changed`, `Updated`), regardless of the leading verb.

### Group 3 — Bug fixes

Entries that semantically describe fixing incorrect behavior (e.g. `Fixed`),
regardless of the leading verb.

### Group 4 — Other changes

Everything else: dependency bumps, refactors, removals, tooling.

### Sorting rules

- Use the first word after `- ` as a signal, but override when the meaning
  clearly fits a different group.
- Multi-line entries (parent + indented sub-bullets) stay as one unit.
- Preserve original relative order within each group.
- No blank lines between groups.

## Example

```markdown
- Added support for OAuth tokens
- Added new `timeout` option
- Improved error details when OAuth fails
- Changed default `jsonColumnVariantParser` to `JSON.parse`
- Fixed a crash when loading config
- Fixed typo in error message
- Bumped axios to 1.14.0
```
