/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const snowflake = require('./../../lib/snowflake');
const async = require('async');
const assert = require('assert');
const connOption = require('./connectionOptions');
const testUtil = require('./testUtil');
const Logger = require('../../lib/logger');
const Util = require('../../lib/util');
const JsonCredentialManager = require('../../lib/authentication/secure_storage/json_credential_manager');

if (process.env.RUN_MANUAL_TESTS_ONLY === 'true') {
  describe('Run manual tests', function () {
    describe('Connection test - external browser', function () {
      it('Simple Connect', function (done) {
        const connection = snowflake.createConnection(
          connOption.externalBrowser
        );

        connection.connectAsync(function (err, connection) {
          try {
            assert.ok(connection.isUp(), 'not active');
            testUtil.destroyConnection(connection, function () {
              try {
                assert.ok(!connection.isUp(), 'not active');
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

      it('Connect - external browser timeout', function (done) {
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

      it('Mismatched Username', function (done) {
        const connection = snowflake.createConnection(
          connOption.externalBrowserMismatchUser
        );
        connection.connectAsync(function (err) {
          try {
            assert.ok(
              err,
              'Logged in with different user than one on connection string'
            );
            assert.equal(
              'The user you were trying to authenticate as differs from the user currently logged in at the IDP.',
              err['message']
            );
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe('Connection - ID Token authenticator', function () {
      const connectionOption = { ...connOption.externalBrowser, clientStoreTemporaryCredential: true };
      const key = Util.buildCredentialCacheKey(connectionOption.host, connectionOption.username, 'ID_TOKEN');
      const defaultCredentialManager = new JsonCredentialManager();
      let oldToken;
      before( async () => {
        await defaultCredentialManager.remove(key);
      });

      it('test - obtain the id token from the server and save it on the local storage', function (done) {
        const connection = snowflake.createConnection(connectionOption);
        connection.connectAsync(function (err) {
          try {
            assert.ok(!err);
            done();
          } catch (err){
            done(err);
          }
        });
      });

      it('test - the token is saved in the credential manager correctly', function (done) {
        defaultCredentialManager.read(key).then((idToken) => {
          try {
            oldToken = idToken;
            assert.notStrictEqual(idToken, null);
            done();
          } catch (err){
            done(err);
          }
        });
      });


      // Web Browser should not be open.
      it('test - id token authentication',  function (done) {
        const idTokenConnection = snowflake.createConnection(connectionOption);
        try {
          idTokenConnection.connectAsync(function (err) {
            assert.ok(!err);
            done();
          });
        } catch (err) {
          done(err);
        }
      });

      // Web Browser should be open.
      it('test - id token reauthentication', function (done) {
        defaultCredentialManager.write(key, '1234').then(() => {
          const wrongTokenConnection = snowflake.createConnection(connectionOption);
          wrongTokenConnection.connectAsync(function (err) {
            assert.ok(!err);
            done();
          });
        });
      });

      //Compare two idToken. Those two should be different.
      it('test - the token is refreshed', function (done) {
        oldToken = undefined;
        defaultCredentialManager.read(key).then((idToken) => {
          try {
            assert.notStrictEqual(idToken, oldToken);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe('Connection test - oauth', function () {
      it('Simple Connect', function (done) {
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
            assert.ok(connection.isUp(), 'not active');
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), 'still active');
            callback();
          },
        ]);
      });

      it('Mismatched Username', function (done) {
        const connection = snowflake.createConnection(
          connOption.oauthMismatchUser
        );
        connection.connect(function (err) {
          try {
            assert.ok(
              err,
              'Logged in with different user than one on connection string'
            );
            assert.equal(
              'The user you were trying to authenticate as differs from the user tied to the access token.',
              err['message']
            );
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe('Connection test - okta', function () {
      it('Simple Connect', function (done) {
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
            assert.ok(connection.isUp(), 'not active');
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), 'still active');
            callback();
          },
        ]);
      });
    });

    describe('Connection - MFA authenticator', function () {
      const connectionOption = { ...connOption.valid, authenticator: 'USERNAME_PASSWORD_MFA', clientRequestMFAToken: true };
      const key = Util.buildCredentialCacheKey(connectionOption.host, connectionOption.username, 'USERNAME_PASSWORD_MFA');
      const defaultCredentialManager = new JsonCredentialManager();
      let oldToken;
  
      before(async () => {
        defaultCredentialManager.remove(key);
      });
  
      it('test - obtain the id token from the server and save it on the local storage', function (done) {
        const connection = snowflake.createConnection(connectionOption);
        connection.connectAsync(function (err) {
          try {
            assert.ok(!err);
            done();
          } catch (err){
            done(err);
          }
        });
      });
  
      it('test - the token is saved in the credential manager correctly', function (done) {
        defaultCredentialManager.read(key).then((mfaToken) => {
          oldToken = mfaToken;
          assert.notStrictEqual(mfaToken, null);
          done();
        });
      });
  
  
      // Skip the Duo authentication.
  
      it('test - id token authentication',  function (done) {
        const idTokenConnection = snowflake.createConnection(connectionOption);
        idTokenConnection.connectAsync(function (err) {
          assert.ok(!err);
          done();
        });
      });
  
      // Duo authentication should be executed again.
      it('test - id token reauthentication', function (done) {
        defaultCredentialManager.write(key, '1234').then(() => {
          const wrongTokenConnection = snowflake.createConnection(connectionOption);
          wrongTokenConnection.connectAsync(function (err) {
            assert.ok(!err);
            done();
          });
        });
      });
  
      //Compare two mfaToken. Those two should be different.
      it('test - the token is refreshed', function (done) {
        defaultCredentialManager.read(key).then((mfaToken) => {
          assert.notStrictEqual(mfaToken, oldToken);
          done();
        });
      });
    });

    describe('Connection test - keypair', function () {
      it('Simple Connect - specify private key', function (done) {
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
            assert.ok(connection.isUp(), 'not active');
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), 'still active');
            callback();
          },
        ]);
      });

      it('Simple Connect - specify encrypted private key path and passphrase', function (done) {
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
            assert.ok(connection.isUp(), 'not active');
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), 'still active');
            callback();
          },
        ]);
      });

      it('Simple Connect - specify unencrypted private key path without passphrase', function (done) {
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
            assert.ok(connection.isUp(), 'not active');
            callback();
          },
          function (callback) {
            connection.destroy(function (err) {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          },
          function (callback) {
            assert.ok(!connection.isUp(), 'still active');
            callback();
          },
        ]);
      });

      it('Wrong JWT token', function (done) {
        const connection = snowflake.createConnection(
          connOption.keypairWrongToken
        );
        connection.connect(function (err) {
          try {
            assert.ok(err, 'Incorrect JWT token is passed.');
            assert.equal('JWT token is invalid.', err['message']);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });
  });

  describe('keepAlive test', function () {
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
      snowflake.configure({ keepAlive: true });
      await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
      await testUtil.destroyConnectionAsync(connection);
    });

    function executeSingleQuery() {
      return new Promise((resolve) => {
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
                .on('data', function () {
                  return;
                })
                .on('end', function () {
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
        const time = await executeSingleQuery();
        sumWithKeepAlive += time;
      }
      snowflake.configure({ keepAlive: false });
      for (let count = 1; count <= loopCount; count++) {
        const time = await executeSingleQuery();
        sumWithoutKeepAlive += time;
      }
      Logger.getInstance().info(`Sum of time without keep alive: ${sumWithoutKeepAlive}. Sum of time with keep alive:: ${sumWithKeepAlive}`);
      assert.ok(sumWithoutKeepAlive * 0.66 > sumWithKeepAlive, 'With keep alive the queries should work faster');
    });
  });


  // Before run below tests you should prepare files connections.toml and token
  describe('Connection file configuration test', function () {
    afterEach( function () {
      delete process.env.SNOWFLAKE_HOME;
      delete process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
    });
    beforeEach( function () {
      snowflake.configure({ logLevel: 'DEBUG' });
    });

    it('test simple connection', async function () {
      await verifyConnectionWorks();
    });

    it('test connection with token', async function () {
      process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'aws-oauth';
      await verifyConnectionWorks();
    });

    it('test connection with token using accessUrl', async function () {
      process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'aws-oauth-accessUrl';
      await verifyConnectionWorks();
    });

    it('test connection with token from file', async function () {
      process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'aws-oauth-file';
      await verifyConnectionWorks();
    });

    it('test pool simple connection', async function () {
      await verifyPoolConnectionWorks();
    });

    it('test pool connection with token', async function () {
      process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'aws-oauth';
      await verifyPoolConnectionWorks();
    });

    it('test pool connection with token using accessUrl', async function () {
      process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'aws-oauth-accessUrl';
      await verifyPoolConnectionWorks();
    });

    it('test pool connection with token from file', async function () {
      process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'aws-oauth-file';
      await verifyPoolConnectionWorks();
    });

    async function verifyConnectionWorks(configuration) {
      const connection = snowflake.createConnection(configuration);
      await testUtil.connectAsync(connection);
      assert.ok(connection.isUp(), 'not active');
      await testUtil.executeCmdAsync(connection, 'Select 1');
      await testUtil.destroyConnectionAsync(connection);
    }
    async function verifyPoolConnectionWorks() {
      const connectionPool = snowflake.createPool(null, {
        max: 10,
        min: 2,
      });
      await connectionPool.use(async (clientConnection) => {
        return new Promise((resolve, reject) => {
          clientConnection.execute({
            sqlText: 'select 1;',
            complete: function (err) {
              if (err) {
                reject(err);
              }
              resolve();
            }
          });
        });
      });
    }
  });

}
