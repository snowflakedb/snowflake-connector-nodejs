/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const os = require('os');
const url = require('url');
const Util = require('../util');
const Errors = require('../errors');
const ErrorCodes = Errors.codes;
const NativeTypes = require('./result/data_types').NativeTypes;
const GlobalConfig = require('../global_config');
const authenticationTypes = require('../authentication/authentication').authenticationTypes;

const PARAMS =
{
  ACCOUNT: 'ACCOUNT',
  REGION: 'REGION',
  HOST: 'HOST',
  ACCESS_URL: 'ACCESSURL',
  USERNAME: 'USERNAME',
  PASSWORD: 'PASSWORD',
  AUTHENTICATOR: 'AUTHENTICATOR',
  PROXY_HOST: 'PROXYHOST',
  PROXY_PORT: 'PROXYPORT',
  SERVICE_NAME: 'SERVICENAME',
  PRIVATE_KEY: 'PRIVATEKEY',
  PRIVATE_KEY_PATH: 'PRIVATEKEYPATH',
  PRIVATE_KEY_PASS: 'PRIVATEKEYPASS',
  TOKEN: 'TOKEN',
  WAREHOUSE: 'WAREHOUSE',
  DATABASE: 'DATABASE',
  SCHEMA: 'SCHEMA',
  ROLE: 'ROLE',
  STREAM_RESULT: 'STREAMRESULT',
  FETCH_AS_STRING: 'FETCHASSTRING',
  CLIENT_SESSION_KEEP_ALIVE: 'CLIENTSESSIONKEEPALIVE',
  CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY: 'CLIENTSESSIONKEEPALIVEHEARTBEATFREQUENCY',
  JS_TREAT_INTEGER_AS_BIGINT: 'JSTREATINTEGERASBIGINT',
  SESSION_TOKEN: 'SESSIONTOKEN',
  MASTER_TOKEN: 'MASTERTOKEN',
  SESSION_TOKEN_EXPIRATION_TIME: 'SESSIONTOKENEXPIRATIONTIME',
  MASTER_TOKEN_EXPIRATION_TIME: 'MASTERTOKENEXPIRATIONTIME',
  AGENT_CLASS: 'AGENTCLASS'
};

function consolidateHostAndAccount(options)
{
  let dotPos = -1;
  let realAccount = undefined;
  if (Util.exists(options[PARAMS.ACCOUNT]))
  {
    Errors.checkArgumentValid(Util.isString(options[PARAMS.ACCOUNT]), ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT);
    options[PARAMS.HOST] = Util.construct_hostname(options[PARAMS.REGION], options[PARAMS.ACCOUNT]);
    dotPos = options[PARAMS.ACCOUNT].indexOf('.');
    realAccount = options[PARAMS.ACCOUNT];
    if (dotPos > 0)
    {
      realAccount = realAccount.substring(0, dotPos);
    }
  }

  if (!Util.isString(options[PARAMS.ACCESS_URL]) || !Util.exists(options[PARAMS.ACCESS_URL]))
  {
    if (options[PARAMS.REGION] === 'us-west-2')
    {
      options[PARAMS.REGION] = '';
    }
    if (dotPos < 0 && Util.isString(options[PARAMS.REGION]) && options[PARAMS.REGION].length > 0)
    {
      options[PARAMS.ACCESS_URL] = Util.format('https://%s.%s.snowflakecomputing.com', options[PARAMS.ACCOUNT], options[PARAMS.REGION]);
    }
    else
    {
      options[PARAMS.ACCESS_URL] = Util.format('https://%s.snowflakecomputing.com', options[PARAMS.ACCOUNT]);
    }
  }
  else if (!Util.exists(options[PARAMS.ACCOUNT]))
  {
    try
    {
      const parsedUrl = url.parse(options[PARAMS.ACCESS_URL]);
      Errors.checkArgumentValid(Util.exists(parsedUrl.hostname), ErrorCodes.ERR_CONN_CREATE_INVALID_ACCESS_URL);
      const dotPos = parsedUrl.hostname.indexOf('.');
      if (dotPos > 0)
      {
        realAccount = parsedUrl.hostname.substring(0, dotPos);
      }
    }
    catch (e)
    {
      Errors.checkArgumentValid(
        false, ErrorCodes.ERR_CONN_CREATE_INVALID_ACCESS_URL);
    }
  }
  if (Util.exists(realAccount) && options[PARAMS.ACCESS_URL].endsWith("global.snowflakecomputing.com"))
  {
    const dashPos = realAccount.indexOf('-');
    if (dashPos > 0)
    {
      // global URL
      realAccount = realAccount.substring(0, dashPos);
    }
  }
  options[PARAMS.ACCOUNT] = realAccount;
  // check for missing password
  Errors.checkArgumentExists(Util.exists(options[PARAMS.ACCOUNT]), ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT);
}

