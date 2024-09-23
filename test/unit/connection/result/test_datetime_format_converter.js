/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const { convertSnowflakeFormatToMomentFormat } = require('../../../../lib/connection/result/datetime_format_converter');

describe('Test ditetime format converter', function () {
  [{
    name: 'name',
    snowflakeFormat: 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM',
    expectedMomentFormat: 'YYYY-MM-DD HH:mm:ss. Z'
  },

    // { name: 'unknown', snowflakeFormat: 'unknown', expectedMomentFormat: 'AuthDefault' }
  ].forEach(({ name, snowflakeFormat, expectedMomentFormat  }) => {
    it(name, async function () {
      const convertedMomentFormat = convertSnowflakeFormatToMomentFormat(snowflakeFormat, 0);
      assert.strictEqual(convertedMomentFormat, expectedMomentFormat);
    });
  });
});
