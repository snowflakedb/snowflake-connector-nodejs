const Util = require('./../../lib/util');
const ErrorCodes = require('./../../lib/errors').codes;
const MockTestUtil = require('./mock/mock_test_util');
const QueryStatus = require('./../../lib/constants/query_status').code;
const assert = require('assert');
const testUtil = require('./test_util');
const async = require('async');
const { connectAsync, destroyConnectionAsync } = require('../integration/testUtil');

// get a mock snowflake instance
const snowflake = MockTestUtil.snowflake;

// get connection options to connect to this mock snowflake instance
const mockConnectionOptions = MockTestUtil.connectionOptions;
const connectionOptions = mockConnectionOptions.default;
const connectionOptionsDeserialize = mockConnectionOptions.deserialize;
const connectionOptionsServiceName = mockConnectionOptions.serviceName;
const connectionOptionsClientSessionKeepAlive = mockConnectionOptions.clientSessionKeepAlive;
const connectionOptionsForSessionGone = mockConnectionOptions.sessionGone;
const connectionOptionsForSessionExpired = mockConnectionOptions.sessionExpired;
const connectionOptionsExternalBrowser = mockConnectionOptions.authExternalBrowser;
const connectionOptionsOkta = mockConnectionOptions.authOkta;
const connectionOptionsFor504 = mockConnectionOptions.http504;
const connectionOptionsTreatIntegerAsBigInt = mockConnectionOptions.treatIntAsBigInt;

