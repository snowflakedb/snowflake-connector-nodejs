/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const async = require('async');
const assert = require('assert');

const snowflake = require('./../../lib/snowflake');
const Errors = require('./../../lib/errors')
const SocketUtil = require('./../../lib/agent/socket_util');
const OcspResponseCache = require('./../../lib/agent/ocsp_response_cache');

const sharedLogger = require('./sharedLogger');
const Logger = require('./../../lib/logger');
const { hangWebServerUrl } = require('../hangWebserver');
Logger.getInstance().setLogger(sharedLogger.logger);

let testCounter = 0;

const testConnectionOptions = {
  username: 'fakeuser',
  password: 'fakepasword',
  account: 'fakeaccount',
  sfRetryMaxLoginRetries: 2
};

const testRevokedConnectionOptions = {
  accessUrl: 'https://revoked.badssl.com',
  username: 'fakeuser',
  password: 'fakepasword',
  account: 'fakeaccount'
};

function getConnectionOptions()
{
  // use unique hostname to avoid connection cache in tests.
  // If connection is cached, the test result is not consistent.
  let objCopy = Object.assign({}, testConnectionOptions);
  objCopy['accessUrl'] = 'https://fakeaccount' + (testCounter) + '.snowflakecomputing.com';
  testCounter++;
  return objCopy;
}

