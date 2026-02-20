# Implementation Plan

| Field | Value |
|-------|-------|
| Task | add the same change https://github.com/snowflakedb/snowflake-jdbc/pull/2510/changes to https://github.com/snowflakedb/snowflake-connector-nodejs repo on new branch, create draft PR and share PR link. ... |
| Date | 2026-02-20 |
| Agent | task-99b5abc3 |
| Repository | snowflakedb/snowflake-connector-nodejs |
| PRs | 1 |

## Overview

This task requires a single line change in one file (Jenkinsfile). The change updates the svn_revision parameter from 'bptp-stable' to 'temptest-deployed' to match the configuration applied in snowflake-jdbc PR #2510. With only 1 line modified across 1 file, this is well under the 400-600 line limit and represents an atomic, self-contained change that cannot be meaningfully split further.

## PR Stack

### PR 1: Change svn_revision to temptest-deployed for uSUT

**Description**: ## Overview

This PR applies the same configuration change from snowflake-jdbc PR #2510 to the nodejs connector.

## Changes

- Update `svn_revision` parameter in Jenkinsfile from 'bptp-stable' to 'temptest-deployed' to align with JDBC connector configuration for uSUT valid tag testing

## Related

- JDBC PR: https://github.com/snowflakedb/snowflake-jdbc/pull/2510
- SNOW-3071137

🤖 Generated with [Claude Code](https://claude.com/claude-code)

**Scope**:
Modify the Jenkinsfile at line 40:

1. Locate the 'Test' stage within the parallel block (around line 37-50)
2. Find the params array that contains the svn_revision parameter definition (line 40)
3. Change the value from 'bptp-stable' to 'temptest-deployed'
4. The exact line to modify is:
   FROM: string(name: 'svn_revision', value: 'bptp-stable'),
   TO:   string(name: 'svn_revision', value: 'temptest-deployed'),

This mirrors the exact change made in snowflake-jdbc PR #2510 which changed svn_revision from 'main' to 'temptest-deployed'.

**Rationale**: This is a single atomic configuration change that updates the test infrastructure parameter to match the JDBC connector. Cannot be split into smaller meaningful PRs.
