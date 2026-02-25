# SDK Spec: Accept snake_case Connection Options

## Summary

Add `normalizeConnectionOptions()` to the `ConnectionConfig` constructor that converts snake_case TOML keys to camelCase before processing. This allows consumers to pass raw TOML-parsed objects directly to `createConnection()`.

## Problem

TOML config files use snake_case (`private_key_path`). The JS SDK only accepts camelCase (`privateKeyPath`). Every consumer that parses TOML must maintain a manual key mapping. The Python connector accepts snake_case natively.

## Design

### Approach: Generic snakeToCamel + Explicit Overrides

```javascript
const KEY_ALIASES = {
  user: 'username',
  private_key_file: 'privateKeyPath',
};

const SNAKE_TO_CAMEL_OVERRIDES = {
  client_request_mfa_token: 'clientRequestMFAToken',
  force_gcp_use_downscoped_credential: 'forceGCPUseDownscopedCredential',
  disable_saml_url_check: 'disableSamlURLCheck',
  crl_allow_certificates_without_crl_url: 'crlAllowCertificatesWithoutCrlURL',
};

function snakeToCamel(key) {
  return key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}
```

**Why this approach over the derived-map approach:**

- Only 4 acronym edge cases exist (`MFA`, `GCP`, `URL`×2). These change extremely rarely.
- Simpler to understand, debug, and maintain.
- No tricky two-pass `camelToSnake` regex needed.
- If a new acronym-cased param is added to `DEFAULT_PARAMS` and the override map isn't updated, the generic `snakeToCamel` still works — it just produces `clientRequestMfaToken` instead of `clientRequestMFAToken`. The SDK would NOT recognize it, so the override must be added. But this is a compile-time-detectable gap (tests catch it), not a silent runtime bug.

**Why aliases are separate from overrides:**

- `user` → `username`: Not a casing difference — completely different word.
- `private_key_file` → `privateKeyPath`: Not a casing difference — `file` ≠ `path`.

### normalizeConnectionOptions

```javascript
function normalizeConnectionOptions(options) {
  if (!options || typeof options !== 'object') {
    return options;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(options)) {
    // Strip undefined values to prevent interpolation bugs
    if (value === undefined) {
      continue;
    }

    // Explicit aliases (user→username, private_key_file→privateKeyPath)
    if (KEY_ALIASES[key] !== undefined) {
      if (normalized[KEY_ALIASES[key]] === undefined) {
        normalized[KEY_ALIASES[key]] = value;
      }
      continue;
    }

    // Acronym overrides (MFA, GCP, URL)
    if (SNAKE_TO_CAMEL_OVERRIDES[key] !== undefined) {
      const target = SNAKE_TO_CAMEL_OVERRIDES[key];
      if (normalized[target] === undefined) {
        normalized[target] = value;
      }
      continue;
    }

    // Generic: if it looks like snake_case, convert; otherwise pass through
    if (key === key.toLowerCase() && key.includes('_')) {
      const camelKey = snakeToCamel(key);
      if (normalized[camelKey] === undefined) {
        normalized[camelKey] = value;
      }
    } else {
      // camelCase or single-word key — pass through, don't overwrite
      normalized[key] = normalized[key] !== undefined ? normalized[key] : value;
    }
  }
  return normalized;
}
```

### Precedence rules

1. camelCase keys always win over snake_case (because `Object.entries` iterates insertion order, and camelCase keys that are already set are never overwritten).
2. Aliases are checked first, so `user` is always mapped to `username`.
3. `undefined` values are stripped entirely.

## Files Changed

### `lib/connection/connection_config.js`

- Add `KEY_ALIASES`, `SNAKE_TO_CAMEL_OVERRIDES`, `snakeToCamel()`, `normalizeConnectionOptions()` after `DEFAULT_PARAMS`
- Call `normalizeConnectionOptions(options)` at top of `ConnectionConfig` constructor, after the null/type check but before any field access

### `index.d.ts`

- Add `[key: string]: unknown` index signature to `ConnectionOptions` to allow snake_case passthrough without type errors

### `test/unit/connection/connection_config_test.js`

- 11 test cases covering: basic conversion, aliases, OAuth keys, mixed casing, precedence, undefined stripping, acronyms, workload identity, single-word passthrough, validateDefaultParameters

## Files NOT Changed

### `lib/configuration/connection_configuration.js`

- `fixUserKey()` stays — it's part of `loadConnectionConfiguration()`'s public API contract
- `normalizeConnectionOptions` in `ConnectionConfig` handles `user`→`username` idempotently (if `fixUserKey` already added `username`, normalization preserves it)

## What This Does NOT Include (potential follow-up PRs)

1. **`config.toml` support** — The Python connector reads both `config.toml` (primary, nested `[connections.x]`) and `connections.toml` (secondary, flat `[x]`). The JS SDK only reads `connections.toml`. This is a real gap but a separate change.

2. **`SNOWFLAKE_TOKEN` env var support** — Unclear if this is a platform standard or tool-specific. Needs clarification.

3. **Tilde expansion in paths** — Python connector does `expand_tilde()` for `private_key_file`. The JS SDK doesn't. Worth adding but separate scope.

4. **Removing `fixUserKey()`** — Would need a deprecation cycle since `loadConnectionConfiguration()` is a public API.

## Test Matrix

| Test                      | Input                                                                      | Expected                                  |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| Basic snake_case          | `{ account: 'x', private_key_path: '/p' }`                                 | `getPrivateKeyPath()` → `/p`              |
| user alias                | `{ account: 'x', user: 'alice', password: 'pw' }`                          | `getUsername()` → `alice`                 |
| private_key_file alias    | `{ account: 'x', private_key_file: '/k', authenticator: 'SNOWFLAKE_JWT' }` | `getPrivateKeyPath()` → `/k`              |
| OAuth snake_case          | `{ account: 'x', oauth_client_id: 'id', ... }`                             | OAuth getters return values               |
| Mixed casing              | `{ account: 'x', privateKeyPath: '/c', private_key_pass: 'sp' }`           | Both set                                  |
| camelCase precedence      | `{ account: 'x', privateKeyPath: '/c', private_key_path: '/s' }`           | `getPrivateKeyPath()` → `/c`              |
| undefined stripping       | `{ account: 'x', username: 'a', password: 'p', role: undefined }`          | `getRole()` is not `"undefined"`          |
| Acronym: MFA              | `{ ..., client_request_mfa_token: true }`                                  | `clientRequestMFAToken` is true           |
| Acronym: GCP              | `{ ..., force_gcp_use_downscoped_credential: true }`                       | `forceGCPUseDownscopedCredential` is true |
| Acronym: URL              | `{ ..., disable_saml_url_check: true }`                                    | `disableSamlURLCheck` is true             |
| workload_identity         | `{ ..., workload_identity_provider: 'AWS' }`                               | Provider set                              |
| Single-word passthrough   | `{ account: 'x', password: 'p' }`                                          | Unchanged                                 |
| validateDefaultParameters | `{ ..., validate_default_parameters: true }`                               | No warnings for known snake_case keys     |
