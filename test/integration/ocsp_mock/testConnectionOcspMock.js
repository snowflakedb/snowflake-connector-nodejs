const async = require('async');
const assert = require('assert');
const sinon = require('sinon');
const connOption = require('../connectionOptions');
const Errors = require('../../../lib/errors');
const snowflake = require('./../../../lib/snowflake');
const HttpsMockAgent = require('./https_ocsp_mock_agent');
const Logger = require('../../../lib/logger');
const Util = require('../../../lib/util');

const ErrorCodes = Errors.codes;

describe('Connection test with OCSP Mock', function () {
  before(() => {
    // NOTE:
    // Mock backoff to 100ms for fast retries
    sinon
      .stub(Util, 'getJitteredSleepTime')
      .callsFake((_numRetries, _currentSleepTime, totalElapsedTime) => {
        const sleep = 0.1; // 100ms
        const newTotalElapsedTime = totalElapsedTime + sleep;
        return { sleep, totalElapsedTime: newTotalElapsedTime };
      });
  });

  after(() => sinon.restore());

  const valid = {
    ...connOption.valid,
    sfRetryMaxLoginRetries: 2,
  };
  const isHttps = valid.accessUrl.startsWith('https');

  function connect(errcode, connection, callback) {
    connection.connect(function (err) {
      if (isHttps) {
        assert.equal(err.cause.code, errcode);
      } else {
        Logger.getInstance().info('Test can be run only for https protocol');
        assert.ok(!err, JSON.stringify(err));
      }
      callback();
    });
  }

  function destroy(connection, callback) {
    if (isHttps) {
      callback();
    } else {
      connection.destroy(function (err) {
        assert.ok(!err, JSON.stringify(err));
        callback();
      });
    }
  }

  it('Connection failure with OCSP revoked error', function (done) {
    valid.agentClass = HttpsMockAgent.HttpsMockAgentOcspRevoked;
    const connection = snowflake.createConnection(valid);

    async.series(
      [
        function (callback) {
          connect(ErrorCodes.ERR_OCSP_REVOKED, connection, callback);
        },
        function (callback) {
          destroy(connection, callback);
        },
      ],
      done,
    );
  });

  it('Connection failure with OCSP unknown error', function (done) {
    valid.agentClass = HttpsMockAgent.HttpsMockAgentOcspUnkwown;
    const connection = snowflake.createConnection(valid);

    async.series(
      [
        function (callback) {
          connect(ErrorCodes.ERR_OCSP_UNKNOWN, connection, callback);
        },
        function (callback) {
          destroy(connection, callback);
        },
      ],
      done,
    );
  });

  it('Connection failure with invalid validity OCSP error', function (done) {
    valid.agentClass = HttpsMockAgent.HttpsMockAgentOcspInvalid;
    const connection = snowflake.createConnection(valid);

    async.series(
      [
        function (callback) {
          connect(ErrorCodes.ERR_OCSP_INVALID_VALIDITY, connection, callback);
        },
        function (callback) {
          destroy(connection, callback);
        },
      ],
      done,
    );
  });
});
