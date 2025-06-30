const assert = require('assert');
const snowflake = require('./../../lib/snowflake');
const ErrorCodes = require('./../../lib/errors').codes;
const Logger = require('./../../lib/logger');
const GlobalConfig = require('./../../lib/global_config');
const LOG_LEVEL_TAGS = require('./../../lib/logger/core').LOG_LEVEL_TAGS;

describe('Snowflake Configure Tests', function () {
  let originalConfig;

  before(function () {
    originalConfig = {
      logLevel: Logger.getInstance().getLevelTag(),
      disableOCSPChecks: GlobalConfig.isOCSPChecksDisabled(),
      ocspFailOpen: GlobalConfig.getOcspFailOpen(),
      keepAlive: GlobalConfig.getKeepAlive(),
      jsonColumnVariantParser: GlobalConfig.jsonColumnVariantParser,
      xmlColumnVariantParser: GlobalConfig.xmlColumnVariantParser
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
          name: 'invalid disableOCSPChecks',
          options: { disableOCSPChecks: 'unsupported' },
          errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_DISABLE_OCSP_CHECKS
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
        {
          name: 'invalid proxy',
          options: { useEnvProxy: 'unsupported' },
          errorCode: ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_USE_ENV_PROXY
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
          name: 'disableOCSPChecks false',
          options:
          {
            disableOCSPChecks: false
          }
        },
        {
          name: 'disableOCSPChecks true',
          options:
          {
            disableOCSPChecks: true
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
            xmlColumnVariantParser: rawColumnValue => new (require('fast-xml-parser')).XMLParser().parse(rawColumnValue)
          }
        },
        {
          name: 'useEnvProxy false',
          options:
          {
            useEnvProxy: false
          }
        },
        {
          name: 'useEnvProxy true',
          options:
          {
            useEnvProxy: true
          }
        },
      ];

    testCases.forEach(testCase => {
      it(testCase.name, function () {
        snowflake.configure(testCase.options);
        Object.keys(testCase.options).forEach(function (key) {
          const ref = testCase.options[key];
          let val;
          if (key === 'logLevel') {
            val = Logger.getInstance().getLevelTag();
          } else if (key === 'disableOCSPChecks') {
            val = GlobalConfig.isOCSPChecksDisabled();
          } else if (key === 'ocspFailOpen') {
            val = GlobalConfig.getOcspFailOpen();
          } else if (key === 'keepAlive') {
            val = GlobalConfig.getKeepAlive();
          } else if (key === 'useEnvProxy') {
            val = GlobalConfig.isEnvProxyActive();
          } else {
            val = GlobalConfig[key];
          }
          assert.strictEqual(val, ref);
        });
      });
    });
  });
});