/**
 * A Connection configuration object that should be available to all stateful
 * objects in the driver.
 *
 * @param {Object} options
 * @param {Boolean} [validateCredentials]
 * @param {Boolean} [qaMode]
 * @param {Object} [clientInfo]
 *
 * @constructor
 */
function ConnectionConfig(options, validateCredentials, qaMode, clientInfo)
{
  // if no value is specified for the validate credentials flag, default to true
  if (!Util.exists(validateCredentials))
  {
    validateCredentials = true;
  }

  // check for missing options
  Errors.checkArgumentExists(Util.exists(options),
    ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS);

  // check for invalid options
  Errors.checkArgumentValid(Util.isObject(options),
    ErrorCodes.ERR_CONN_CREATE_INVALID_OPTIONS);

  options = Util.parseConnectionOptions(options);

  // only validate credentials if necessary
  if (validateCredentials)
  {
    // check for missing username
    Errors.checkArgumentExists(Util.exists(options[PARAMS.USERNAME]),
      ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME);

    // check for invalid username
    Errors.checkArgumentValid(Util.isString(options[PARAMS.USERNAME]),
      ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME);

    // password is only required for default authenticator
    if (!Util.exists(options[PARAMS.AUTHENTICATOR]) ||
      options[PARAMS.AUTHENTICATOR] == authenticationTypes.DEFAULT_AUTHENTICATOR)
    {
      // check for missing password
      Errors.checkArgumentExists(Util.exists(options[PARAMS.PASSWORD]),
          ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD);

      // check for invalid password
      Errors.checkArgumentValid(Util.isString(options[PARAMS.PASSWORD]),
          ErrorCodes.ERR_CONN_CREATE_INVALID_PASSWORD);
    }

    consolidateHostAndAccount(options);
  }

  // check for missing accessUrl
  Errors.checkArgumentExists(Util.exists(options[PARAMS.ACCESS_URL]),
    ErrorCodes.ERR_CONN_CREATE_MISSING_ACCESS_URL);

  // check for invalid accessUrl
  Errors.checkArgumentValid(Util.isString(options[PARAMS.ACCESS_URL]),
    ErrorCodes.ERR_CONN_CREATE_INVALID_ACCESS_URL);

  var proxyHost = options[PARAMS.PROXY_HOST];
  var proxyPort = options[PARAMS.PROXY_PORT];

  // if we're running in node and some proxy information is specified
  var proxy;
  if (Util.isNode() && (Util.exists(proxyHost) || Util.exists(proxyPort)))
  {
    // check for missing proxyHost
    Errors.checkArgumentExists(Util.exists(proxyHost),
      ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_HOST);

    // check for invalid proxyHost
    Errors.checkArgumentValid(Util.isString(proxyHost),
      ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_HOST);

    // check for missing proxyPort
    Errors.checkArgumentExists(Util.exists(proxyPort),
      ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_PORT);

    // check for invalid proxyPort
    Errors.checkArgumentValid(Util.isNumber(proxyPort),
      ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_PORT);

    proxy =
      {
        host: proxyHost,
        port: proxyPort
      };
  }

  var serviceName = options[PARAMS.SERVICE_NAME];
  var authenticator = options[PARAMS.AUTHENTICATOR];

  // if no value is specified for authenticator, default to Snowflake
  if (!Util.exists(authenticator))
  {
    authenticator = authenticationTypes.DEFAULT_AUTHENTICATOR;
  }
  else
  {
    authenticator = authenticator.toUpperCase();
  }

  var privateKey = options[PARAMS.PRIVATE_KEY];
  if (Util.exists(options[PARAMS.PRIVATE_KEY]))
  {
    Errors.checkArgumentValid((Util.isString(privateKey) && Util.isPrivateKey(privateKey)),
      ErrorCodes.ERR_CONN_CREATE_INVALID_PRIVATE_KEY);
  }

  var privateKeyPath = options[PARAMS.PRIVATE_KEY_PATH];
  if (Util.exists(options[PARAMS.PRIVATE_KEY_PATH]))
  {
    Errors.checkArgumentValid(Util.isString(privateKeyPath),
      ErrorCodes.ERR_CONN_CREATE_INVALID_PRIVATE_KEY_PATH);
  }

  var privateKeyPass = options[PARAMS.PRIVATE_KEY_PASS];
  if (Util.exists(options[PARAMS.PRIVATE_KEY_PASS]))
  {
    Errors.checkArgumentValid(Util.isString(privateKeyPass),
      ErrorCodes.ERR_CONN_CREATE_INVALID_PRIVATE_KEY_PASS);
  }

  var token = options[PARAMS.TOKEN];
  if (Util.exists(options[PARAMS.TOKEN]))
  {
    Errors.checkArgumentValid(Util.isString(token),
      ErrorCodes.ERR_CONN_CREATE_INVALID_OAUTH_TOKEN);
  }

  var warehouse = options[PARAMS.WAREHOUSE];
  var database = options[PARAMS.DATABASE];
  var schema = options[PARAMS.SCHEMA];
  var role = options[PARAMS.ROLE];

  // check for invalid warehouse
  if (Util.exists(warehouse))
  {
    Errors.checkArgumentValid(Util.isString(warehouse),
      ErrorCodes.ERR_CONN_CREATE_INVALID_WAREHOUSE);
  }

  // check for invalid database
  if (Util.exists(database))
  {
    Errors.checkArgumentValid(Util.isString(database),
      ErrorCodes.ERR_CONN_CREATE_INVALID_DATABASE);
  }

  // check for invalid schema
  if (Util.exists(schema))
  {
    Errors.checkArgumentValid(Util.isString(schema),
      ErrorCodes.ERR_CONN_CREATE_INVALID_SCHEMA);
  }

  // check for invalid role
  if (Util.exists(role))
  {
    Errors.checkArgumentValid(Util.isString(role),
      ErrorCodes.ERR_CONN_CREATE_INVALID_ROLE);
  }

  // check for invalid streamResult
  var streamResult = options[PARAMS.STREAM_RESULT];
  if (Util.exists(streamResult))
  {
    Errors.checkArgumentValid(Util.isBoolean(streamResult),
      ErrorCodes.ERR_CONN_CREATE_INVALID_STREAM_RESULT);
  }

  // check for invalid fetchAsString
  var fetchAsString = options[PARAMS.FETCH_AS_STRING];
  if (Util.exists(fetchAsString))
  {
    // check that the value is an array
    Errors.checkArgumentValid(Util.isArray(fetchAsString),
      ErrorCodes.ERR_CONN_CREATE_INVALID_FETCH_AS_STRING);

    // check that all the array elements are valid
    var invalidValueIndex = NativeTypes.findInvalidValue(fetchAsString);
    Errors.checkArgumentValid(invalidValueIndex === -1,
      ErrorCodes.ERR_CONN_CREATE_INVALID_FETCH_AS_STRING_VALUES,
      JSON.stringify(fetchAsString[invalidValueIndex]));
  }

  // check for invalid clientSessionKeepAlive
  var clientSessionKeepAlive = options[PARAMS.CLIENT_SESSION_KEEP_ALIVE];
  if (Util.exists(clientSessionKeepAlive))
  {
    Errors.checkArgumentValid(Util.isBoolean(clientSessionKeepAlive),
      ErrorCodes.ERR_CONN_CREATE_INVALID_KEEP_ALIVE);
  }

  // check for invalid clientSessionKeepAliveHeartbeatFrequency
  var clientSessionKeepAliveHeartbeatFrequency = options[PARAMS.CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY];
  if (Util.exists(clientSessionKeepAliveHeartbeatFrequency))
  {
    Errors.checkArgumentValid(Util.isNumber(clientSessionKeepAliveHeartbeatFrequency),
      ErrorCodes.ERR_CONN_CREATE_INVALID_KEEP_ALIVE_HEARTBEAT_FREQ);
    clientSessionKeepAliveHeartbeatFrequency =
      Util.validateClientSessionKeepAliveHeartbeatFrequency(clientSessionKeepAliveHeartbeatFrequency, 14400);
  }

  var jsTreatIntegerAsBigInt = options[PARAMS.JS_TREAT_INTEGER_AS_BIGINT];
  if (Util.exists(jsTreatIntegerAsBigInt))
  {
    Errors.checkArgumentValid(Util.isBoolean(jsTreatIntegerAsBigInt),
      ErrorCodes.ERR_CONN_CREATE_INVALID_TREAT_INTEGER_AS_BIGINT);
  }

  // remember if we're in qa mode
  this._qaMode = qaMode;

  // if a client-info argument is specified, validate it
  var clientName;
  var clientVersion;
  var clientEnvironment;
  if (Util.exists(clientInfo))
  {
    Errors.assertInternal(Util.isObject(clientInfo));
    Errors.assertInternal(Util.isString(clientInfo.version));
    Errors.assertInternal(Util.isObject(clientInfo.environment));

    clientName = clientInfo.name;
    clientVersion = clientInfo.version;
    clientEnvironment = clientInfo.environment;
    clientEnvironment.OS = os.platform();
    clientEnvironment.OS_VERSION = os.release();
    clientEnvironment.OCSP_MODE = GlobalConfig.getOcspMode();
  }

  /**
   * Returns an object that contains information about the proxy hostname, port,
   * etc. for when http requests are made.
   *
   * @returns {Object}
   */
  this.getProxy = function ()
  {
    return proxy;
  };

  /**
   * Returns the warehouse to automatically use once a connection has been
   * established.
   *
   * @returns {String}
   */
  this.getWarehouse = function ()
  {
    return warehouse;
  };

  /**
   * Returns the database to automatically use once a connection has been
   * established.
   *
   * @returns {String}
   */
  this.getDatabase = function ()
  {
    return database;
  };

  /**
   * Returns the schema to automatically use once a connection has been
   * established.
   *
   * @returns {String}
   */
  this.getSchema = function ()
  {
    return schema;
  };

  /**
   * Returns the role to automatically use once a connection has been
   * established.
   *
   * @returns {String}
   */
  this.getRole = function ()
  {
    return role;
  };

  /**
   * Returns the service name.
   *
   * @returns {String}
   */
  this.getServiceName = function ()
  {
    return serviceName;
  };

  /**
   * Returns the authenticator to use for establishing a connection.
   *
   * @returns {String}
   */
  this.getAuthenticator = function ()
  {
    return authenticator;
  };

  /**
   * Returns the private key string.
   *
   * @returns {String}
   */
  this.getPrivateKey = function ()
  {
    return privateKey;
  };

  /**
   * Returns the private key file location.
   *
   * @returns {String}
   */
  this.getPrivateKeyPath = function ()
  {
    return privateKeyPath;
  };

  /**
   * Returns the private key passphrase.
   *
   * @returns {String}
   */
  this.getPrivateKeyPass = function ()
  {
    return privateKeyPass;
  };

  /**
   * Returns the OAuth token.
   *
   * @returns {String}
   */
  this.getToken = function ()
  {
    return token;
  };

  /**
   * Returns the streamResult flag.
   *
   * @returns {boolean}
   */
  this.getStreamResult = function ()
  {
    return streamResult;
  };

  /**
   * Returns the fetchAsString array.
   *
   * @returns {String[]}
   */
  this.getFetchAsString = function ()
  {
    return fetchAsString;
  };

  /**
   * Returns the client type.
   *
   * @returns {String}
   */
  this.getClientType = function ()
  {
    return 'JavaScript';
  };

  /**
   * Returns the client name.
   *
   * @returns {String}
   */
  this.getClientName = function ()
  {
    return clientName;
  };

  /**
   * Returns the client version.
   *
   * @returns {String}
   */
  this.getClientVersion = function ()
  {
    return clientVersion;
  };

  /**
   * Returns a JSON object containing version information for all the various
   * components of the runtime, e.g. node, v8, openssl, etc.
   *
   * @returns {Object}
   */
  this.getClientEnvironment = function ()
  {
    return clientEnvironment;
  };

  /**
   * Returns the client session keep alive setting.
   *
   * @returns {String}
   */
  this.getClientSessionKeepAlive = function ()
  {
    return clientSessionKeepAlive;
  };

  /**
   * Returns the client session keep alive heartbeat frequency setting.
   *
   * @returns {String}
   */
  this.getClientSessionKeepAliveHeartbeatFrequency = function ()
  {
    return clientSessionKeepAliveHeartbeatFrequency;
  };

  /**
   * Returns the client treat integer as setting
   *
   * @returns {String}
   */
  this.getJsTreatIntegerAsBigInt = function ()
  {
    return jsTreatIntegerAsBigInt;
  };

  // save config options
  this.username = options[PARAMS.USERNAME];
  this.password = options[PARAMS.PASSWORD];
  this.accessUrl = options[PARAMS.ACCESS_URL];
  this.region = options[PARAMS.REGION];
  this.account = options[PARAMS.ACCOUNT];
  this.host = options[PARAMS.HOST];
  this.sessionToken = options[PARAMS.SESSION_TOKEN];
  this.masterToken = options[PARAMS.MASTER_TOKEN];
  this.masterTokenExpirationTime = options[PARAMS.MASTER_TOKEN_EXPIRATION_TIME];
  this.sessionTokenExpirationTime = options[PARAMS.SESSION_TOKEN_EXPIRATION_TIME];

  // create the parameters array
  var parameters = createParameters();

  // create a map in which the keys are the parameter names and the values are
  // the corresponding parameters
  var mapParameters = {};
  var index, length, parameter;
  for (index = 0, length = parameters.length; index < length; index++)
  {
    parameter = parameters[index];
    mapParameters[parameter.name] = parameter;

    // initialize the value to the default
    parameter.value = parameter.defaultValue;
  }

  // for each property in the options object that matches a known parameter name
  var propertyName, propertyValue;
  for (propertyName in options)
  {
    if (options.hasOwnProperty(propertyName) &&
      mapParameters.hasOwnProperty(propertyName))
    {
      // if the parameter matching the property is external and the specified
      // value is valid for the parameter, update the parameter value
      propertyValue = options[propertyName];
      parameter = mapParameters[propertyName];
      if (parameter.external && parameter.validate(propertyValue))
      {
        parameter.value = propertyValue;
      }
    }
  }

  // save the parameters map
  this._mapParameters = mapParameters;

  // custom agent class, test only
  this.agentClass = options[PARAMS.AGENT_CLASS];
}

