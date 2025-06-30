const async = require('async');
const testUtil = require('./testUtil');

describe('Test Cancel Query', function () {
  let connection;
  const longQuery = 'select count(*) from table(generator(timeLimit => 3600))';

  before(function (done) {
    connection = testUtil.createConnection();
    async.series(
      [
        function (callback) {
          testUtil.connect(connection, callback);
        }
      ],
      done
    );
  });

  after(function (done) {
    async.series(
      [
        function (callback) {
          testUtil.destroyConnection(connection, callback);
        }
      ],
      done
    );
  });


  it('testCancelQuerySimple', function (done) {
    const statement = connection.execute({
      sqlText: longQuery
    });

    setTimeout(function () {
      statement.cancel(function (err) {
        testUtil.checkError(err);
        done();
      });
    }, 10000);
  });
});




















