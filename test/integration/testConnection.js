/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const snowflake = require("./../../lib/snowflake");
const async = require("async");
const assert = require("assert");
const connOption = require("./connectionOptions");
const testUtil = require("./testUtil");
const Util = require("./../../lib/util");
const Core = require("./../../lib/core");
const stderr = require("test-console").stderr;

describe("Connection test", function () {
  it("return tokens in qaMode", function () {
    const coreInst = Core({
      qaMode: true,
      httpClientClass: require("./../../lib/http/node"),
      loggerClass: require("./../../lib/logger/node"),
      client: {
        version: Util.driverVersion,
        environment: process.versions,
      },
    });
    const connection = coreInst.createConnection(connOption.valid);
    assert.deepEqual(connection.getTokens(), {
      masterToken: undefined,
      masterTokenExpirationTime: undefined,
      sessionToken: undefined,
      sessionTokenExpirationTime: undefined,
    });
  });

  it("does not return tokens when not in qaMode", function () {
    const connection = snowflake.createConnection(connOption.valid);
    assert.deepEqual(connection.getTokens(), {});
  });
  it("Simple Connect", async function () {
    const connection = snowflake.createConnection(connOption.valid);

    await testUtil.connectAsync(connection);
    assert.ok(connection.isUp(), "not active");
    await testUtil.destroyConnectionAsync(connection);
    assert.ok(!connection.isUp(), "still active");
  });

  it("Wrong Username", function (done) {
    var connection = snowflake.createConnection(connOption.wrongUserName);
    connection.connect(function (err) {
      assert.ok(err, "Username is an empty string");
      assert.equal(
        "Incorrect username or password was specified.",
        err["message"]
      );
      done();
    });
  });

  it("Wrong Password", function (done) {
    var connection = snowflake.createConnection(connOption.wrongPwd);
    connection.connect(function (err) {
      assert.ok(err, "Password is an empty string");
      assert.equal(
        "Incorrect username or password was specified.",
        err["message"]
      );
      done();
    });
  });

  it("Multiple Client", function (done) {
    const totalConnections = 10;
    const connections = [];
    for (let i = 0; i < totalConnections; i++) {
      connections.push(snowflake.createConnection(connOption.valid));
    }
    let completedConnection = 0;
    for (let i = 0; i < totalConnections; i++) {
      connections[i].connect(function (err, conn) {
        testUtil.checkError(err);
        conn.execute({
          sqlText: "select 1",
          complete: function (err) {
            testUtil.checkError(err);
            testUtil.destroyConnection(conn, function () {});
            completedConnection++;
          },
        });
      });
    }
    const sleepMs = 500;
    const maxSleep = 60000;
    let sleepFromStartChecking = 0;

    const timeout = () =>
      setTimeout(() => {
        sleepFromStartChecking += sleepMs;
        if (completedConnection === totalConnections) {
          done();
        } else if (sleepFromStartChecking <= maxSleep) {
          timeout();
        } else {
          done(
            `Max after ${maxSleep} it's expected to complete ${totalConnections} but completed ${completedConnection}`
          );
        }
      }, sleepMs);

    timeout();
  });
});

describe("Connection test - validate default parameters", function () {
  it('Valid "warehouse" parameter', function () {
    const output = stderr.inspectSync(() => {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        warehouse: "testWarehouse",
        validateDefaultParameters: true,
      });
    });
    assert.deepEqual(output, []);
  });

  it('Invalid "warehouse" parameter', function () {
    const output = stderr.inspectSync(() => {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        waerhouse: "testWarehouse",
        validateDefaultParameters: true,
      });
    });
    assert.deepEqual(output, [
      '"waerhouse" is an unknown connection parameter\n',
      'Did you mean "warehouse"\n',
    ]);
  });

  it('Valid "database" parameter', function () {
    const output = stderr.inspectSync(() => {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        database: "testDatabase",
        validateDefaultParameters: true,
      });
    });
    assert.deepEqual(output, []);
  });

  it('Invalid "db" parameter', function () {
    const output = stderr.inspectSync(() => {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        db: "testDb",
        validateDefaultParameters: true,
      });
    });
    assert.deepEqual(output, ['"db" is an unknown connection parameter\n']);
  });

  it('Invalid "database" parameter', function () {
    const output = stderr.inspectSync(() => {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        datbse: "testDatabase",
        validateDefaultParameters: true,
      });
    });
    assert.deepEqual(output, [
      '"datbse" is an unknown connection parameter\n',
      'Did you mean "database"\n',
    ]);
  });

  it('Valid "schema" parameter', function () {
    const output = stderr.inspectSync(() => {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        schema: "testSchema",
        validateDefaultParameters: true,
      });
    });
    assert.deepEqual(output, []);
  });

  it('Invalid "schema" parameter', function () {
    const output = stderr.inspectSync(() => {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        shcema: "testSchema",
        validateDefaultParameters: true,
      });
    });
    assert.deepEqual(output, [
      '"shcema" is an unknown connection parameter\n',
      'Did you mean "schema"\n',
    ]);
  });
});

