/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const snowflake = require('./../../lib/snowflake');
const ErrorCodes = require('./../../lib/errors').codes;
const Logger = require('./../../lib/logger');
const GlobalConfig = require('./../../lib/global_config');
const {CustomCredentialManager} = require('./../../lib/global_config');

const LOG_LEVEL_TAGS = require('./../../lib/logger/core').LOG_LEVEL_TAGS;

describe('Snowflake Configure Tests', function () {
  let originalConfig;

  before(function () {
    originalConfig = {
      logLevel: Logger.getInstance().getLevelTag(),
      insecureConnect: GlobalConfig.isInsecureConnect(),
      ocspFailOpen: GlobalConfig.getOcspFailOpen(),
      keepAlive: GlobalConfig.getKeepAlive(),
      jsonColumnVariantParser: GlobalConfig.jsonColumnVariantParser,
      xmlColumnVariantParser: GlobalConfig.xmlColumnVariantParser,
      customCredentialManager: GlobalConfig.CredentialManager,
    };
  });

  after(function () {
    snowflake.configure(originalConfig);
  });

  describe('Test invalid arguments', function () {
    const negativeTestCases =
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
        {
          name: 'invalid keep alive',
          options: { keepAlive: 'unsupported' },
          errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_KEEP_ALIVE
        },
        {
          name: 'invalid customCredentialManager',
          options: { customCredentialManager: 'unsupported' },
          errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_CUSTOM_CREDENTIAL_MANAGER
        },
      ];

    negativeTestCases.forEach(testCase => {
      it(testCase.name, function () {
        let error;

        try {
          snowflake.configure(testCase.options);
        } catch (err) {
          error = err;
        } finally {
          assert.ok(error);
          assert.strictEqual(error.code, testCase.errorCode);
        }
      });
    });
  });

  describe('Test valid arguments', function () {

    function sampleManager() {
      this.read = function () {
      }
  
      this.write = function (credential) {
      }
    }
    const credManager = new sampleManager();

    const testCases =
      [
        {
          name: 'logLevel off',
          options:
            {
              logLevel: LOG_LEVEL_TAGS.OFF
            }
        },
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
          name: 'keepAlive false',
          options:
          {
            keepAlive: false
          }
        },
        {
          name: 'keepAlive true',
          options:
          {
            keepAlive: true
          }
        },
        {
          name: 'json parser',
          options:
          {
            jsonColumnVariantParser: rawColumnValue => require('vm').runInNewContext('(' + rawColumnValue + ')')
          }
        },
        {
          name: 'xml parser',
          options:
          {
            xmlColumnVariantParser: rawColumnValue => new (require("fast-xml-parser")).XMLParser().parse(rawColumnValue)
          }
        },
        {
          name: 'custom credential manager',
          options:
          {
            customCredentialManager: credManager,
          }
        },
      ];

    testCases.forEach(testCase => {
      it(testCase.name, function () {
        snowflake.configure(testCase.options);
        Object.keys(testCase.options).forEach(function (key) {
          const ref = testCase.options[key];
          let val;
          if (key == 'logLevel') {
            val = Logger.getInstance().getLevelTag();
          } else if (key == 'insecureConnect') {
            val = GlobalConfig.isInsecureConnect();
          } else if (key == 'ocspFailOpen') {
            val = GlobalConfig.getOcspFailOpen();
          } else if (key == 'keepAlive') {
            val = GlobalConfig.getKeepAlive();
          } else if (key === 'customCredentialManager') {
            val = new CustomCredentialManager(credManager);
          } 
          else {
            val = GlobalConfig[key];
          }
          assert.strictEqual(val, ref);
        });
      });
    });
  });
});