describe('snowflake.createConnection() synchronous errors', function () {
  const testCases =
    [
      {
        name: 'missing options',
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS
      },
      {
        name: 'undefined options',
        options: undefined,
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS
      },
      {
        name: 'null options',
        options: null,
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS
      },
      {
        name: 'invalid options',
        options: 'invalid',
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_OPTIONS
      },
      {
        name: 'missing username',
        options: {},
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'undefined username',
        options:
          {
            username: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'null username',
        options:
          {
            username: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'invalid username',
        options:
          {
            username: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME
      },
      {
        name: 'missing password',
        options:
          {
            username: 'username'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'undefined password',
        options:
          {
            username: 'username',
            password: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'null password',
        options:
          {
            username: 'username',
            password: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'invalid password',
        options:
          {
            username: 'username',
            password: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PASSWORD
      },
      {
        name: 'missing account',
        options:
          {
            username: 'username',
            password: 'password'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'undefined account',
        options:
          {
            username: 'username',
            password: 'password',
            account: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'null account',
        options:
          {
            username: 'username',
            password: 'password',
            account: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'invalid account',
        options:
          {
            username: 'username',
            password: 'password',
            account: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT
      },
      {
        name: 'invalid warehouse',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_WAREHOUSE
      },
      {
        name: 'invalid database',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 'warehouse',
            database: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_DATABASE
      },
      {
        name: 'invalid schema',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 'warehouse',
            database: 'database',
            schema: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_SCHEMA
      },
      {
        name: 'invalid role',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 'warehouse',
            database: 'database',
            schema: 'schema',
            role: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ROLE
      },
      {
        name: 'missing proxyHost',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 'warehouse',
            database: 'database',
            schema: 'schema',
            role: 'role',
            proxyPort: ''
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_HOST
      },
      {
        name: 'invalid proxyHost',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 'warehouse',
            database: 'database',
            schema: 'schema',
            role: 'role',
            proxyHost: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_HOST
      },
      {
        name: 'missing proxyPort',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 'warehouse',
            database: 'database',
            schema: 'schema',
            role: 'role',
            proxyHost: 'proxyHost'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_PORT
      },
      {
        name: 'invalid proxyPort',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 'warehouse',
            database: 'database',
            schema: 'schema',
            role: 'role',
            proxyHost: 'proxyHost',
            proxyPort: 'proxyPort'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_PORT
      },
      {
        name: 'invalid row mode',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 'warehouse',
            database: 'database',
            schema: 'schema',
            role: 'role',
            rowMode: 'unknown'
          },
        errorCode: ErrorCodes.ERR_STMT_STREAM_ROWS_INVALID_ROW_MODE
      }
    ];

  const createItCallback = function (testCase) {
    return function () {
      let error = null;

      try {
        snowflake.createConnection(testCase.options);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  let index, length, testCase;
  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});

describe('snowflake.createConnection() success', function () {
  it('createConnection() returns connection', function () {
    const connection = snowflake.createConnection(connectionOptions);
    assert.ok(connection);
  });
});

describe('connection.connect() synchronous errors', function () {
  it('connect() with invalid callback', function () {
    let error = null;

    try {
      snowflake.createConnection(connectionOptions).connect('invalid');
    } catch (err) {
      error = err;
    } finally {
      assert.ok(error != null);
      assert.strictEqual(
        error.code, ErrorCodes.ERR_CONN_CONNECT_INVALID_CALLBACK);
    }
  });
});

describe('connection.connect() success', function () {
  it('connect() success', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    const ret = connection.connect(function (err, conn) {
      assert.ok(!err, 'there should be no error');
      assert.strictEqual(conn, connection,
        'the connect() callback should be invoked with the connection');
      done();
    });

    assert.strictEqual(
      connection, ret, 'connect() should return the connection');
  });
});

describe('connection.connect() asynchronous errors', function () {
  // This test is flaky. Sometimes the first connect is being executed too slow, so adding timeout = 0 on the second
  // connect was a try to speed it up a bit.
  // But sometimes the first connect is being executed too fast,
  // and we get an error on the second attempt "already connected" instead of "connection already in progress".
  xit('connect() while already connecting', function (done) {
    // create a connection and connect
    const connection = snowflake.createConnection(connectionOptions).connect();

    // try to connect again
    setTimeout(() => {
      connection.connect(function (err, conn) {
        assert.strictEqual(conn, connection,
          'the connect() callback should be invoked with the connection');
        assert.ok(err);
        assert.strictEqual(
          err.code, ErrorCodes.ERR_CONN_CONNECT_STATUS_CONNECTING);
        done();
      });
    }, 0); // when execution is on easy logging init it is not really connecting. Adding 0 timeout changes the order of code executions.
  });

  it('connect() while already connected', function (done) {
    const connection = snowflake.createConnection(connectionOptions);

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');
            callback();
          });
        },
        function (callback) {
          // connection.connect() should fail at this point because we're
          // already connected
          connection.connect(function (err, conn) {
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');
            assert.ok(err);
            assert.strictEqual(
              err.code, ErrorCodes.ERR_CONN_CONNECT_STATUS_CONNECTED);
            callback();
          });
        }
      ],
      function () {
        done();
      });
  });

  it('connect() while fatally disconnected', function (done) {
    const connection = snowflake.createConnection(connectionOptions);

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');
            callback();
          });
        },
        function (callback) {
          connection.destroy(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the logout() callback should be invoked with the connection');
            callback();
          });
        },
        function (callback) {
          // connection.connect() should fail at this point because the
          // connection has been destroyed
          connection.connect(function (err, conn) {
            assert.ok(err, 'there should be an error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');
            assert.strictEqual(
              err.code, ErrorCodes.ERR_CONN_CONNECT_STATUS_DISCONNECTED);
            callback();
          });
        }
      ],
      function () {
        done();
      });
  });

  it('connect() with external browser authenticator', function (done) {
    // create a connection and connect with external browser
    const connection = snowflake.createConnection(connectionOptionsExternalBrowser);

    // try to connect
    try {
      connection.connect();
    } catch (err) {
      assert.ok(err);
      assert.strictEqual(
        err.code, ErrorCodes.ERR_CONN_CREATE_INVALID_AUTH_CONNECT);
      done();
    }
  });

  it('connect() with okta authenticator', function (done) {
    // create a connection and connect with okta
    const connection = snowflake.createConnection(connectionOptionsOkta);

    // try to connect
    try {
      connection.connect();
    } catch (err) {
      assert.ok(err);
      assert.strictEqual(
        err.code, ErrorCodes.ERR_CONN_CREATE_INVALID_AUTH_CONNECT);
      done();
    }
  });
});

describe('connection.execute() synchronous errors', function () {
  const connection = snowflake.createConnection(connectionOptions);

  const testCases =
    [
      {
        name: 'missing options',
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_OPTIONS
      },
      {
        name: 'undefined options',
        options: undefined,
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_OPTIONS
      },
      {
        name: 'null options',
        options: null,
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_OPTIONS
      },
      {
        name: 'invalid options',
        options: 'invalid',
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_OPTIONS
      },
      {
        name: 'missing sql text',
        options: {},
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_SQL_TEXT
      },
      {
        name: 'undefined sql text',
        options:
          {
            sqlText: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_SQL_TEXT
      },
      {
        name: 'null sql text',
        options:
          {
            sqlText: null
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_SQL_TEXT
      },
      {
        name: 'invalid sql text',
        options:
          {
            sqlText: 0
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_SQL_TEXT
      },
      {
        name: 'invalid binds',
        options:
          {
            sqlText: '',
            binds: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_BINDS
      },
      {
        name: 'invalid bind values',
        options:
          {
            sqlText: '',
            binds: [function () {
            }]
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_BIND_VALUES
      },
      {
        name: 'invalid parameters',
        options:
          {
            sqlText: '',
            parameters: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_PARAMETERS
      },
      {
        name: 'invalid complete',
        options:
          {
            sqlText: '',
            complete: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_COMPLETE
      },
      {
        name: 'invalid streamResult',
        options:
          {
            sqlText: '',
            streamResult: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_STREAM_RESULT
      },
      {
        name: 'invalid fetchAsString',
        options:
          {
            sqlText: '',
            fetchAsString: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_FETCH_AS_STRING
      },
      {
        name: 'invalid fetchAsString values',
        options:
          {
            sqlText: '',
            fetchAsString: ['invalid']
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_FETCH_AS_STRING_VALUES
      }
    ];

  const createItCallback = function (testCase) {
    return function () {
      let error = null;

      try {
        connection.execute(testCase.options);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  let index, length, testCase;
  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});

function testStatementFetchRows(statement) {
  const testCases =
    [
      {
        name: 'fetchRows() missing options',
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_OPTIONS
      },
      {
        name: 'fetchRows() undefined options',
        options: undefined,
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_OPTIONS
      },
      {
        name: 'fetchRows() null options',
        options: null,
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_OPTIONS
      },
      {
        name: 'fetchRows() invalid options',
        options: 'invalid',
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_OPTIONS
      },
      {
        name: 'fetchRows() missing each()',
        options: {},
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_EACH
      },
      {
        name: 'fetchRows() undefined each()',
        options:
          {
            each: undefined
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_EACH
      },
      {
        name: 'fetchRows() null each()',
        options:
          {
            each: null
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_EACH
      },
      {
        name: 'fetchRows() invalid each()',
        options:
          {
            each: 'invalid'
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_EACH
      },
      {
        name: 'fetchRows() missing end()',
        options:
          {
            each: function () {
            }
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_END
      },
      {
        name: 'fetchRows() row mode invalid',
        options:
          {
            each: function () {},
            end: function () {},
            rowMode: 'invalid'
          },
        errorCode: ErrorCodes.ERR_STMT_STREAM_ROWS_INVALID_ROW_MODE
      }
    ];

  let index, length, testCase, error;
  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];

    error = null;

    try {
      statement.fetchRows(testCase.options);
    } catch (err) {
      error = err;
    } finally {
      assert.ok(error);
      assert.strictEqual(error.code, testCase.errorCode);
    }
  }
}

describe('connection.execute() statement successful', function () {
  const connection = snowflake.createConnection(connectionOptions);
  const sqlText = 'select 1 as "c1";';
  const requestId = 'foobar';

  it('statement api', function (done) {
    let statement;

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the statement');

            callback();
          });
        },
        function (callback) {
          statement = connection.execute(
            {
              sqlText: sqlText,
              requestId: requestId,
              complete: function (err, stmt) {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statement,
                  'the execute() callback should be invoked with the statement');

                // we should only have one column c1
                const columns = statement.getColumns();
                assert.ok(Util.isArray(columns));
                assert.strictEqual(columns.length, 1);
                assert.ok(Util.isObject(columns[0]));
                assert.strictEqual(columns[0].getName(), 'c1');

                assert.strictEqual(statement.getNumRows(), 1);
                assert.ok(Util.isObject(statement.getSessionState()));
                assert.ok(Util.string.isNotNullOrEmpty(statement.getStatementId()));
                assert.ok(Util.string.isNotNullOrEmpty(statement.getQueryId()));

                testStatementFetchRows(statement);

                callback();
              }
            });

          testStatementFetchRows(statement);

          // the sql text and request id should be the same as what was passed
          // in
          assert.strictEqual(statement.getSqlText(), sqlText);
          assert.strictEqual(statement.getRequestId(), requestId);

          // the rest of the properties won't be available until the statement
          // is complete (some of them will only be available if the statement
          // succeeds)
          assert.strictEqual(statement.getColumns(), undefined);
          assert.strictEqual(statement.getNumRows(), undefined);
          assert.strictEqual(statement.getSessionState(), undefined);
          assert.strictEqual(statement.getStatementId(), undefined);
          assert.strictEqual(statement.getQueryId(), undefined);
        },
        function (callback) {
          const rows = [];
          statement.fetchRows(
            {
              each: function (row) {
                rows.push(row);
              },
              end: function (err, stmt) {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statement,
                  'the end() callback should be invoked with the statement');
                assert.strictEqual(rows.length, 1, 'there should only be one row');
                assert.strictEqual(rows[0].getColumnValue('c1'), 1,
                  'the row should only have one column c1 and its value ' +
                  'should be 1');

                callback();
              }
            });
        }
      ],
      function () {
        done();
      });
  });
});

describe('connection.execute() statement failure', function () {
  const connection = snowflake.createConnection(connectionOptions);
  const sqlText = 'select;';
  const requestId = 'foobar';

  it('statement api', function (done) {
    let statement;

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the statement');

            callback();
          });
        },
        function (callback) {
          statement = connection.execute(
            {
              sqlText: sqlText,
              requestId: requestId,
              complete: function (err, stmt) {
                assert.ok(err, 'there should be an error');
                assert.strictEqual(stmt, statement,
                  'the execute() callback should be invoked with the statement');

                assert.strictEqual(statement.getColumns(), undefined);
                assert.strictEqual(statement.getNumRows(), undefined);
                assert.strictEqual(statement.getSessionState(), undefined);
                assert.ok(Util.exists(statement.getStatementId()));
                assert.ok(Util.isString(statement.getStatementId()));
                assert.ok(Util.exists(statement.getQueryId()));
                assert.ok(Util.isString(statement.getQueryId()));

                callback();
              }
            });

          testStatementFetchRows(statement);

          // the sql text and request id should be the same as what was passed
          // in
          assert.strictEqual(statement.getSqlText(), sqlText);
          assert.strictEqual(statement.getRequestId(), requestId);

          // the rest of the properties won't be available until the statement
          // is complete (some of them will only be available if the statement
          // succeeds)
          assert.strictEqual(statement.getColumns(), undefined);
          assert.strictEqual(statement.getNumRows(), undefined);
          assert.strictEqual(statement.getSessionState(), undefined);
          assert.strictEqual(statement.getStatementId(), undefined);
          assert.strictEqual(statement.getQueryId(), undefined);
        },
        function (callback) {
          testStatementFetchRows(statement);

          statement.fetchRows(
            {
              each: function () {
              },
              end: function (err, stmt) {
                assert.ok(err, 'there should be an error');
                assert.strictEqual(stmt, statement,
                  'the execute() callback should be invoked with the statement');

                callback();
              }
            });
        }
      ],
      function () {
        done();
      });
  });
});

describe('connection.execute() with requestId', function () {
  const connection = snowflake.createConnection(connectionOptions);
  const sqlText = 'select 1;';
  const blankSqlText = '';
  const requestId = 'SNOW-728803-requestId';

  before(function (done) {
    connection.connect(function (err, conn) {
      assert.ok(!err, 'there should be no error');
      assert.strictEqual(conn, connection,
        'the connect() callback should be invoked with the statement');

      done();
    });
  });

  it('keep original sqlText when resubmitting requests', function (done) {
    // request with sqlText and requestId specified
    const statement = connection.execute(
      {
        sqlText: sqlText,
        requestId: requestId,
        complete: function (err, stmt) {
          // if there's an error, fail the test with the error
          if (err) {
            done(err);
          } else {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(stmt, statement,
              'the execute() callback should be invoked with the statement');

            // the sql text and request id should be the same as what was passed
            // in
            assert.strictEqual(statement.getSqlText(), sqlText);
            assert.strictEqual(statement.getRequestId(), requestId);

            done();
          }
        }
      });
  });

  it('sqlText is overwritten when resubmitting requests', function (done) {
    // request with only requestId specified
    const statement = connection.execute(
      {
        // intentionally leave sqlText blank to invoke the connector to overwrite the sqlText
        sqlText: blankSqlText,
        requestId: requestId,
        complete: function (err, stmt) {
          assert.ok(err, 'there should be an error');
          assert.strictEqual(stmt, statement,
            'the execute() callback should be invoked with the statement');

          // the sql text and request id should be the same as what was passed
          // in
          assert.strictEqual(stmt.getRequestId(), requestId);
          // the sqlText on the statement is unchanged but the sqlText on the request is different
          assert.strictEqual(stmt.getSqlText(), blankSqlText);

          done();
        }
      });
  });
});

describe('too many concurrent requests', function () {
  it('too many concurrent requests per user', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    const sqlText = 'select \'too many concurrent queries\';';
    const requestId = 'foobar';

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the statement');

            callback();
          });
        },
        function (callback) {
          connection.execute(
            {
              sqlText: sqlText,
              requestId: requestId,
              complete: function (err) {
                assert.ok(err, 'there should be an error');
                assert.strictEqual(err.code, '000610');

                callback();
              }
            });
        }
      ],
      function () {
        done();
      });
  });
});

