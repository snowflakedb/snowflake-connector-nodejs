/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const os = require('os');
const url = require('url');
const Util = require('../util');
const Errors = require('../errors');
const ErrorCodes = Errors.codes;
const NativeTypes = require('./result/data_types').NativeTypes;
const GlobalConfig = require('../global_config');

function consolidateHostAndAccount(options)
{
  let dotPos = -1;
  let realAccount = undefined;
  if (Util.exists(options.account))
  {
    Errors.checkArgumentValid(Util.isString(options.account), ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT);
    dotPos = options.account.indexOf('.');
    realAccount = options.account;
    if (dotPos > 0)
    {
      realAccount = realAccount.substring(0, dotPos);
    }
  }

  if (!Util.isString(options.accessUrl) || !Util.exists(options.accessUrl))
  {
    if (options.region === 'us-west-2')
    {
      options.region = '';
    }
    if (dotPos < 0 && Util.isString(options.region) && options.region.length > 0)
    {
      options.accessUrl = Util.format('https://%s.%s.snowflakecomputing.com', options.account, options.region);
    }
    else
    {
      options.accessUrl = Util.format('https://%s.snowflakecomputing.com', options.account);
    }
  }
  else if (!Util.exists(options.account))
  {
    try
    {
      const parsedUrl = url.parse(options.accessUrl);
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
  if (Util.exists(realAccount) && options.accessUrl.endsWith("global.snowflakecomputing.com"))
  {
    const dashPos = realAccount.indexOf('-');
    if (dashPos > 0)
    {
      // global URL
      realAccount = realAccount.substring(0, dashPos);
    }
  }
  options.account = realAccount;
  // check for missing password
  Errors.checkArgumentExists(Util.exists(options.account), ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT);
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

  // only validate credentials if necessary
  if (validateCredentials)
  {
    // check for missing username
    Errors.checkArgumentExists(Util.exists(options.username),
      ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME);

    // check for invalid username
    Errors.checkArgumentValid(Util.isString(options.username),
      ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME);

    // check for missing password
    Errors.checkArgumentExists(Util.exists(options.password),
      ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD);

    // check for invalid password
    Errors.checkArgumentValid(Util.isString(options.password),
      ErrorCodes.ERR_CONN_CREATE_INVALID_PASSWORD);

    consolidateHostAndAccount(options);
  }

  // check for missing accessUrl
  Errors.checkArgumentExists(Util.exists(options.accessUrl),
    ErrorCodes.ERR_CONN_CREATE_MISSING_ACCESS_URL);

  // check for invalid accessUrl
  Errors.checkArgumentValid(Util.isString(options.accessUrl),
    ErrorCodes.ERR_CONN_CREATE_INVALID_ACCESS_URL);

  var proxyHost = options.proxyHost;
  var proxyPort = options.proxyPort;

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

  var warehouse = options.warehouse;
  var database = options.database;
  var schema = options.schema;
  var role = options.role;

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
  var streamResult = options.streamResult;
  if (Util.exists(streamResult))
  {
    Errors.checkArgumentValid(Util.isBoolean(streamResult),
      ErrorCodes.ERR_CONN_CREATE_INVALID_STREAM_RESULT);
  }

  // check for invalid fetchAsString
  var fetchAsString = options.fetchAsString;
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
  var clientSessionKeepAlive = options.clientSessionKeepAlive;
  if (Util.exists(clientSessionKeepAlive))
  {
    Errors.checkArgumentValid(Util.isBoolean(clientSessionKeepAlive),
      ErrorCodes.ERR_CONN_CREATE_INVALID_KEEP_ALIVE);
  }

  // check for invalid clientSessionKeepAliveHeartbeatFrequency
  var clientSessionKeepAliveHeartbeatFrequency = options.clientSessionKeepAliveHeartbeatFrequency;
  if (Util.exists(clientSessionKeepAliveHeartbeatFrequency))
  {
    Errors.checkArgumentValid(Util.isNumber(clientSessionKeepAliveHeartbeatFrequency),
      ErrorCodes.ERR_CONN_CREATE_INVALID_KEEP_ALIVE_HEARTBEAT_FREQ);
    clientSessionKeepAliveHeartbeatFrequency =
      Util.validateClientSessionKeepAliveHeartbeatFrequency(clientSessionKeepAliveHeartbeatFrequency, 14400);
  }

  var jsTreatIntegerAsBigInt = options.jsTreatIntegerAsBigInt;
  if (Util.exists(jsTreatIntegerAsBigInt))
  {
    Errors.checkArgumentValid(Util.isBoolean(jsTreatIntegerAsBigInt),
      ErrorCodes.ERR_CONN_CREATE_INVALID_TREAT_INTEGER_AS_BIGINT);
  }

  // remember if we're in qa mode
  this._qaMode = qaMode;

  // if a client-info argument is specified, validate it
  var clientVersion;
  var clientEnvironment;
  if (Util.exists(clientInfo))
  {
    Errors.assertInternal(Util.isObject(clientInfo));
    Errors.assertInternal(Util.isString(clientInfo.version));
    Errors.assertInternal(Util.isObject(clientInfo.environment));

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
  this.username = options.username;
  this.password = options.password;
  this.accessUrl = options.accessUrl;
  this.account = options.account;
  this.sessionToken = options.sessionToken;
  this.masterToken = options.masterToken;
  this.masterTokenExpirationTime = options.masterTokenExpirationTime;
  this.sessionTokenExpirationTime = options.sessionTokenExpirationTime;

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
  this.agentClass = options.agentClass;
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

const PARAM_TIMEOUT = 'timeout';
const PARAM_RESULT_PREFETCH = 'resultPrefetch';
const PARAM_RESULT_STREAM_INTERRUPTS = 'resultStreamInterrupts';
const PARAM_RESULT_CHUNK_CACHE_SIZE = 'resultChunkCacheSize';
const PARAM_RESULT_PROCESSING_BATCH_SIZE = 'resultProcessingBatchSize';
const PARAM_RESULT_PROCESSING_BATCH_DURATION = 'resultProcessingBatchDuration';
const PARAM_ROW_STREAM_HIGH_WATER_MARK = 'rowStreamHighWaterMark';
const PARAM_RETRY_LARGE_RESULT_SET_MAX_NUM_RETRIES = 'largeResultSetRetryMaxNumRetries';
const PARAM_RETRY_LARGE_RESULT_SET_MAX_SLEEP_TIME = 'largeResultSetRetryMaxSleepTime';
const PARAM_RETRY_SF_MAX_LOGIN_RETRIES = 'sfRetryMaxLoginRetries';
const PARAM_RETRY_SF_MAX_NUM_RETRIES = 'sfRetryMaxNumRetries';
const PARAM_RETRY_SF_STARTING_SLEEP_TIME = 'sfRetryStartingSleepTime';
const PARAM_RETRY_SF_MAX_SLEEP_TIME = 'sfRetryMaxSleepTime';

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
