const snowflake = require('./../../../lib/snowflake');
const async = require('async');
const assert = require('assert');
const connOption = require('../connectionOptions');
const Errors = require('../../../lib/errors');
const ErrorCodes = Errors.codes;
const HttpsMockAgent = require('./https_ocsp_mock_agent');
const Logger = require('../../../lib/logger');

function cloneConnOption(connOption) {
  const ret = {};
  for (const k in connOption) {
    ret[k] = connOption[k];
  }
  return ret;
}

describe('Connection test with OCSP Mock', function () {
  this.timeout(300000);

  const valid = cloneConnOption(connOption.valid);

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

    async.series([
      function (callback) {
        connect(ErrorCodes.ERR_OCSP_REVOKED, connection, callback);
      },
      function (callback) {
        destroy(connection, callback);
      }
    ],
    done
    );
  });

  it('Connection failure with OCSP unknown error', function (done) {
    valid.agentClass = HttpsMockAgent.HttpsMockAgentOcspUnkwown;
    const connection = snowflake.createConnection(valid);

    async.series([
      function (callback) {
        connect(ErrorCodes.ERR_OCSP_UNKNOWN, connection, callback);
      },
      function (callback) {
        destroy(connection, callback);
      }
    ],
    done
    );
  });

  it('Connection failure with invalid validity OCSP error', function (done) {
    valid.agentClass = HttpsMockAgent.HttpsMockAgentOcspInvalid;
    const connection = snowflake.createConnection(valid);

    async.series([
      function (callback) {
        connect(ErrorCodes.ERR_OCSP_INVALID_VALIDITY, connection, callback);
      },
      function (callback) {
        destroy(connection, callback);
      }
    ],
    done
    );
  });
});