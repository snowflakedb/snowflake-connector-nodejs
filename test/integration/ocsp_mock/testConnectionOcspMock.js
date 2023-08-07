/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const snowflake = require('./../../../lib/snowflake');
const async = require('async');
const assert = require('assert');
const connOption = require('../connectionOptions');
const Errors = require('../../../lib/errors');
const ErrorCodes = Errors.codes;
const HttpsMockAgent = require('./https_ocsp_mock_agent');
const { configureLogger } = require('../../configureLogger');

function cloneConnOption(connOption)
{
  let ret = {};
  for (let k in connOption)
  {
    ret[k] = connOption[k];
  }
  return ret;
}

// HTTPS agent keeps recreating socket instead of giving up...
describe('Connection test with OCSP Mock', function ()
{
  this.timeout(30000)
  const valid = cloneConnOption(connOption.valid);
  const isHttps = valid.accessUrl.startsWith("https");

  before(() => configureLogger('TRACE'));
  after(() => configureLogger('ERROR'));

  function connect(errcode, connection, callback)
  {
    connection.connect(function (err)
    {
      console.log(`Connection finished with err: ${JSON.stringify(err)}`)
      if (isHttps)
      {
        assert.equal(err.cause.code, errcode);
      }
      else
      {
        assert.ok(!err, JSON.stringify(err));
      }
      callback();
    })
  }

  function destroy(connection, callback)
  {
    if (isHttps)
    {
      callback();
    }
    else
    {
      connection.destroy(function (err)
      {
        assert.ok(!err, JSON.stringify(err));
        callback();
      });
    }
  }

  it('Connection failure with OCSP revoked error', function (done)
  {
    valid.agentClass = HttpsMockAgent.HttpsMockAgentOcspRevoked;
    const connection = snowflake.createConnection(valid);

    async.series([
        function (callback)
        {
          connect(ErrorCodes.ERR_OCSP_REVOKED, connection, callback);
        },
        function (callback)
        {
          destroy(connection, callback);
        }
      ],
      done
    );
  });

  it('Connection failure with OCSP unknown error', function (done)
  {
    valid.agentClass = HttpsMockAgent.HttpsMockAgentOcspUnkwown;
    const connection = snowflake.createConnection(valid);

    async.series([
        function (callback)
        {
          connect(ErrorCodes.ERR_OCSP_UNKNOWN, connection, callback);
        },
        function (callback)
        {
          destroy(connection, callback);
        }
      ],
      done
    );
  });

  it('Connection failure with invalid validity OCSP error', function (done)
  {
    valid.agentClass = HttpsMockAgent.HttpsMockAgentOcspInvalid;
    const connection = snowflake.createConnection(valid);

    async.series([
        function (callback)
        {
          connect(ErrorCodes.ERR_OCSP_INVALID_VALIDITY, connection, callback);
        },
        function (callback)
        {
          destroy(connection, callback);
        }
      ],
      done
    );
  });
});