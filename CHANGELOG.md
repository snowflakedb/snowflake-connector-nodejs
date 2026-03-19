# Changelog

## Upcoming Release

New features:

- `connect()` now supports every authenticator type (including external browser and Okta), matching `connectAsync()` (snowflakedb/snowflake-connector-nodejs#1342)

Internal changes:

- Removed `smkId` string conversion; the driver now requests the server to return it as a string (snowflakedb/snowflake-connector-nodejs#1344)

## 2.3.5

- Added ability to skip token file permission checks using `SF_SKIP_TOKEN_FILE_PERMISSIONS_VERIFICATION` env variable (snowflakedb/snowflake-connector-nodejs#1314)
- Added Node 18+ to `engines`, which is our minimum officially supported version since the 2.x release (snowflakedb/snowflake-connector-nodejs#1268)
- Added `PLATFORM` field to login-request telemetry (snowflakedb/snowflake-connector-nodejs#1269)
- Added request retries to previously uncovered query execution paths (snowflakedb/snowflake-connector-nodejs#1280)
- Added `rowStreamHighWaterMark` connection option to control how many rows are buffered when streaming query results via `statement.streamRows()` (snowflakedb/snowflake-connector-nodejs#1289)
- Added a warning when converting query result to JavaScript numbers with precision loss (snowflakedb/snowflake-connector-nodejs#1295, snowflakedb/snowflake-connector-nodejs#1296)
- Added snake_case key support when loading `connections.toml` via `createConnection()` with no arguments (snowflakedb/snowflake-connector-nodejs#1304)
- Exported `normalizeConnectionOptions()` utility to convert snake_case connection keys to camelCase, with key aliases and acronym overrides (snowflakedb/snowflake-connector-nodejs#1304)
- Added `LIBC_FAMILY` and `LIBC_VERSION` fields to login-request telemetry (snowflakedb/snowflake-connector-nodejs#1310)
- Added `crlDownloadMaxSize` config option to enforce a maximum response size limit when downloading CRL files (snowflakedb/snowflake-connector-nodejs#1321)
- Added RSASSA-PSS signature verification support to CRL validation (snowflakedb/snowflake-connector-nodejs#1325)
- Improved error details when OAuth fails (snowflakedb/snowflake-connector-nodejs#1302)
- Changed default `jsonColumnVariantParser` to `JSON.parse` (snowflakedb/snowflake-connector-nodejs#1300)
- Updated Linux GNU minicore binaries to target glibc 2.18 for broader compatibility with older Linux distributions (snowflakedb/snowflake-connector-nodejs#1332)
- Fixed OAuth crashing when using bundlers (snowflakedb/snowflake-connector-nodejs#1266)
- Fixed `Binds` typing to allow readonly arrays (snowflakedb/snowflake-connector-nodejs#1270)
- Fixed `connectAsync()` method resolving before connection is completed (snowflakedb/snowflake-connector-nodejs#1276)
- Fixed incorrect handling of callback argument that should be optional in `connect()` and `connectAsync()` (snowflakedb/snowflake-connector-nodejs#1276)
- Fixed a bug where invalid JWT was generated if user accidentally set both the `account` and the `host` in the config (snowflakedb/snowflake-connector-nodejs#1283)
- Fixed a bug where parsing the JSON media type failed when it included an optional parameter from Microsoft Identity Platform v2.0 tokens, failing OAuth Client Credentials flow (snowflakedb/snowflake-connector-nodejs#1301)
- Fixed `disableSamlUrlCheck` typing to use correct casing: `disableSamlURLCheck` (snowflakedb/snowflake-connector-nodejs#1304)
- Fixed `getDefaultCacheDir()` crashing in environments where no user home directory is configured by falling back to `os.tmpdir()` (snowflakedb/snowflake-connector-nodejs#1312)
- Fixed `SF_OCSP_RESPONSE_CACHE_DIR` not being used directly as the OCSP cache directory (snowflakedb/snowflake-connector-nodejs#1313)
- Fixed bugs in `noProxy` and `NO_PROXY` handling:
  - `.domain.com` wildcard format was not correctly matching the destination host (snowflakedb/snowflake-connector-nodejs#1309)
  - `.` was incorrectly matching as any character instead of a literal dot (snowflakedb/snowflake-connector-nodejs#1315)
  - Partial strings were incorrectly matching instead of requiring full destination match (snowflakedb/snowflake-connector-nodejs#1315)
- Fixed CRL ADVISORY mode to log failures at warn level instead of debug (snowflakedb/snowflake-connector-nodejs#1321)
- Fixed OAuth Authorization Code reauthentication not using the refreshed access token when the cached access token is expired (snowflakedb/snowflake-connector-nodejs#1318)
- Fixed OAuth Authorization Code refresh token being removed from cache when the IDP does not return a new one (snowflakedb/snowflake-connector-nodejs#1319)
- Fixed unhandled promise rejection when server returns malformed query responses (snowflakedb/snowflake-connector-nodejs#1329)
- Replaced ESLint with oxlint for better performance and out-of-the-box TypeScript support (snowflakedb/snowflake-connector-nodejs#1254)
- Bumped `fast-xml-parser` requirement to latest 5.4.1 to address CVE-2026-26278 and CVE-2026-27942 (snowflakedb/snowflake-connector-nodejs#1281 and snowflakedb/snowflake-connector-nodejs#1311)
- Removed `bn.js` dependency (snowflakedb/snowflake-connector-nodejs#1294)

## 2.3.4

- Fixed inconsistent retry behavior across HTTP requests and ensured all recoverable failures are properly retried (snowflakedb/snowflake-connector-nodejs#1230, snowflakedb/snowflake-connector-nodejs#1232, snowflakedb/snowflake-connector-nodejs#1233, snowflakedb/snowflake-connector-nodejs#1249, snowflakedb/snowflake-connector-nodejs#1250)
- Fixed invalid oauth scope when `role` and `oauthScope` are missing from the connection config (snowflakedb/snowflake-connector-nodejs#1262)
- Reduced memory usage during PUT operations (snowflakedb/snowflake-connector-nodejs#1226)
- Added Linux distribution details parsed from `/etc/os-release` to login-request telemetry (snowflakedb/snowflake-connector-nodejs#1234)
- Added `APPLICATION_PATH` to login-request telemetry (snowflakedb/snowflake-connector-nodejs#1240)
- Added additional error details to minicore telemetry (snowflakedb/snowflake-connector-nodejs#1259)
- Bumped axios to `1.13.4` to address a bug in axios interceptors (snowflakedb/snowflake-connector-nodejs#1245)
- Bumped dependencies to their latest minor versions (snowflakedb/snowflake-connector-nodejs#1247, snowflakedb/snowflake-connector-nodejs#1252, snowflakedb/snowflake-connector-nodejs#1261)
- Fixed `APPLICATION` field not being passed from connection config to login-request telemetry (snowflakedb/snowflake-connector-nodejs#1257)
- Fixed build errors in bundlers caused by the minicore module (snowflakedb/snowflake-connector-nodejs#1258)

## 2.3.3

- Replaced `glob` dependency used in `PUT` queries with a custom wildcard matching implementation (snowflakedb/snowflake-connector-nodejs#1223)
- Fixed misleading debug messages during login request (snowflakedb/snowflake-connector-nodejs#1213)
- Fixed a bug in build script resulting in minicore binaries to not be present in the dist folder (snowflakedb/snowflake-connector-nodejs#1221)

## 2.3.2

- Added official support for RHEL 9 (snowflakedb/snowflake-connector-nodejs#1196)
- Added official support for NodeJS 24 (snowflakedb/snowflake-connector-nodejs#1202)
- Fixed TypeScript definition for `getResultsFromQueryId` - `queryId` should be required and `sqlText` should be optional (snowflakedb/snowflake-connector-nodejs#1197)
- Bumped dependency `glob` to address CVE-2025-64756 (snowflakedb/snowflake-connector-nodejs#1206)
- Fixed a regression introduced in v2.3.1 where instantiating SnowflakeHttpsProxyAgent was attempted without the `new` keyword, breaking the driver when both OCSP was enabled and HTTP_PROXY environmental variable was used to set proxy (bug did not affect HTTPS_PROXY) (snowflakedb/snowflake-connector-nodejs#1192)
- Introduced shared library for extended telemetry to identify and prepare testing platform for native node addons (snowflakedb/snowflake-connector-nodejs#1212)

## 2.3.1

- Fixed a regression introduced in 2.3.0 causing PUT operations to encrypt files with wrong smkId (snowflakedb/snowflake-connector-nodejs#1184)
- Added `workloadIdentityAzureClientId` config option allowing to customize Azure Client for `WORKLOAD_IDENTITY` authentication (snowflakedb/snowflake-connector-nodejs#1174)
- Added `workloadIdentityImpersonationPath` config option for `authenticator=WORKLOAD_IDENTITY` allowing workloads to authenticate as a different identity through transitive service account impersonation (snowflakedb/snowflake-connector-nodejs#1178, snowflakedb/snowflake-connector-nodejs#1179, snowflakedb/snowflake-connector-nodejs#1182)

## 2.3.0 (Deprecated)

> **⚠️ WARNING: This version has been deprecated due to critical code issue. All changes from 2.3.0 available in 2.3.1**

- Added CRL validation. Disabled by default, see `certRevocationCheckMode` config option for details.
- Improved debug logs when dowloading query result chunks (snowflakedb/snowflake-connector-nodejs#1142)
- Fixed missing error handling in `getResultsFromQueryId()` (snowflakedb/snowflake-connector-nodejs#1173)
- Fixed invalid transformation of `null` values to `""` when using stage binds (snowflakedb/snowflake-connector-nodejs#1166)
- Extended typing of Bind (snowflakedb/snowflake-connector-nodejs#1176)

## Prior Releases

Release notes available at https://docs.snowflake.com/en/release-notes/clients-drivers/nodejs
