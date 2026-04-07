---
name: changelog-cleanup
description: >-
  Analyze and clean up the Upcoming Release section in CHANGELOG.md. Reviews
  each entry for grammar and logic issues, then sorts entries into named
  sections (New features, Changes, Bugfixes, Internal for non-customer-facing
  work, and Other as needed). Use when the user mentions changelog cleanup,
  changelog sorting, release notes review, or preparing a release.
---

# Changelog Cleanup

Cleans up the `## Upcoming Release` section of `CHANGELOG.md` in two phases:
grammar/logic review, then sorting into named sections.

## Changelog structure

Each release is a `## ` heading (e.g., `## Upcoming Release`, `## 2.3.6`).
Within a release, entries are organized under **named sections** — plain-text
labels followed by a colon, each followed by a blank line and then bullet
entries. For `## Upcoming Release`, use the section order defined in Phase 2
below. Older releases may use different section names (e.g., `Deprecations:`,
`Breaking changes:`, `Performance:`) or the legacy flat list.

Example structure:

```markdown
## 2.3.6

New features:

- Entry one

Changes:

- Entry two

Bugfixes:

- Entry three
- Entry four

Internal:

- Entry visible only in Snowflake-internal or non-customer contexts (see below)
```

Older releases (before 2.3.6) use a legacy flat list of bullets with no named
sections. That format is no longer valid for new releases.

## Phase 1: Grammar and Logic Review

1. Read `CHANGELOG.md` and extract all content under `## Upcoming Release`
   (stop at the next `## ` heading).
2. For each entry, check for:
   - Spelling and grammar mistakes
   - Unclear or ambiguous phrasing
   - Logical issues (e.g., an entry starting with "Fixed" that actually
     describes a new feature, or contradictory statements)
   - Entries placed under the wrong section (e.g., a bug fix listed under
     "New features:", or a customer-visible change under `Internal:`)
3. When an issue is found, use the `AskQuestion` tool to present the proposed
   fix to the user. Provide two options: "Accept" and "Reject".
   Batch related fixes into a single `AskQuestion` call when possible to
   reduce round-trips, but keep each fix clearly labeled.
4. Apply only accepted fixes. Do not modify entries the user rejects.

## Phase 2: Sort Entries into Sections

After grammar/logic fixes are applied, sort entries into named sections.
Use these sections in this exact order:

### Section 1 — `New features:`

Entries that semantically describe something new (e.g. `Added`), regardless of
the leading verb.

### Section 2 — `Changes:`

Entries that describe enhancing, changing, updating, removing, bumping
dependencies, refactoring, or modifying existing behavior
(e.g. `Improved`, `Changed`, `Updated`, `Removed`, `Bumped`, `Replaced`),
regardless of the leading verb.

### Section 3 — `Bugfixes:`

Entries that semantically describe fixing incorrect behavior (e.g. `Fixed`),
regardless of the leading verb.

### Section 4 — `Internal:`

Entries that **do not affect end customers** in any meaningful way: no change
to public API, connection options, query behavior, error handling, packaging, or
documented runtime for typical self-hosted or customer Snowflake workloads.

Use `Internal:` for Snowflake-internal execution contexts (e.g. driver behavior
only when running inside SPCS or similar), internal-only request fields or
telemetry that customers do not configure or observe, CI/release automation, or
repo hygiene with zero customer-visible impact.

**Do not** put here: dependency bumps that address CVEs or change shipped
binaries for customers, fixes to connection/auth/query bugs, or any feature a
customer could rely on outside Snowflake-managed environments.

Example (from this repo’s changelog):

```markdown
Internal:

- Included `spcs_token` when driver runs inside SPCS (org/repo#1372)
```

### Section 5 — Other (custom name)

If there are entries that don't fit the four sections above, use the
`AskQuestion` tool to ask the user what section name to use for them, or
whether to fold them into one of the existing sections.

### Sorting rules

- Use the first word after `- ` as a signal, but override when the meaning
  clearly fits a different section.
- Multi-line entries (parent + indented sub-bullets) stay as one unit.
- Preserve original relative order within each section.
- Omit sections that have no entries (don't output an empty section heading).
- Each section heading is followed by a blank line, then its bullet entries.
- Separate sections from each other with a blank line after the last bullet.

## Output format

The final output under `## Upcoming Release` must look like:

```markdown
## Upcoming Release

New features:

- Added support for OAuth tokens
- Added new `timeout` option

Changes:

- Improved error details when OAuth fails
- Changed default `jsonColumnVariantParser` to `JSON.parse`
- Bumped axios to 1.14.0

Bugfixes:

- Fixed a crash when loading config
- Fixed typo in error message

Internal:

- Included `spcs_token` when driver runs inside SPCS (org/repo#1372)
```