/**
 * Determines if qa-mode is on.
 *
 * @returns {Boolean}
 */
ConnectionConfig.prototype.isQaMode = function ()
{
  return this._qaMode;
};

/**
 * Clears all credential-related information.
 */
ConnectionConfig.prototype.clearCredentials = function ()
{
  // clear the password
  this.password = null;

  // TODO: clear passcode and other credential-related information as well
};

const PARAM_TIMEOUT = 'TIMEOUT';
const PARAM_RESULT_PREFETCH = 'RESULTPREFETCH';
const PARAM_RESULT_STREAM_INTERRUPTS = 'RESULTSTREAMINTERRUPTS';
const PARAM_RESULT_CHUNK_CACHE_SIZE = 'RESULTCHUNKCACHESIZE';
const PARAM_RESULT_PROCESSING_BATCH_SIZE = 'RESULTPROCESSINGBATCHSIZE';
const PARAM_RESULT_PROCESSING_BATCH_DURATION = 'RESULTPROCESSINGBATCHDURATION';
const PARAM_ROW_STREAM_HIGH_WATER_MARK = 'ROWSTREAMHIGHWATERMARK';
const PARAM_RETRY_LARGE_RESULT_SET_MAX_NUM_RETRIES = 'LARGERESULTSETRETRYMAXNUMRETRIES';
const PARAM_RETRY_LARGE_RESULT_SET_MAX_SLEEP_TIME = 'LARGERESULTSETRETRYMAXSLEEPTIME';
const PARAM_RETRY_SF_MAX_LOGIN_RETRIES = 'SFRETRYMAXLOGINRETRIES';
const PARAM_RETRY_SF_MAX_NUM_RETRIES = 'SFRETRYMAXNUMRETRIES';
const PARAM_RETRY_SF_STARTING_SLEEP_TIME = 'SFRETRYSTARTINGSLEEPTIME';
const PARAM_RETRY_SF_MAX_SLEEP_TIME = 'SFRETRYMAXSLEEPTIME';