describe("Connection test - connection pool", function () {
  this.timeout(30000);

  it("1 min connection", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 10,
      min: 1,
    });

    assert.equal(connectionPool.max, 10);
    assert.equal(connectionPool.min, 1);
    assert.equal(connectionPool.size, 1);

    done();
  });

  it("5 min connection", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 10,
      min: 5,
    });

    assert.equal(connectionPool.max, 10);
    assert.equal(connectionPool.min, 5);
    assert.equal(connectionPool.size, 5);

    done();
  });

  it("10 min connection", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 10,
      min: 10,
    });

    assert.equal(connectionPool.max, 10);
    assert.equal(connectionPool.min, 10);
    assert.equal(connectionPool.size, 10);

    done();
  });

  it("min greater than max connection", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 5,
      min: 10,
    });

    assert.equal(connectionPool.max, 5);
    assert.equal(connectionPool.min, 5);
    assert.equal(connectionPool.size, 5);

    done();
  });

  it("1 max connection", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 1,
      min: 0,
    });

    assert.equal(connectionPool.max, 1);
    assert.equal(connectionPool.min, 0);

    // Acquire a connection
    const resourcePromise1 = connectionPool.acquire();
    assert.equal(connectionPool.size, 1);

    done();
  });

  it("1 max connection and acquire() more than 1", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 1,
      min: 0,
    });

    assert.equal(connectionPool.max, 1);
    assert.equal(connectionPool.min, 0);

    // Acquire 2 connections
    const resourcePromise1 = connectionPool.acquire();
    assert.equal(connectionPool.size, 1);
    const resourcePromise2 = connectionPool.acquire();
    assert.equal(connectionPool.size, 1);

    done();
  });

  it("5 max connection", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 5,
      min: 0,
    });

    assert.equal(connectionPool.max, 5);
    assert.equal(connectionPool.min, 0);

    // Acquire 5 connections
    const resourcePromise1 = connectionPool.acquire();
    assert.equal(connectionPool.size, 1);
    const resourcePromise2 = connectionPool.acquire();
    assert.equal(connectionPool.size, 2);
    const resourcePromise3 = connectionPool.acquire();
    assert.equal(connectionPool.size, 3);
    const resourcePromise4 = connectionPool.acquire();
    assert.equal(connectionPool.size, 4);
    const resourcePromise5 = connectionPool.acquire();
    assert.equal(connectionPool.size, 5);

    done();
  });

  it("5 max connections and acquire() more than 5", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 5,
      min: 0,
    });

    assert.equal(connectionPool.max, 5);
    assert.equal(connectionPool.min, 0);

    // Acquire 6 connections
    const resourcePromise1 = connectionPool.acquire();
    assert.equal(connectionPool.size, 1);
    const resourcePromise2 = connectionPool.acquire();
    assert.equal(connectionPool.size, 2);
    const resourcePromise3 = connectionPool.acquire();
    assert.equal(connectionPool.size, 3);
    const resourcePromise4 = connectionPool.acquire();
    assert.equal(connectionPool.size, 4);
    const resourcePromise5 = connectionPool.acquire();
    assert.equal(connectionPool.size, 5);
    const resourcePromise6 = connectionPool.acquire();
    assert.equal(connectionPool.size, 5);

    done();
  });

  it("10 max connection", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 10,
      min: 0,
    });

    assert.equal(connectionPool.max, 10);
    assert.equal(connectionPool.min, 0);

    // Acquire 10 connections
    const resourcePromise1 = connectionPool.acquire();
    assert.equal(connectionPool.size, 1);
    const resourcePromise2 = connectionPool.acquire();
    assert.equal(connectionPool.size, 2);
    const resourcePromise3 = connectionPool.acquire();
    assert.equal(connectionPool.size, 3);
    const resourcePromise4 = connectionPool.acquire();
    assert.equal(connectionPool.size, 4);
    const resourcePromise5 = connectionPool.acquire();
    assert.equal(connectionPool.size, 5);
    const resourcePromise6 = connectionPool.acquire();
    assert.equal(connectionPool.size, 6);
    const resourcePromise7 = connectionPool.acquire();
    assert.equal(connectionPool.size, 7);
    const resourcePromise8 = connectionPool.acquire();
    assert.equal(connectionPool.size, 8);
    const resourcePromise9 = connectionPool.acquire();
    assert.equal(connectionPool.size, 9);
    const resourcePromise10 = connectionPool.acquire();
    assert.equal(connectionPool.size, 10);

    done();
  });

  it("10 max connections and acquire() more than 10", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 10,
      min: 0,
    });

    assert.equal(connectionPool.max, 10);
    assert.equal(connectionPool.min, 0);

    // Acquire 11 connections
    const resourcePromise1 = connectionPool.acquire();
    assert.equal(connectionPool.size, 1);
    const resourcePromise2 = connectionPool.acquire();
    assert.equal(connectionPool.size, 2);
    const resourcePromise3 = connectionPool.acquire();
    assert.equal(connectionPool.size, 3);
    const resourcePromise4 = connectionPool.acquire();
    assert.equal(connectionPool.size, 4);
    const resourcePromise5 = connectionPool.acquire();
    assert.equal(connectionPool.size, 5);
    const resourcePromise6 = connectionPool.acquire();
    assert.equal(connectionPool.size, 6);
    const resourcePromise7 = connectionPool.acquire();
    assert.equal(connectionPool.size, 7);
    const resourcePromise8 = connectionPool.acquire();
    assert.equal(connectionPool.size, 8);
    const resourcePromise9 = connectionPool.acquire();
    assert.equal(connectionPool.size, 9);
    const resourcePromise10 = connectionPool.acquire();
    assert.equal(connectionPool.size, 10);
    const resourcePromise11 = connectionPool.acquire();
    assert.equal(connectionPool.size, 10);

    done();
  });

  it("acquire() 1 connection and release()", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 5,
      min: 0,
    });

    // Acquire one connection
    const resourcePromise1 = connectionPool.acquire();

    assert.equal(connectionPool.size, 1);
    assert.equal(connectionPool.pending, 1);
    assert.equal(connectionPool.spareResourceCapacity, 4);

    async.series(
      [
        function (callback) {
          // Once acquired, release the connection
          resourcePromise1.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 0);

            connectionPool.release(connection).then(() => {
              // One connection should be available for use
              assert.equal(connectionPool.available, 1);
              callback();
            });
          });
        },
      ],
      done
    );
  });

  it("acquire() 5 connections and release()", function (done) {
    // Create the connection pool
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 5,
      min: 0,
    });

    // Acquire 5 connections
    const resourcePromise1 = connectionPool.acquire();
    const resourcePromise2 = connectionPool.acquire();
    const resourcePromise3 = connectionPool.acquire();
    const resourcePromise4 = connectionPool.acquire();
    const resourcePromise5 = connectionPool.acquire();

    assert.equal(connectionPool.size, 5);
    assert.equal(connectionPool.pending, 5);
    assert.equal(connectionPool.spareResourceCapacity, 0);

    async.series(
      [
        function (callback) {
          // Once acquired, release the connection
          resourcePromise1.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 4);

            connectionPool.release(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback) {
          // Once acquired, release the connection
          resourcePromise2.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 3);

            connectionPool.release(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback) {
          // Once acquired, release the connection
          resourcePromise3.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 2);

            connectionPool.release(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback) {
          // Once acquired, release the connection
          resourcePromise4.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 1);

            connectionPool.release(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback) {
          // Once acquired, release the connection
          resourcePromise5.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 0);

            connectionPool.release(connection).then(() => {
              assert.equal(connectionPool.available, 1);
              callback();
            });
          });
        },
      ],
      done
    );
  });

  it("acquire() 1 connection and destroy()", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 5,
      min: 0,
    });

    // Acquire a connection
    const resourcePromise1 = connectionPool.acquire();

    assert.equal(connectionPool.size, 1);
    assert.equal(connectionPool.pending, 1);
    assert.equal(connectionPool.spareResourceCapacity, 4);

    // Once acquired, destroy the connection
    resourcePromise1.then(function (connection) {
      assert.ok(connection.isUp(), "not active");
      assert.equal(connectionPool.pending, 0);

      connectionPool.destroy(connection).then(() => {
        // No connection should be available for use
        assert.equal(connectionPool.available, 0);
        done();
      });
    });
  });

  it("acquire() 5 connections and destroy()", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 5,
      min: 0,
    });

    // Acquire 5 connections
    const resourcePromise1 = connectionPool.acquire();
    const resourcePromise2 = connectionPool.acquire();
    const resourcePromise3 = connectionPool.acquire();
    const resourcePromise4 = connectionPool.acquire();
    const resourcePromise5 = connectionPool.acquire();

    assert.equal(connectionPool.size, 5);
    assert.equal(connectionPool.pending, 5);
    assert.equal(connectionPool.spareResourceCapacity, 0);

    async.series(
      [
        function (callback) {
          // Once acquired, destroy the connection
          resourcePromise1.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 4);

            connectionPool.destroy(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback) {
          // Once acquired, destroy the connection
          resourcePromise2.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 3);

            connectionPool.destroy(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback) {
          // Once acquired, destroy the connection
          resourcePromise3.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 2);

            connectionPool.destroy(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback) {
          // Once acquired, destroy the connection
          resourcePromise4.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 1);

            connectionPool.destroy(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback) {
          // Once acquired, destroy the connection
          resourcePromise5.then(function (connection) {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 0);

            connectionPool.destroy(connection).then(() => {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
      ],
      done
    );
  });

  it("use()", function (done) {
    var connectionPool = snowflake.createPool(connOption.valid, {
      max: 5,
      min: 0,
    });

    assert.equal(connectionPool.size, 0);

    // Use the connection pool, automatically creates a new connection
    connectionPool
      .use(async (connection) => {
        assert.ok(connection.isUp(), "not active");
        assert.equal(connectionPool.size, 1);
        assert.equal(connectionPool.pending, 0);
        assert.equal(connectionPool.spareResourceCapacity, 4);
        assert.equal(connectionPool.available, 0);
      })
      .then(() => {
        assert.equal(connectionPool.size, 1);
        assert.equal(connectionPool.available, 1);

        // Use the connection pool, will use the existing connection
        connectionPool
          .use(async (connection) => {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.size, 1);
            assert.equal(connectionPool.pending, 0);
            assert.equal(connectionPool.spareResourceCapacity, 4);
            assert.equal(connectionPool.available, 0);
          })
          .then(() => {
            assert.equal(connectionPool.size, 1);
            assert.equal(connectionPool.available, 1);
            done();
          });
      });
  });

  it("wrong password - use", async function () {
    var connectionPool = snowflake.createPool(connOption.wrongPwd, {
      max: 10,
      min: 1,
    });

    assert.equal(connectionPool.max, 10);
    assert.equal(connectionPool.min, 1);
    assert.equal(connectionPool.size, 1);

    try {
      // Use the connection pool, automatically creates a new connection
      await connectionPool.use(async (connection) => {
        assert.ok(connection.isUp(), "not active");
        assert.equal(connectionPool.size, 1);
      });
    } catch (err) {
      assert.strictEqual(
        err.message,
        "Incorrect username or password was specified."
      );
    }
  });

  it("wrong password - acquire", async function () {
    var connectionPool = snowflake.createPool(connOption.wrongPwd, {
      max: 10,
      min: 1,
    });

    assert.equal(connectionPool.max, 10);
    assert.equal(connectionPool.min, 1);
    assert.equal(connectionPool.size, 1);

    try {
      await connectionPool.acquire();
    } catch (err) {
      assert.strictEqual(
        err.message,
        "Incorrect username or password was specified."
      );
    }
  });
});

