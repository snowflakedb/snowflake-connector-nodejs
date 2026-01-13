import Logger from '../../lib/logger';
import * as testUtil from './testUtil';

const snowflake = require('../../lib/snowflake');

describe('Test Cancel Query', function () {
  let connection: any;
  let initialLogLevel: string;
  const longQuery = 'select count(*) from table(generator(timeLimit => 3600))';

  before(async () => {
    // TODO:
    // - BrowserLogger is not the actual logger that is returned by Logger().
    //   Clean this up when dropping browser-related code.
    // - Adding trace log to figure out why this test is flaky
    initialLogLevel = (Logger() as any).getLevelTag() as string;
    snowflake.configure({ logLevel: 'trace' });
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
  });

  after(async () => {
    snowflake.configure({ logLevel: initialLogLevel });
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testCancelQuerySimple', function (done) {
    const statement = connection.execute({
      sqlText: longQuery,
    });

    setTimeout(function () {
      statement.cancel(function (err: unknown) {
        testUtil.checkError(err);
        done();
      });
    }, 10000);
  });
});