/**
 * Creates the list of known parameters. If a parameter is marked as external,
 * its value can be overridden by adding the appropriate name-value mapping to
 * the ConnectionConfig options.
 *
 * @returns {Object[]}
 */
function createParameters()
{
  var isNonNegativeInteger = Util.number.isNonNegativeInteger.bind(Util.number);
  var isPositiveInteger = Util.number.isPositiveInteger.bind(Util.number);
  var isNonNegativeNumber = Util.number.isNonNegative.bind(Util.number);

  return [
    {
      name: PARAM_TIMEOUT,
      defaultValue: 90 * 1000,
      external: true,
      validate: isPositiveInteger
    },
    {
      name: PARAM_RESULT_PREFETCH,
      defaultValue: 2,
      external: true,
      validate: isPositiveInteger
    },
    {
      name: PARAM_RESULT_STREAM_INTERRUPTS,
      defaultValue: 3,
      validate: isPositiveInteger
    },
    // for now we set chunk cache size to 1, which is same as 
    // disabling the chunk cache. Otherwise, cache will explode
    // memory when fetching large result set 
    {
      name: PARAM_RESULT_CHUNK_CACHE_SIZE,
      defaultValue: 1,
      validate: isPositiveInteger
    },
    {
      name: PARAM_RESULT_PROCESSING_BATCH_SIZE,
      defaultValue: 1000,
      validate: isPositiveInteger
    },
    {
      name: PARAM_RESULT_PROCESSING_BATCH_DURATION,
      defaultValue: 100,
      validate: isPositiveInteger
    },
    {
      name: PARAM_ROW_STREAM_HIGH_WATER_MARK,
      defaultValue: 10,
      validate: isPositiveInteger
    },
    {
      name: PARAM_RETRY_LARGE_RESULT_SET_MAX_NUM_RETRIES,
      defaultValue: 10,
      validate: isNonNegativeInteger
    },
    {
      name: PARAM_RETRY_LARGE_RESULT_SET_MAX_SLEEP_TIME,
      defaultValue: 16,
      validate: isNonNegativeInteger
    },
    {
      name: PARAM_RETRY_SF_MAX_LOGIN_RETRIES,
      defaultValue: 5,
      external: true,
      validate: isNonNegativeInteger
    },
    {
      name: PARAM_RETRY_SF_MAX_NUM_RETRIES,
      defaultValue: 1000,
      validate: isNonNegativeInteger
    },
    {
      name: PARAM_RETRY_SF_STARTING_SLEEP_TIME,
      defaultValue: 0.25,
      validate: isNonNegativeNumber
    },
    {
      name: PARAM_RETRY_SF_MAX_SLEEP_TIME,
      defaultValue: 16,
      validate: isNonNegativeNumber
    }
  ];
}

