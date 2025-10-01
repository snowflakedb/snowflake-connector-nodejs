# Changelog

## 2.4.0 (TBD)

## 2.3.0

- Added CRL validation. Disabled by default, see `certRevocationCheckMode` config option for details.
- Added `workloadIdentityAzureClientId` config option allowing to customize Azure Client for `WORKLOAD_IDENTITY` authentication (snowflakedb/snowflake-connector-nodejs#1174)
- Improved debug logs when dowloading query result chunks (snowflakedb/snowflake-connector-nodejs#1142)
- Fixed missing error handling in `getResultsFromQueryId()` (snowflakedb/snowflake-connector-nodejs#1173)
- Fixed invalid transformation of `null` values to `""` when using stage binds (snowflakedb/snowflake-connector-nodejs#1166)
- Extended typing of Bind (snowflakedb/snowflake-connector-nodejs#1176)

## Prior Releases

Release notes available at https://docs.snowflake.com/en/release-notes/clients-drivers/nodejs
