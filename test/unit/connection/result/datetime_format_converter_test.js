const assert = require('assert');
const {
  convertSnowflakeFormatToDateFormat,
} = require('../../../../lib/connection/result/datetime_format_converter');

describe('Test datetime format converter', function () {
  [
    {
      snowflakeFormat: 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM',
      expectedDateFormat: 'YYYY-MM-DD HH:mm:ss. Z',
    },
    {
      snowflakeFormat: 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM',
      expectedDateFormat: 'YYYY-MM-DD HH:mm:ss. Z',
    },
    {
      snowflakeFormat: 'YY-MM-DD HH12:MI:SS,FF5AM TZHTZM',
      expectedDateFormat: 'YY-MM-DD hh:mm:ss,A ZZ',
    },
    {
      snowflakeFormat: 'MMMM DD, YYYY DY HH24:MI:SS.FF9 TZH:TZM',
      expectedDateFormat: 'MMMM DD, YYYY ddd HH:mm:ss. Z',
    },
    {
      snowflakeFormat: 'MON DD, YYYY HH12:MI:SS,FF9PM TZH:TZM',
      expectedDateFormat: 'MMM DD, YYYY hh:mm:ss,A Z',
    },
    {
      snowflakeFormat: 'HH24:MI:SS.FF3 HH12:MI:SS,FF9',
      expectedDateFormat: 'HH:mm:ss. hh:mm:ss,',
    },
    {
      snowflakeFormat: 'HH24:MI:SS.FF3 HH12:MI:SS,FF9 TZH',
      expectedDateFormat: 'HH:mm:ss. hh:mm:ss, Z',
    },

    // { name: 'unknown', snowflakeFormat: 'unknown', expectedDateFormat: 'AuthDefault' }
  ].forEach(({ snowflakeFormat, expectedDateFormat }) => {
    it('test format mapping', async function () {
      const convertedDateFormat = convertSnowflakeFormatToDateFormat(snowflakeFormat, 0);
      assert.strictEqual(convertedDateFormat, expectedDateFormat);
    });
  });
});