describe("Connection Test - Heartbeat", () => {
  let connection;

  before(async () => {
    connection = snowflake.createConnection(connOption.valid);
    await testUtil.connectAsync(connection);
  });

  after(async () => {
    await testUtil.destroyConnectionAsync(connection);
  });

  it("call heartbeat url with default callback", () => {
    connection.heartbeat();
  });

  it("call heartbeat url with callback", (done) => {
    connection.heartbeat((err) => (err ? done(err) : done()));
  });

  it("call heartbeat url as promise", async () => {
    const rows = await connection.heartbeatAsync();
    assert.deepEqual(rows, [{ 1: 1 }]);
  });
});

describe("Connection Test - isValid", () => {
  let connection;

  beforeEach(async () => {
    connection = snowflake.createConnection(connOption.valid);
    await testUtil.connectAsync(connection);
  });

  afterEach(async () => {
    if (connection.isUp()) {
      await testUtil.destroyConnectionAsync(connection);
    }
  });

  it("connection is valid after connect", async () => {
    const result = await connection.isValidAsync();

    assert.equal(result, true);
  });

  it("connection is invalid after destroy", async () => {
    await testUtil.destroyConnectionAsync(connection);

    const result = await connection.isValidAsync();

    assert.equal(result, false);
  });

  // there is no way to test heartbeat fail to running instance of snowflake
});
