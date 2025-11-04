const testUtil = require('./testUtil');

describe('Test Cancel Query', function () {
  let connection;
  const longQuery = 'select count(*) from table(generator(timeLimit => 3600))';

  before(async () => {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
  });

  after(async () => {
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testCancelQuerySimple', function (done) {
    const statement = connection.execute({
      sqlText: longQuery,
    });

    setTimeout(function () {
      statement.cancel(function (err) {
        testUtil.checkError(err);
        done();
      });
    }, 10000);
  });
});