ConnectionConfig.prototype.getTimeout = function ()
{
  return this._getParameterValue(PARAM_TIMEOUT);
};

ConnectionConfig.prototype.getResultPrefetch = function ()
{
  return this._getParameterValue(PARAM_RESULT_PREFETCH);
};

ConnectionConfig.prototype.getResultStreamInterrupts = function ()
{
  return this._getParameterValue(PARAM_RESULT_STREAM_INTERRUPTS);
};

ConnectionConfig.prototype.getResultChunkCacheSize = function ()
{
  return this._getParameterValue(PARAM_RESULT_CHUNK_CACHE_SIZE);
};

ConnectionConfig.prototype.getResultProcessingBatchSize = function ()
{
  return this._getParameterValue(PARAM_RESULT_PROCESSING_BATCH_SIZE);
};

ConnectionConfig.prototype.getResultProcessingBatchDuration = function ()
{
  return this._getParameterValue(PARAM_RESULT_PROCESSING_BATCH_DURATION);
};

ConnectionConfig.prototype.getRowStreamHighWaterMark = function ()
{
  return this._getParameterValue(PARAM_ROW_STREAM_HIGH_WATER_MARK);
};

ConnectionConfig.prototype.getRetryLargeResultSetMaxNumRetries = function ()
{
  return this._getParameterValue(PARAM_RETRY_LARGE_RESULT_SET_MAX_NUM_RETRIES);
};

