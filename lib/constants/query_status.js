/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */

const code = {};

code.RUNNING = 'RUNNING';
code.ABORTING = 'ABORTING';
code.SUCCESS = 'SUCCESS';
code.FAILED_WITH_ERROR = 'FAILED_WITH_ERROR';
code.ABORTED = 'ABORTED';
code.QUEUED = 'QUEUED';
code.FAILED_WITH_INCIDENT = 'FAILED_WITH_INCIDENT';
code.DISCONNECTED = 'DISCONNECTED';
code.RESUMING_WAREHOUSE = 'RESUMING_WAREHOUSE';
// purposeful typo.Is present in QueryDTO.java
code.QUEUED_REPARING_WAREHOUSE = 'QUEUED_REPARING_WAREHOUSE';
code.RESTARTED = 'RESTARTED';
code.BLOCKED = 'BLOCKED';
code.NO_DATA = 'NO_DATA';

exports.code = code;
