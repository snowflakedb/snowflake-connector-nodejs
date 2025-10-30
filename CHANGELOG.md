# Changelog

## 2.4.0 (TBD)

- .

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
