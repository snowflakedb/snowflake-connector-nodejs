/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const snowflake = require('./../../lib/snowflake');
const ErrorCodes = require('./../../lib/errors').codes;
const Logger = require('./../../lib/logger');
const GlobalConfig = require('./../../lib/global_config');

const LOG_LEVEL_TAGS = require('./../../lib/logger/core').LOG_LEVEL_TAGS;

describe('Snowflake Configure Tests', function ()
{
  var originalConfig;

  before(function ()
  {
    originalConfig = {
      logLevel: Logger.getInstance().getLevelTag(),
      insecureConnect: GlobalConfig.isInsecureConnect(),
      ocspFailOpen: GlobalConfig.getOcspFailOpen(),
      jsonColumnVariantParser: GlobalConfig.jsonColumnVariantParser,
      xmlColumnVariantParser: GlobalConfig.xmlColumnVariantParser,
    }
  });

  after(function ()
  {
    snowflake.configure(originalConfig);
  });

  ///////////////////////////////////////////////////////////////////////////
  //// Test invalid arguments                                            ////
  ///////////////////////////////////////////////////////////////////////////

  var negativeTestCases =
    [
      {
        name: 'invalid logLevel',
        options: { logLevel: 'unsupported' },
        errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_LOG_LEVEL
      },
      {
        name: 'invalid insecureConnect',
        options: { insecureConnect: 'unsupported' },
        errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_INSECURE_CONNECT
      },
      {
        name: 'invalid ocspMode',
        options: { ocspFailOpen: 'unsupported' },
        errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_OCSP_MODE
      },
      {
        name: 'invalid json parser',
        options: { jsonColumnVariantParser: 'unsupported' },
        errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_JSON_PARSER
      },
      {
        name: 'invalid xml parser',
        options: { xmlColumnVariantParser: 'unsupported' },
        errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_XML_PARSER
      },
    ];

  var createNegativeITCallback = function (testCase)
  {
    return function ()
    {
      var error;

      try
      {
        snowflake.configure(testCase.options);
      }
      catch (err)
      {
        error = err;
      }
      finally
      {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  var index, length, testCase;
  for (index = 0, length = negativeTestCases.length; index < length; index++)
  {
    testCase = negativeTestCases[index];
    it(testCase.name, createNegativeITCallback(testCase));
  }

  ///////////////////////////////////////////////////////////////////////////
  //// Test valid arguments                                              ////
  ///////////////////////////////////////////////////////////////////////////

  var testCases =
    [
      {
        name: 'logLevel error',
        options:
        {
          logLevel: LOG_LEVEL_TAGS.ERROR
        }
      },
      {
        name: 'logLevel warn',
        options:
        {
          logLevel: LOG_LEVEL_TAGS.WARN
        }
      },
      {
        name: 'logLevel debug',
        options:
        {
          logLevel: LOG_LEVEL_TAGS.DEBUG
        }
      },
      {
        name: 'logLevel info',
        options:
        {
          logLevel: LOG_LEVEL_TAGS.INFO
        }
      },
      {
        name: 'logLevel trace',
        options:
        {
          logLevel: LOG_LEVEL_TAGS.TRACE
        }
      },
      {
        name: 'insecureConnect false',
        options:
        {
          insecureConnect: false
        }
      },
      {
        name: 'insecureConnect true',
        options:
        {
          insecureConnect: true
        }
      },
      {
        name: 'ocspFailOpen false',
        options:
        {
          ocspFailOpen: false
        }
      },
      {
        name: 'ocspFailOpen true',
        options:
        {
          ocspFailOpen: true
        }
      },
      {
        name: 'json parser',
        options:
        {
          jsonColumnVariantParser: rawColumnValue => require('vm').runInNewContext("(" + rawColumnValue + ")")
        }
      },
      {
        name: 'xml parser',
        options:
        {
          xmlColumnVariantParser: rawColumnValue => (require("fast-xml-parser").XMLParser()).parse(rawColumnValue)
        }
      },
    ];

  var createItCallback = function (testCase)
  {
    return function ()
    {
      snowflake.configure(testCase.options);
      Object.keys(testCase.options).forEach(function (key)
      {
        var ref = testCase.options[key];
        var val;
        if (key == 'logLevel')
        {
          val = Logger.getInstance().getLevelTag();
        }
        else if (key == 'insecureConnect')
        {
          val = GlobalConfig.isInsecureConnect();
        }
        else if (key == 'ocspFailOpen')
        {
          val = GlobalConfig.getOcspFailOpen();
        }
        else
        {
          val = GlobalConfig[key]
        }
        assert.strictEqual(val, ref);
      })
    };
  };

  for (index = 0, length = testCases.length; index < length; index++)
  {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});