# SDK Response to CoCo Updated Proposal

## Overall Assessment

The proposal is solid and we're aligned. CoCo's answers to our questions are thorough and the migration plan is sensible. We're ready to proceed with implementation. A few items to flag before we do.

## One Contradiction to Fix in the Proposal

The Scope section (Section "Proposed Change" → "Scope", item 2) still says:

> `lib/configuration/connection_configuration.js` — Remove the `fixUserKey()` workaround (subsumed by normalization)

But Section 4 ("Integration Point") correctly says `fixUserKey()` stays, and the Cross-Team Agreement section also says it stays. **Please update the Scope section to match.** We don't want someone implementing from the Scope list and removing `fixUserKey()`.

## Precedence Nuance for CoCo's Migration

The planned CoCo migration code:

```typescript
const connectionOptions = {
  ...rawTomlConfig, // snake_case from TOML
  application: 'cortex_code_cli',
  client_store_temporary_credential: rawTomlConfig.client_store_temporary_credential ?? true,
  ...(isKeychainCredentialsEnabled() ? {} : { credentialCacheDir: cortexCacheDir }),
  queryTag,
};
```

This works, but be aware of the precedence model in `normalizeConnectionOptions`:

- The SDK iterates `Object.entries()` in insertion order
- For snake_case keys, it converts to camelCase and sets the value **only if that camelCase key hasn't been set yet**
- camelCase keys pass through directly

So if the spread object has both `client_store_temporary_credential: false` (from TOML) and a later `client_store_temporary_credential: true` (from CoCo's default), JS object spread means the later one wins in the raw object. Then `normalizeConnectionOptions` converts it to `clientStoreTemporaryCredential: true`. That's correct.

But if CoCo ever needs to override a value where the TOML also provides it, use camelCase for the override to guarantee it takes precedence:

```typescript
// Guaranteed to win over snake_case from TOML:
clientStoreTemporaryCredential: rawTomlConfig.client_store_temporary_credential ?? true,

// Also works (via JS object spread), but relies on insertion order:
client_store_temporary_credential: rawTomlConfig.client_store_temporary_credential ?? true,
```

Both work today, but the camelCase form is more explicit about intent. Up to CoCo — just wanted to flag it.

## Follow-Up PR Priorities — SDK Perspective

We agree with CoCo's priority list. From the SDK side, here's our thinking on each:

1. **Tilde expansion** — Agree this is straightforward. Narrow scope (`privateKeyPath`, `tokenFilePath`). Will model after Python's `expand_tilde()`. Good first follow-up.

2. **`config.toml` support** — Agree this is a real gap. More complex — needs to handle the nested `[connections.x]` format and merge with `connections.toml`. Will study the Python `ConfigManager`/`ConfigSlice` pattern. Separate design doc warranted.

3. **`SNOWFLAKE_TOKEN` env var** — Agreed it's a platform convention (CLI uses it, SPCS uses it). Need to decide: do we add just `SNOWFLAKE_TOKEN`, or adopt the Python-style `SNOWFLAKE_CONNECTIONS_<NAME>_<PARAM>` pattern? Leaning toward just `SNOWFLAKE_TOKEN` for pragmatism, with a broader env var system as a longer-term effort.

4. **`fixUserKey()` deprecation** — No urgency. If/when we do `config.toml` support, we can revisit `loadConnectionConfiguration()` holistically.

## Status

**SDK implementation**: We have a working implementation on the `snake_case` branch. We're going to rewrite it to match the agreed spec (simple `snakeToCamel` + 4 overrides, instead of the derived-map approach currently committed). Tests are written and passing. Will amend the commit and share.

**No blockers.** CoCo can plan their migration work against this spec.