describe('Connection with OCSP test', function ()
{
  function deleteCache()
  {
    OcspResponseCache.deleteCache();
  }

  it('OCSP NOP - Fail Open', function (done)
  {
    deleteCache();
    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            assert.strictEqual(err.code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
            callback();
          });
        }
      ],
      done
    );
  });

  it('OCSP Validity Error - Fail Open', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // inject validity error
    process.env.SF_OCSP_TEST_INJECT_VALIDITY_ERROR = 'true';

    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            assert.strictEqual(err.code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_TEST_INJECT_VALIDITY_ERROR'];
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Validity Error - Fail Closed', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // inject validity error
    process.env.SF_OCSP_TEST_INJECT_VALIDITY_ERROR = 'true';

    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            assert.strictEqual(err.code, Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT);
            assert.strictEqual(err.cause.code, Errors.codes.ERR_OCSP_INVALID_VALIDITY);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_TEST_INJECT_VALIDITY_ERROR'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Unknown Cert - Fail Open', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // inject validity error
    process.env.SF_OCSP_TEST_INJECT_UNKNOWN_STATUS = 'true';

    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            assert.strictEqual(err.code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_TEST_INJECT_UNKNOWN_STATUS'];
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Unknown Cert - Fail Closed', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // inject validity error
    process.env.SF_OCSP_TEST_INJECT_UNKNOWN_STATUS = 'true';

    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            if (err.code !== Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT)
            {
              console.log(err);
            }
            assert.strictEqual(err.code, Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT);
            assert.strictEqual(err.cause.code, Errors.codes.ERR_OCSP_UNKNOWN);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_TEST_INJECT_UNKNOWN_STATUS'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });
  /*
  it('OCSP Revoked Cert - Fail Open', function (done)
  {
    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(testRevokedConnectionOptions);

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            assert.strictEqual(err.cause.code, Errors.codes.ERR_OCSP_REVOKED);
            callback();
          });
        }
      ],
      done
    );
  });

  it('OCSP Revoked Cert - Fail Closed', function (done)
  {
    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(testRevokedConnectionOptions);

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            assert.strictEqual(err.cause.code, Errors.codes.ERR_OCSP_REVOKED);
            callback();
          });
        },
        function (callback)
        {
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });*/

  it('OCSP Cache Server Timeout - Fail Open', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL = `${hangWebServerUrl}/hang`;
    process.env.SF_OCSP_TEST_OCSP_RESPONSE_CACHE_SERVER_TIMEOUT = 1000;

    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // read error is expected as the account name is fake.
            // This just should not be OCSP error.
            assert.strictEqual(err.code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_RESPONSE_CACHE_SERVER_URL'];
          delete process.env['SF_OCSP_TEST_OCSP_RESPONSE_CACHE_SERVER_TIMEOUT'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Cache Server Timeout - Fail Closed', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL = `${hangWebServerUrl}/hang`;
    process.env.SF_OCSP_TEST_OCSP_RESPONSE_CACHE_SERVER_TIMEOUT = 1000;

    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // read error is expected as the account name is fake.
            // This just should not be OCSP error.
            if (err.code !== Errors.codes.ERR_SF_RESPONSE_FAILURE)
            {
              console.log(err);
            }
            assert.strictEqual(err.code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_TEST_OCSP_RESPONSE_CACHE_SERVER_TIMEOUT'];
          delete process.env['SF_OCSP_RESPONSE_CACHE_SERVER_URL'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Responder Timeout - Fail Open', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // no cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONDER_URL = `${hangWebServerUrl}/hang`;
    process.env.SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT = 1000;

    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // read error is expected as the account name is fake.
            // This just should not be OCSP error.
            assert.strictEqual(err.code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_RESPONDER_URL'];
          delete process.env['SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Responder Timeout - Fail Closed', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // no cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONDER_URL = `${hangWebServerUrl}/hang`;
    process.env.SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT = 1000;

    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // should be OCSP timeout error.
            if (err.code !== Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT)
            {
              console.log(err);
            }
            assert.strictEqual(err.code, Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT);
            if (err.cause.code === 'ECONNREFUSED')
            {
              console.log("run hang_webserver.py")
            }
            assert.strictEqual(err.cause.code, Errors.codes.ERR_OCSP_RESPONDER_TIMEOUT);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_RESPONDER_URL'];
          delete process.env['SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Cache Server and Responder Timeout - Fail Open', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // no cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL = `${hangWebServerUrl}/hang`;
    process.env.SF_OCSP_RESPONDER_URL = `${hangWebServerUrl}/hang`;
    process.env.SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT = 1000;
    process.env.SF_OCSP_TEST_OCSP_RESPONSE_CACHE_SERVER_TIMEOUT = 1000;

    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // should be 403
            assert.strictEqual(err.code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_RESPONSE_CACHE_SERVER_URL'];
          delete process.env['SF_OCSP_RESPONDER_URL'];
          delete process.env['SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT'];
          delete process.env['SF_OCSP_TEST_OCSP_RESPONSE_CACHE_SERVER_TIMEOUT'];
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Responder 403 - Fail Closed', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // no cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONDER_URL = `${hangWebServerUrl}/403`;

    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // should be OCSP timeout error.
            if (err.code !== Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT)
            {
              console.log(err);
            }
            assert.strictEqual(err.code, Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT);
            if (err.cause.code === 'ECONNREFUSED')
            {
              console.log("run hang_webserver.py")
            }
            assert.strictEqual(err.cause.code, Errors.codes.ERR_OCSP_FAILED_OBTAIN_OCSP_RESPONSE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_RESPONDER_URL'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Responder 403 - Fail Open', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // no cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONDER_URL = `${hangWebServerUrl}/403`;

    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // should be OCSP timeout error.
            assert.strictEqual(err.code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_RESPONDER_URL'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Responder 404 - Fail Closed', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // no cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONDER_URL = `${hangWebServerUrl}/404`;

    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(getConnectionOptions());

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // should be OCSP timeout error.
            assert.strictEqual(err.code, Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT);
            if (err.cause.code === 'ECONNREFUSED')
            {
              console.log("run hang_webserver.py")
            }
            assert.strictEqual(err.cause.code, Errors.codes.ERR_OCSP_FAILED_OBTAIN_OCSP_RESPONSE);
            callback();
          });
        },
        function (callback)
        {
          delete process.env['SF_OCSP_RESPONDER_URL'];
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  const testInvalidCertConnectionOptions = [
    {
      connectString: {
        accessUrl: 'https://expired.badssl.com',
        username: 'fakeuser',
        password: 'fakepasword',
        account: 'fakeaccount',
      },
      errorCode: 'CERT_HAS_EXPIRED'
    }
    /*
    ,{
      // This test case got invalid as the certificate expired.
      // We need a reliable self signed SSL endpoint for tests SNOW-98318
      connectString: {
        accessUrl: 'https://self-signed.badssl.com',
        username: 'fakeuser',
        password: 'fakepasword',
        account: 'fakeaccount',
      },
      errorCode: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    }
     */
  ];

  function connectToHttpsEndpoint(testOptions, i, connection, done)
  {
    connection.connect(function (err)
    {
      assert.ok(err);
      if (err)
      {
        assert.strictEqual(err.code, Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT);
        assert.strictEqual(err.cause.code, testInvalidCertConnectionOptions[i].errorCode);
      }

      if (i === testInvalidCertConnectionOptions.length - 1)
      {
        done();
      }
      else
      {
        testOptions(i + 1);
      }
    });
  }

  it('OCSP Invalid Certificate', function (done)
  {
    const testOptions = function (i)
    {
      console.log('==> ' + testInvalidCertConnectionOptions[i].connectString.accessUrl);
      const connection = snowflake.createConnection(
        testInvalidCertConnectionOptions[i].connectString);
      connectToHttpsEndpoint(testOptions, i, connection, done)
    };
    testOptions(0);
  });
});