ConnectionConfig.prototype.getRetryLargeResultSetMaxSleepTime = function ()
{
  return this._getParameterValue(PARAM_RETRY_LARGE_RESULT_SET_MAX_SLEEP_TIME);
};

ConnectionConfig.prototype.getRetrySfMaxNumRetries = function ()
{
  return this._getParameterValue(PARAM_RETRY_SF_MAX_NUM_RETRIES);
};

ConnectionConfig.prototype.getRetrySfMaxLoginRetries = function ()
{
  return this._getParameterValue(PARAM_RETRY_SF_MAX_LOGIN_RETRIES);
};

ConnectionConfig.prototype.getRetrySfStartingSleepTime = function ()
{
  return this._getParameterValue(PARAM_RETRY_SF_STARTING_SLEEP_TIME);
};

ConnectionConfig.prototype.getRetrySfMaxSleepTime = function ()
{
  return this._getParameterValue(PARAM_RETRY_SF_MAX_SLEEP_TIME);
};

/**
 * Returns the value of a given connection config parameter.
 *
 * @param parameterName
 *
 * @returns {Object}
 * @private
 */
ConnectionConfig.prototype._getParameterValue = function (parameterName)
{
  var parameter = this._mapParameters[parameterName];
  return parameter ? parameter.value : undefined;
};

module.exports = ConnectionConfig;
