/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const { convertSnowflakeFormatToMomentFormat } = require('../../../../lib/connection/result/datetime_format_converter');
const moment = require('moment');
const momentTimezone = require('moment-timezone');

describe('Test ditetime format converter', function () {
  const stringDateTime = '2021-12-22 09:43:44.123456 -0800';

  [{
    name: 'name',
    snowflakeFormat: 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM',
    expectedMomentFormat: 'YYYY-MM-DD HH:mm:ss. Z'
  },

    // { name: 'unknown', snowflakeFormat: 'unknown', expectedMomentFormat: 'AuthDefault' }
  ].forEach(({ name, snowflakeFormat, expectedMomentFormat  }) => {
    it('test1', async function () {
      const convertedMomentFormat = convertSnowflakeFormatToMomentFormat(snowflakeFormat, 0);
      const moment = momentTimezone(stringDateTime);
      console.log(moment.format(convertedMomentFormat));
      console.log(moment.getNanoSeconds());
      assert.strictEqual(convertedMomentFormat, expectedMomentFormat);
    });
  });
});
