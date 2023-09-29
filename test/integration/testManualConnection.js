const snowflake = require("./../../lib/snowflake");
const async = require("async");
const assert = require("assert");
const connOption = require("./connectionOptions");
const testUtil = require("./testUtil");

if (process.env.RUN_MANUAL_TESTS_ONLY == "true") {
  describe.only("Run manual tests", function () {
    describe("Connection test - external browser", function () {
      it("Simple Connect", function (done) {
        const connection = snowflake.createConnection(
          connOption.externalBrowser
        );

        connection.connectAsync(function (err, connection) {
          try {
            assert.ok(connection.isUp(), "not active");
            testUtil.destroyConnection(connection, function (err, r) {
              try {
                assert.ok(!connection.isUp(), "not active");
                done();
              } catch (err) {
                done(err);
              }
            });
          } catch (err) {
            done(err);
          }
        });
      });

      it("Connect - external browser timeout", function (done) {
        const connection = snowflake.createConnection(
          connOption.externalBrowserWithShortTimeout
        );

        connection.connectAsync(function (err) {
          try {
            const browserActionTimeout =
              connOption.externalBrowserWithShortTimeout.browserActionTimeout;
            assert.ok(
              err,
              `Browser action timed out after ${browserActionTimeout} ms.`
            );
            done();
          } catch (err) {
            done(err);
          }
        });
      });

      it("Mismatched Username", function (done) {
        const connection = snowflake.createConnection(
          connOption.externalBrowserMismatchUser
        );
        connection.connectAsync(function (err) {
          try {
            assert.ok(
              err,
              "Logged in with different user than one on connection string"
            );
            assert.equal(
              "The user you were trying to authenticate as differs from the user currently logged in at the IDP.",
              err["message"]
            );
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe("Connection test - oauth", function () {
      it("Simple Connect", function (done) {
        const connection = snowflake.createConnection(connOption.oauth);

        async.series([
          function (callback) {
            connection.connect(function (err) {
              done(err);
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(connection.isUp(), "not active");
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), "still active");
            callback();
          },
        ]);
      });

      it("Mismatched Username", function (done) {
        const connection = snowflake.createConnection(
          connOption.oauthMismatchUser
        );
        connection.connect(function (err) {
          try {
            assert.ok(
              err,
              "Logged in with different user than one on connection string"
            );
            assert.equal(
              "The user you were trying to authenticate as differs from the user tied to the access token.",
              err["message"]
            );
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe("Connection test - okta", function () {
      it("Simple Connect", function (done) {
        const connection = snowflake.createConnection(connOption.okta);

        async.series([
          function (callback) {
            connection.connectAsync(function (err) {
              done(err);
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(connection.isUp(), "not active");
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), "still active");
            callback();
          },
        ]);
      });
    });

    describe("Connection test - keypair", function () {
      it("Simple Connect - specify private key", function (done) {
        const connection = snowflake.createConnection(
          connOption.keypairPrivateKey
        );

        async.series([
          function (callback) {
            connection.connect(function (err) {
              done(err);
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(connection.isUp(), "not active");
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), "still active");
            callback();
          },
        ]);
      });

      it("Simple Connect - specify encrypted private key path and passphrase", function (done) {
        const connection = snowflake.createConnection(
          connOption.keypairPathEncrypted
        );

        async.series([
          function (callback) {
            connection.connect(function (err) {
              done(err);
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(connection.isUp(), "not active");
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), "still active");
            callback();
          },
        ]);
      });

      it("Simple Connect - specify unencrypted private key path without passphrase", function (done) {
        const connection = snowflake.createConnection(
          connOption.keypairPathEncrypted
        );

        async.series([
          function (callback) {
            connection.connect(function (err) {
              done(err);
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(connection.isUp(), "not active");
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), "still active");
            callback();
          },
        ]);
      });

      it("Wrong JWT token", function (done) {
        const connection = snowflake.createConnection(
          connOption.keypairWrongToken
        );
        connection.connect(function (err) {
          try {
            assert.ok(err, "Incorrect JWT token is passed.");
            assert.equal("JWT token is invalid.", err["message"]);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });
  });

  describe.only('keepAlive test', function () {
    let connection;
    const loopCount = 10;
    const rowCount = 10;
    const tableName = 'test_keepalive000';

    const createTableWithRandomStrings = `CREATE OR REPLACE TABLE ${tableName} (value string)
    AS select randstr(200, random()) from table (generator(rowcount =>${rowCount}))`;

    before(async () => {
      connection = snowflake.createConnection(connOption.valid);
      await testUtil.connectAsync(connection);
      await testUtil.executeCmdAsync(connection, createTableWithRandomStrings);
    });
    after(async () => {
      snowflake.configure({keepAlive: true});
      await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
      await testUtil.destroyConnectionAsync(connection);
    });

    function executeSingleQuery() {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        connection.execute({
          sqlText: `SELECT VALUE
                      from ${tableName} limit ${rowCount};`,
          streamResult: true,
          complete: function (err, stmt) {
            if (err) {
              throw err;
            } else {
              stmt.streamRows()
                .on('error', function (err) {
                  throw err;
                })
                .on('data', function (row) {
                  return;
                })
                .on('end', function (row) {
                  const end = Date.now();
                  const time = end - start;
                  resolve(time);
                });
            }
          }
        });
      });
    }

    it('Verify that requests working faster with keep alive', async function () {
      let sumWithKeepAlive = 0;
      let sumWithoutKeepAlive = 0;
      for (let count = 1; count <= loopCount; count++) {
        let time = await executeSingleQuery();
        sumWithKeepAlive += time;
      }
      snowflake.configure({keepAlive: false});
      for (let count = 1; count <= loopCount; count++) {
        let time = await executeSingleQuery();
        sumWithoutKeepAlive += time;
      }
      console.log(`Sum of time without keep alive: ${sumWithoutKeepAlive}. Sum of time with keep alive:: ${sumWithKeepAlive}`);
      assert.ok(sumWithoutKeepAlive * 0.66 > sumWithKeepAlive, 'With keep alive the queries should work faster');
    });
  });
}
