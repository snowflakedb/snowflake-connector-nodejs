/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const setTimezoneToPST = 'alter session set TIMEZONE=\'America/Los_Angeles\'';
const setTimestampOutputFormat = 'alter session set TIMESTAMP_OUTPUT_FORMAT=\'YYYY-MM-DD HH24:MI:SS.FF3 TZHTZM\'';
const setTimestampNTZOutputFormat = 'alter session set TIMESTAMP_NTZ_OUTPUT_FORMAT=\'YYYY-MM-DD HH24:MI:SS.FF3\'';
const setTimezoneAndTimestamps =
  'alter session set TIMEZONE=\'America/Los_Angeles\', ' +
  'TIMESTAMP_OUTPUT_FORMAT=\'YYYY-MM-DD HH24:MI:SS.FF3 TZHTZM\', ' +
  'TIMESTAMP_LTZ_OUTPUT_FORMAT=\'YYYY-MM-DD HH24:MI:SS.FF3 TZHTZM\', ' +
  'TIMESTAMP_TZ_OUTPUT_FORMAT=\'YYYY-MM-DD HH24:MI:SS.FF3 TZHTZM\', ' +
  'TIMESTAMP_NTZ_OUTPUT_FORMAT=\'YYYY-MM-DD HH24:MI:SS.FF3\'';

exports.setTimezoneToPST = setTimezoneToPST;
exports.setTimestampOutputFormat = setTimestampOutputFormat;
exports.setTimestampNTZOutputFormat = setTimestampNTZOutputFormat;
exports.setTimezoneAndTimestamps = setTimezoneAndTimestamps;