describe('connection.fetchResult() synchronous errors', function () {
  const connection = snowflake.createConnection(connectionOptions);

  const testCases =
    [
      {
        name: 'missing options',
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_OPTIONS
      },
      {
        name: 'undefined options',
        options: undefined,
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_OPTIONS
      },
      {
        name: 'null options',
        options: null,
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_OPTIONS
      },
      {
        name: 'invalid options',
        options: 'invalid',
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_OPTIONS
      },
      {
        name: 'missing query id',
        options: {},
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'undefined query id',
        options:
          {
            queryId: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'null query id',
        options:
          {
            queryId: null
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'invalid query id',
        options:
          {
            queryId: 0
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_QUERY_ID
      },
      {
        name: 'invalid complete',
        options:
          {
            queryId: '',
            complete: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_COMPLETE
      },
      {
        name: 'invalid streamResult',
        options:
          {
            queryId: '',
            streamResult: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_STREAM_RESULT
      },
      {
        name: 'invalid fetchAsString',
        options:
          {
            queryId: '',
            fetchAsString: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_FETCH_AS_STRING
      },
      {
        name: 'invalid fetchAsString values',
        options:
          {
            queryId: '',
            fetchAsString: ['invalid']
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_FETCH_AS_STRING_VALUES
      }
    ];

  const createItCallback = function (testCase) {
    return function () {
      let error = null;

      try {
        connection.fetchResult(testCase.options);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  let index, length, testCase;
  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});

describe('connection.fetchResult() statement successful', function () {
  const connection = snowflake.createConnection(connectionOptions);
  const queryId = 'df2852ef-e082-4bb3-94a4-e540bf0e70c6';

  it('statement api', function (done) {
    let statement;

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');

            callback();
          });
        },
        function (callback) {
          statement = connection.fetchResult(
            {
              queryId: queryId,
              complete: function (err, stmt) {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statement,
                  'the fetchRow() callback should be invoked with the statement');

                // we should only have one column c1
                const columns = statement.getColumns();
                assert.ok(Util.isArray(columns));
                assert.strictEqual(columns.length, 1);
                assert.ok(Util.isObject(columns[0]));
                assert.strictEqual(columns[0].getName(), 'c1');

                assert.strictEqual(statement.getNumRows(), 1);
                assert.ok(Util.isObject(statement.getSessionState()));

                testStatementFetchRows(statement);

                callback();
              }
            });

          testStatementFetchRows(statement);

          // the query id should be the same as what was passed in
          assert.strictEqual(statement.getStatementId(), queryId);
          assert.strictEqual(statement.getQueryId(), queryId);

          // the sql text and request id should be undefined
          assert.strictEqual(statement.getSqlText(), undefined);
          assert.strictEqual(statement.getRequestId(), undefined);

          // the rest of the properties won't be available until the result is
          // available (some of them will only be available if the statement
          // succeeds)
          assert.strictEqual(statement.getColumns(), undefined);
          assert.strictEqual(statement.getNumRows(), undefined);
          assert.strictEqual(statement.getSessionState(), undefined);
        },
        function (callback) {
          const rows = [];
          statement.fetchRows(
            {
              each: function (row) {
                rows.push(row);
              },
              end: function (err, stmt) {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statement,
                  'the end() callback should be invoked with the statement');
                assert.strictEqual(rows.length, 1, 'there should only be one row');
                assert.strictEqual(rows[0].getColumnValue('c1'), 1,
                  'the row should only have one column c1 and its value ' +
                  'should be 1');

                callback();
              }
            });
        }
      ],
      function () {
        done();
      });
  });
});

describe('connection.fetchResult() statement failure', function () {
  const connection = snowflake.createConnection(connectionOptions);
  const queryId = '13f12818-de4c-41d2-bf19-f115ee8a5cc1';

  it('statement api', function (done) {
    let statement;

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');

            callback();
          });
        },
        function (callback) {
          statement = connection.fetchResult(
            {
              queryId: queryId,
              complete: function (err, stmt) {
                assert.ok(err, 'there should be an error');
                assert.strictEqual(stmt, statement,
                  'the execute() callback should be invoked with the statement');

                assert.strictEqual(statement.getColumns(), undefined);
                assert.strictEqual(statement.getNumRows(), undefined);
                assert.strictEqual(statement.getSessionState(), undefined);

                assert.ok(Util.string.isNotNullOrEmpty(statement.getStatementId()));
                assert.ok(Util.string.isNotNullOrEmpty(statement.getQueryId()));

                callback();
              }
            });

          testStatementFetchRows(statement);

          // the query id should be the same as what was passed in
          assert.strictEqual(statement.getStatementId(), queryId);
          assert.strictEqual(statement.getQueryId(), queryId);

          // the sql text and request id should be undefined
          assert.strictEqual(statement.getSqlText(), undefined);
          assert.strictEqual(statement.getRequestId(), undefined);

          // the rest of the properties won't be available until the result is
          // available (some of them will only be available if the statement
          // succeeds)
          assert.strictEqual(statement.getColumns(), undefined);
          assert.strictEqual(statement.getNumRows(), undefined);
          assert.strictEqual(statement.getSessionState(), undefined);
        },
        function (callback) {
          testStatementFetchRows(statement);

          statement.fetchRows(
            {
              each: function () {
              },
              end: function (err, stmt) {
                assert.ok(err, 'there should be an error');
                assert.strictEqual(stmt, statement,
                  'the execute() callback should be invoked with the statement');

                callback();
              }
            });
        }
      ],
      function () {
        done();
      });
  });
});

