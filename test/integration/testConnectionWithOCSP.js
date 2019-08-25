/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const snowflake = require('./../../lib/snowflake');
const async = require('async');
const assert = require('assert');
const connOption = require('./connectionOptions');
const Errors = require('./../../lib/errors')
const SocketUtil = require('./../../lib/agent/socket_util');

describe('Connection test', function ()
{
  it('OCSP Fail Closed', function (done)
  {
    snowflake.configure({ocspFailOpen: false});
    var connection = snowflake.createConnection(connOption.valid);

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function (callback)
        {
          connection.destroy(function (err)
          {
            assert.ok(!err, JSON.stringify(err));
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
  });

  it('OCSP Revoked with FAIL CLOSED', function (done)
  {
    const options = {
      accessUrl: 'https://revoked.badssl.com',
      username: 'fakeuser',
      password: 'fakepasword',
      account: 'fakeaccount'
    };
    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(options);

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
  });

  it('OCSP Revoked with FAIL OPEN', function (done)
  {
    const options = {
      accessUrl: 'https://revoked.badssl.com',
      username: 'fakeuser',
      password: 'fakepasword',
      account: 'fakeaccount'
    };
    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(options);

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

  function deleteCache()
  {
    if (SocketUtil.variables.OCSP_RESPONSE_CACHE)
    {
      SocketUtil.variables.OCSP_RESPONSE_CACHE.deleteCache();
    }
  }

  it('OCSP Fail Open', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;

    const options = {
      accessUrl: 'https://account1.snowflakecomputing.com',
      username: 'fakeuser',
      password: 'fakepasword',
      account: 'fakeaccount'
    };
    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(options);

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

  it('OCSP Failed Open with OCSP Cache Server Timeout', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL = 'http://localhost:12345';

    const options = {
      accessUrl: 'https://account1.snowflakecomputing.com',
      username: 'fakeuser',
      password: 'fakepasword',
      account: 'fakeaccount'
    };
    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(options);

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
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Failed Closed with OCSP Cache Server Timeout', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL = 'http://localhost:12345';

    const options = {
      accessUrl: 'https://account1.snowflakecomputing.com',
      username: 'fakeuser',
      password: 'fakepasword',
      account: 'fakeaccount'
    };
    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(options);

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
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Failed Open with OCSP Responder Timeout', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // no cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONDER_URL = 'http://localhost:12345';

    const options = {
      accessUrl: 'https://account1.snowflakecomputing.com',
      username: 'fakeuser',
      password: 'fakepasword',
      account: 'fakeaccount'
    };
    snowflake.configure({ocspFailOpen: true});
    const connection = snowflake.createConnection(options);

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
          process.env.SF_OCSP_RESPONDER_URL = '';
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });

  it('OCSP Failed Closed with OCSP Responder Timeout', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    // no cache server is used
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;
    // fake OCSP responder.
    process.env.SF_OCSP_RESPONDER_URL = 'http://localhost:12345';

    const options = {
      accessUrl: 'https://account1.snowflakecomputing.com',
      username: 'fakeuser',
      password: 'fakepasword',
      account: 'fakeaccount'
    };
    snowflake.configure({ocspFailOpen: false});
    const connection = snowflake.createConnection(options);

    async.series([
        function (callback)
        {
          connection.connect(function (err)
          {
            // should be OCSP timeout error.
            assert.strictEqual(err.code, Errors.codes.ERR_SF_NETWORK_COULD_NOT_CONNECT);
            assert.strictEqual(err.cause.code, Errors.codes.ERR_OCSP_RESPONDER_TIMEOUT);
            callback();
          });
        },
        function (callback)
        {
          process.env.SF_OCSP_RESPONDER_URL = '';
          snowflake.configure({ocspFailOpen: true});
          callback();
        }
      ],
      done
    );
  });
});
