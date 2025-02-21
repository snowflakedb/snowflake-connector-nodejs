const assert = require('assert');
const { convertSnowflakeFormatToMomentFormat } = require('../../../../lib/connection/result/datetime_format_converter');

describe('Test ditetime format converter', function () {
  [{
    snowflakeFormat: 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM',
    expectedMomentFormat: 'YYYY-MM-DD HH:mm:ss. Z'
  },
  {
    snowflakeFormat: 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM',
    expectedMomentFormat: 'YYYY-MM-DD HH:mm:ss. Z',
  },
  {
    snowflakeFormat: 'YY-MM-DD HH12:MI:SS,FF5AM TZHTZM',
    expectedMomentFormat: 'YY-MM-DD hh:mm:ss,A ZZ',
  },
  {
    snowflakeFormat: 'MMMM DD, YYYY DY HH24:MI:SS.FF9 TZH:TZM',
    expectedMomentFormat: 'MMMM DD, YYYY ddd HH:mm:ss. Z',
  },
  {
    snowflakeFormat: 'MON DD, YYYY HH12:MI:SS,FF9PM TZH:TZM',
    expectedMomentFormat: 'MMM DD, YYYY hh:mm:ss,A Z',
  },
  {
    snowflakeFormat: 'HH24:MI:SS.FF3 HH12:MI:SS,FF9',
    expectedMomentFormat: 'HH:mm:ss. hh:mm:ss,',
  },
  {
    snowflakeFormat: 'HH24:MI:SS.FF3 HH12:MI:SS,FF9 TZH',
    expectedMomentFormat: 'HH:mm:ss. hh:mm:ss, Z',
  }

    // { name: 'unknown', snowflakeFormat: 'unknown', expectedMomentFormat: 'AuthDefault' }
  ].forEach(( { snowflakeFormat, expectedMomentFormat  }) => {
    it('test format mapping', async function () {
      const convertedMomentFormat = convertSnowflakeFormatToMomentFormat(snowflakeFormat, 0);
      assert.strictEqual(convertedMomentFormat, expectedMomentFormat);
    });
  });
});
