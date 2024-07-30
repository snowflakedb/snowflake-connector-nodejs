/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const dateTimeFormatConverter = require('./../../../../lib/connection/result/datetime_format_converter');
const assert = require('assert');

describe('Datetime format converter test', function () {
  [
    {
      inputFormat: 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM',
      output: 'YYYY-MM-DD HH:mm:ss. Z',
    },
    {
      inputFormat: 'YY-MM-DD HH12:MI:SS,FF5AM TZHTZM',
      output: 'YY-MM-DD hh:mm:ss,A ZZ',
    },
    {
      inputFormat: 'MMMM DD, YYYY DY HH24:MI:SS.FF9 TZH:TZM',
      output: 'MMMM DD, YYYY ddd HH:mm:ss. Z',
    },
    {
      inputFormat: 'MON DD, YYYY HH12:MI:SS,FF9PM TZH:TZM',
      output: 'MMM DD, YYYY hh:mm:ss,A Z',
    },
    {
      inputFormat: 'HH24:MI:SS.FF3 HH12:MI:SS,FF9',
      output: 'HH:mm:ss. hh:mm:ss,',
    }
  ].forEach(({ inputFormat, output }) => {
    it('valid result stream', function () {
      const converted = dateTimeFormatConverter.convertSnowflakeFormatToMomentFormat(inputFormat);
      assert.equal(converted, output);
    });
  });
});