describe('statement.cancel()', function () {
  it('cancel a statement before it has been executed', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    const statement = connection.execute(
      {
        sqlText: 'select 1 as "c1";',
        requestId: 'foobar'
      });

    statement.cancel(function (err, stmt) {
      assert.ok(err, 'there should be an error');
      assert.strictEqual(stmt, statement,
        'the cancel() callback should be invoked with the statement');
      done();
    });
  });

  it('cancel a running statement', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    connection.connect(function (err) {
      assert.ok(!err, 'should not get an error');

      const statement = connection.execute(
        {
          sqlText: 'select count(*) from table(generator(timelimit=>10));',
          requestId: 'b97fee20-a805-11e5-a0ab-ddd3321ed586',
          complete: function (err) {
            assert.ok(err, 'there should be an error');
            assert.strictEqual(err.sqlState, '57014',
              'the error should have the right sql state');

            context.completed = true;
            if (context.canceled) {
              done();
            }
          }
        });

      const context =
        {
          completed: false,
          canceled: false
        };

      setTimeout(function () {
        statement.cancel(function (err, stmt) {
          assert.ok(!err, 'there should be no error');
          assert.strictEqual(stmt, statement,
            'the cancel() callback should be invoked with the statement');

          context.canceled = true;
          if (context.completed) {
            done();
          }
        });
      }, 0);
    });
  });

  it('cancel a statement that doesn\'t exist', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    const statement = connection.fetchResult(
      {
        queryId: 'foobar'
      });

    statement.cancel(function (err, stmt) {
      assert.ok(err, 'there should be an error');
      assert.strictEqual(stmt, statement,
        'the cancel() callback should be invoked with the statement');
      done();
    });
  });

  it('cancel a successful statement', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    const statement = connection.fetchResult(
      {
        queryId: 'df2852ef-e082-4bb3-94a4-e540bf0e70c6'
      });

    statement.cancel(function (err, stmt) {
      assert.ok(err, 'there should be an error');
      assert.strictEqual(stmt, statement,
        'the cancel() callback should be invoked with the statement');
      done();
    });
  });

  it('cancel a failed statement', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    const statement = connection.fetchResult(
      {
        queryId: '13f12818-de4c-41d2-bf19-f115ee8a5cc1'
      });

    statement.cancel(function (err, stmt) {
      assert.ok(err, 'there should be an error');
      assert.strictEqual(stmt, statement,
        'the cancel() callback should be invoked with the statement');
      done();
    });
  });
});

