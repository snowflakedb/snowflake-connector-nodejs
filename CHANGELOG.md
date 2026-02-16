# Changelog

## Upcoming Release

- Fixed inconsistent retry behavior across HTTP requests and ensured all recoverable failures are properly retried (snowflakedb/snowflake-connector-nodejs#1230, snowflakedb/snowflake-connector-nodejs#1232, snowflakedb/snowflake-connector-nodejs#1233)
- Reduced memory usage during PUT operations (snowflakedb/snowflake-connector-nodejs#1226)
- Extended login-request telemetry with Linux distribution details parsed from `/etc/os-release` (snowflakedb/snowflake-connector-nodejs#1234)
- Added `APPLICATION_PATH` to login-request telemetry (snowflakedb/snowflake-connector-nodejs#1240)
- Replaced ESLint with oxlint for better performance and out-of-the-box TypeScript support (snowflakedb/snowflake-connector-nodejs#1254)

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