describe('connection.getResultsFromQueryId() asynchronous errors', function () {
  const queryId = '00000000-0000-0000-0000-000000000000';

  it('not success status', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    async.series(
      [
        function (callback) {
          connection.connect(function (err) {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        async function () {
          try {
            await connection.getResultsFromQueryId({ queryId: queryId });
            assert.fail();
          } catch (err) {
            assert.strictEqual(err.code, ErrorCodes.ERR_GET_RESULTS_QUERY_ID_NOT_SUCCESS_STATUS);
          }
        },
        function (callback) {
          connection.destroy(function (err) {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        }
      ],
      done
    );
  });
});

describe('connection.getResultsFromQueryId() synchronous errors', function () {
  const connection = snowflake.createConnection(connectionOptions);

  const testCases =
    [
      {
        name: 'missing queryId',
        options: {},
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'undefined queryId',
        options: { queryId: undefined },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'null queryId',
        options: { queryId: null },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'non-string queryId',
        options: { queryId: 123 },
        errorCode: ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID
      },
      {
        name: 'invalid queryId',
        options: { queryId: 'invalidQueryId' },
        errorCode: ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID
      }
    ];

  testCases.forEach(testCase => {
    it(testCase.name, async function () {
      try {
        await connection.getResultsFromQueryId(testCase.options);
      } catch (err) {
        assert.strictEqual(err.code, testCase.errorCode);
      }
    });
  });
});

describe('connection.getQueryStatus() synchronous errors', function () {
  const connection = snowflake.createConnection(connectionOptions);

  const testCases =
    [
      {
        name: 'undefined queryId',
        queryId: undefined,
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'null queryId',
        queryId: null,
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'non-string queryId',
        queryId: 123,
        errorCode: ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID
      },
      {
        name: 'invalid queryId',
        queryId: 'invalidQueryId',
        errorCode: ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID
      }
    ];

  testCases.forEach(testCase => {
    it(testCase.name, async function () {
      try {
        await connection.getQueryStatus(testCase.queryId);
      } catch (err) {
        assert.strictEqual(err.code, testCase.errorCode);
      }
    });
  });
});

describe('connection.getQueryStatusThrowIfError() synchronous errors', function () {
  const connection = snowflake.createConnection(connectionOptions);

  const testCases =
    [
      {
        name: 'undefined queryId',
        queryId: undefined,
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'null queryId',
        queryId: null,
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'non-string queryId',
        queryId: 123,
        errorCode: ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID
      },
      {
        name: 'invalid queryId',
        queryId: 'invalidQueryId',
        errorCode: ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID
      }
    ];

  testCases.forEach(testCase => {
    it(testCase.name, async function () {
      try {
        await connection.getQueryStatusThrowIfError(testCase.queryId);
      } catch (err) {
        assert.strictEqual(err.code, testCase.errorCode);
      }
    });
  });
});

describe('snowflake.isStillRunning()', function () {
  const connection = snowflake.createConnection(connectionOptions);

  const testCases =
    [
      {
        name: 'Running',
        status: QueryStatus.RUNNING,
        expectedValue: true
      },
      {
        name: 'Aborting',
        status: QueryStatus.ABORTING,
        expectedValue: false
      },
      {
        name: 'Success',
        status: QueryStatus.SUCCESS,
        expectedValue: false
      },
      {
        name: 'Failed with error',
        status: QueryStatus.FAILED_WITH_ERROR,
        expectedValue: false
      },
      {
        name: 'Aborted',
        status: QueryStatus.ABORTED,
        expectedValue: false
      },
      {
        name: 'Queued',
        status: QueryStatus.QUEUED,
        expectedValue: true
      },
      {
        name: 'Failed with incident',
        status: QueryStatus.FAILED_WITH_INCIDENT,
        expectedValue: false
      },
      {
        name: 'Disconnected',
        status: QueryStatus.DISCONNECTED,
        expectedValue: false
      },
      {
        name: 'Resuming warehouse',
        status: QueryStatus.RESUMING_WAREHOUSE,
        expectedValue: true
      },
      {
        name: 'Queued repairing warehouse',
        status: QueryStatus.QUEUED_REPARING_WAREHOUSE,
        expectedValue: true
      },
      {
        name: 'Restarted',
        status: QueryStatus.RESTARTED,
        expectedValue: false
      },
      {
        name: 'Blocked',
        status: QueryStatus.BLOCKED,
        expectedValue: false
      },
      {
        name: 'No data',
        status: QueryStatus.NO_DATA,
        expectedValue: true
      },
    ];

  testCases.forEach(testCase => {
    it(testCase.name, function () {
      assert.strictEqual(testCase.expectedValue, connection.isStillRunning(testCase.status));
    });
  });
});

describe('snowflake.isAnError()', function () {
  const connection = snowflake.createConnection(connectionOptions);

  const testCases =
    [
      {
        name: 'Running',
        status: QueryStatus.RUNNING,
        expectedValue: false
      },
      {
        name: 'Aborting',
        status: QueryStatus.ABORTING,
        expectedValue: true
      },
      {
        name: 'Success',
        status: QueryStatus.SUCCESS,
        expectedValue: false
      },
      {
        name: 'Failed with error',
        status: QueryStatus.FAILED_WITH_ERROR,
        expectedValue: true
      },
      {
        name: 'Aborted',
        status: QueryStatus.ABORTED,
        expectedValue: true
      },
      {
        name: 'Queued',
        status: QueryStatus.QUEUED,
        expectedValue: false
      },
      {
        name: 'Failed with incident',
        status: QueryStatus.FAILED_WITH_INCIDENT,
        expectedValue: true
      },
      {
        name: 'Disconnected',
        status: QueryStatus.DISCONNECTED,
        expectedValue: true
      },
      {
        name: 'Resuming warehouse',
        status: QueryStatus.RESUMING_WAREHOUSE,
        expectedValue: false
      },
      {
        name: 'Queued repairing warehouse',
        status: QueryStatus.QUEUED_REPARING_WAREHOUSE,
        expectedValue: false
      },
      {
        name: 'Restarted',
        status: QueryStatus.RESTARTED,
        expectedValue: false
      },
      {
        name: 'Blocked',
        status: QueryStatus.BLOCKED,
        expectedValue: true
      },
      {
        name: 'No data',
        status: QueryStatus.NO_DATA,
        expectedValue: false
      },
    ];

  testCases.forEach(testCase => {
    it(testCase.name, function () {
      assert.strictEqual(testCase.expectedValue, connection.isAnError(testCase.status));
    });
  });
});

describe('connection.destroy()', function () {
  it('destroy without connecting', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    connection.destroy(function (err, conn) {
      assert.ok(err);
      assert.strictEqual(
        err.code, ErrorCodes.ERR_CONN_DESTROY_STATUS_PRISTINE);
      assert.strictEqual(conn, connection,
        'the logout() callback should be invoked with the connection');
      done();
    });
  });

  it('destroy while connecting', function (done) {
    const connection = snowflake.createConnection(connectionOptions);

    const context =
      {
        connectcomplete: false,
        destroycomplete: false
      };

    connection.connect(function (err, conn) {
      assert.ok(!err, 'there should be no error');
      assert.strictEqual(conn, connection,
        'the connect() callback should be invoked with the connection');

      context.connectcomplete = true;
      if (context.destroycomplete) {
        done();
      }
    });

    setTimeout(() =>
      connection.destroy(function (err, conn) {
        assert.ok(!err, 'there should be no error');
        assert.strictEqual(conn, connection, 'the logout() callback should be invoked with the connection');
        context.destroycomplete = true;
        if (context.connectcomplete) {
          done();
        }
      })
    , 10 // if destroy executes when connect is still in pristine state the error occurs. Destroy has to be slowed down a bit.
    );
  });

  it('destroy after connected', function (done) {
    const connection = snowflake.createConnection(connectionOptions);

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');
            callback();
          });
        },
        function (callback) {
          connection.destroy(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the logout() callback should be invoked with the connection');
            callback();
          });
        }
      ],
      function () {
        done();
      });
  });

  it('destroy while disconnected', function (done) {
    const connection = snowflake.createConnection(connectionOptions);

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');
            callback();
          });
        },
        function (callback) {
          connection.destroy(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the logout() callback should be invoked with the connection');
            callback();
          });
        },
        function (callback) {
          // connection.destroy() should fail at this point because the
          // connection has been destroyed
          connection.destroy(function (err, conn) {
            assert.ok(err, 'there should be an error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the connection');
            assert.strictEqual(
              err.code, ErrorCodes.ERR_CONN_DESTROY_STATUS_DISCONNECTED);
            callback();
          });
        }
      ],
      function () {
        done();
      });
  });
});

describe('serialize connection', function () {
  it('serialize before connecting', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    const serializedConnection = connection.serialize();

    assert.ok(serializedConnection);
    done();
  });

  it('serialize when connected', function (done) {
    const connection = snowflake.createConnection(connectionOptions);
    let statementFirst;
    let statementSecond;

    async.series(
      [
        function (callback) {
          const sqlText = 'select 1 as "c1";';
          const requestId = 'foobar';

          connection.connect(function (err) {
            assert.ok(!err);

            statementFirst = connection.execute(
              {
                sqlText: sqlText,
                requestId: requestId,
                complete: function (err, stmt) {
                  assert.ok(!err, 'there should be no error');
                  assert.strictEqual(stmt, statementFirst,
                    'the execute() callback should be invoked with the ' +
                    'statement');

                  callback();
                }
              });
          });
        },
        function (callback) {
          // serialize the connection and then deserialize it to get a copy of
          // the original connection
          const connectionCopy = snowflake.deserializeConnection(
            connectionOptionsDeserialize,
            snowflake.serializeConnection(connection));

          // execute a statement using the connection copy
          statementSecond = connectionCopy.execute(
            {
              sqlText: 'select 1 as "c2";',
              requestId: 'foobar',
              complete: function (err, stmt) {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statementSecond,
                  'the execute() callback should be invoked with the statement');

                callback();
              }
            });
        }
      ],
      function () {
        done();
      });
  });
});

describe('deserialize connection synchronous errors', function () {
  const testCases =
    [
      {
        name: 'missing serializedConnection',
        connectionOptions: connectionOptionsDeserialize,
        errorCode: ErrorCodes.ERR_CONN_DESERIALIZE_MISSING_CONFIG
      },
      {
        name: 'undefined serializedConnection',
        connectionOptions: connectionOptionsDeserialize,
        serializedConnection: undefined,
        errorCode: ErrorCodes.ERR_CONN_DESERIALIZE_MISSING_CONFIG
      },
      {
        name: 'null serializedConnection',
        connectionOptions: connectionOptionsDeserialize,
        serializedConnection: null,
        errorCode: ErrorCodes.ERR_CONN_DESERIALIZE_MISSING_CONFIG
      },
      {
        name: 'invalid serializedConnection: not a string',
        connectionOptions: connectionOptionsDeserialize,
        serializedConnection: 0,
        errorCode: ErrorCodes.ERR_CONN_DESERIALIZE_INVALID_CONFIG_TYPE
      },
      {
        name: 'invalid serializedConnection: not json',
        connectionOptions: connectionOptionsDeserialize,
        serializedConnection: 'invalid',
        errorCode: ErrorCodes.ERR_CONN_DESERIALIZE_INVALID_CONFIG_FORM
      }
    ];

  const createItCallback = function (testCase) {
    return function () {
      let error = null;

      try {
        snowflake.deserializeConnection(
          testCase.connectionOptions, testCase.serializedConnection);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  let index, length, testCase;
  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});

describe('snowflake.createConnection() SERVICE_NAME', function () {
  it('createConnection() returns connection including SERVICE_NAME', function (done) {
    const connection = snowflake.createConnection(connectionOptionsServiceName);
    async.series([
      function (callback) {
        connection.connect(function (err) {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback) {
        // SERVICE_NAME is returned.
        assert.equal('fakeservicename', connection.getServiceName());
        callback();
      },
      function (callback) {
        // submitting a query with SERVICE_NAME
        connection.execute(
          {
            sqlText: 'select * from faketable',
            requestId: 'foobar',
            complete: function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            }
          }
        );
      },
      function (callback) {
        // SERVICE_NAME is updated.
        assert.equal('fakeservicename2', connection.getServiceName());
        callback();
      }
    ],
    done);
  });
});

describe('snowflake.createConnection() CLIENT_SESSION_KEEP_ALIVE', function () {
  it('createConnection() returns connection including CLIENT_SESSION_KEEP_ALIVE', function (done) {
    const connection = snowflake.createConnection(connectionOptionsClientSessionKeepAlive);
    async.series([
      function (callback) {
        connection.connect(function (err) {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback) {
        // CLIENT_SESSION_KEEP_ALIVE is returned.
        assert.equal(true, connection.getClientSessionKeepAlive());
        assert.equal(1800, connection.getClientSessionKeepAliveHeartbeatFrequency());
        callback();
      },
      function (callback) {
        connection.destroy(function (err) {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      }
    ],
    done);
  });


  if (process.env.RUN_MANUAL_TESTS_ONLY === 'true') {
    it('When connect with keep alive interval then callback for connect not called in heartbeat', function (done) {
      //   This test requires awaiting the whole timeout of heartbeat request, therefore it was marked as manual to avoid delaying the other tests' execution.
      //   Value of the timeout ('frequency') is customizable, but only to the point of a minimal value (calculated based on the constant: HEARTBEAT_FREQUENCY_MASTER_VALIDITY).
      let callbackCallCount = 0;
      const SECONDS_TO_MILLISECONDS_MULTIPLIER = 1000;
      function testCallbackWithCounterIncrementation(err) {
        assert.ok(!err, JSON.stringify(err));
        callbackCallCount++;
      }
      const connection = snowflake.createConnection(connectionOptionsClientSessionKeepAlive);
        
      async.series([
        function (callback) {
          connection.connect(function (err) {
            testCallbackWithCounterIncrementation(err);
            callback();
          });
        },
        async function () {
          const msForHeartbeatToRunTwice = connection.getClientSessionKeepAliveHeartbeatFrequency() * SECONDS_TO_MILLISECONDS_MULTIPLIER * 2;
          await testUtil.sleepAsync(msForHeartbeatToRunTwice);
          assert.equal(callbackCallCount, 1, 'Connect callback called more than once or never');
        },
        function (callback) {
          connection.destroy(function (err) {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        }
      ],
      done);
    });
  }
});

describe('snowflake.createConnection() JS_TREAT_INTEGER_AS_BIGINT', function () {
  it('createConnection() returns connection including JS_TREAT_INTEGER_AS_BIGINT', function (done) {
    const connection = snowflake.createConnection(connectionOptionsTreatIntegerAsBigInt);
    async.series([
      function (callback) {
        connection.connect(function (err) {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback) {
        // JS_TREAT_INTEGER_AS_BIGINT is returned.
        assert.equal(true, connection.getJsTreatIntegerAsBigInt());
        callback();
      },
      function (callback) {
        connection.destroy(function (err) {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      }
    ],
    done);
  });
});

describe('snowflake.destroyConnection()', function () {
  [
    {
      errorName: 'SESSION_GONE',
      connectionOptions: connectionOptionsForSessionGone
    },
    {
      errorName: 'SESSION_TOKEN_EXPIRED',
      connectionOptions: connectionOptionsForSessionExpired
    }
  ].forEach(({ errorName, connectionOptions }) => {
    it(`destroyConnection() transitions to Disconnected state after receiving ${errorName} error`, async () => {
      const connection = snowflake.createConnection(connectionOptions);
      await connectAsync(connection);

      await assert.doesNotReject(destroyConnectionAsync(connection), `destroying connection failed when ${errorName} error was received`);
    });
  });
});

describe('snowflake.connect() with 504', function () {
  /*
   * The connection is retired three times and get success.
   */
  it('retry 504', function (done) {
    const connection = snowflake.createConnection(connectionOptionsFor504);
    async.series([
      function (callback) {
        connection.connect(function (err) {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback) {
        connection.destroy(function (err) {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      }
    ],
    done);
  });
});

// TODO: test large results
// TODO: test token renewal
// TODO: test network errors