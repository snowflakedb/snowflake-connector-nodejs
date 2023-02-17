/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('./util');
var Errors = require('./errors');

/**
 * Creates a new Parameter.
 *
 * @param {Object} options
 * @constructor
 */
function Parameter(options)
{
  // validate input
  Errors.assertInternal(Util.isObject(options));
  Errors.assertInternal(Util.isString(options.name));
  Errors.assertInternal(Util.exists(options.value));

  var name = options.name;
  var value = options.value;

  /**
   * Returns the name of the parameter.
   *
   * @returns {String}
   */
  this.getName = function ()
  {
    return name;
  };

  /**
   * Returns the value of the parameter.
   *
   * @returns {*}
   */
  this.getValue = function ()
  {
    return value;
  };

  /**
   * Updates the value of the parameter.
   *
   * @param {*} targetValue
   */
  this.setValue = function (targetValue)
  {
    value = targetValue;
  };
}

var names = exports.names = {};
names.JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS = 'JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS';
names.SERVICE_NAME = 'SERVICE_NAME';
names.CLIENT_SESSION_KEEP_ALIVE = 'CLIENT_SESSION_KEEP_ALIVE';
names.CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY = 'CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY';
names.JS_TREAT_INTEGER_AS_BIGINT = 'JS_TREAT_INTEGER_AS_BIGINT';
names.CLIENT_STAGE_ARRAY_BINDING_THRESHOLD = 'CLIENT_STAGE_ARRAY_BINDING_THRESHOLD';
names.MULTI_STATEMENT_COUNT = 'MULTI_STATEMENT_COUNT';

var parameters =
  [
    new Parameter(
      {
        name: names.JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS,
        value: false,
        desc: 'Whether to disable OCSP validation in the JavaScript driver ' +
          'when communicating with non-Snowflake endpoints (e.g. S3/Blob).'
      }),
    new Parameter(
      {
        name: names.SERVICE_NAME,
        value: '',
        desc: 'Hint for load balancer.'
      }),
    new Parameter(
      {
        name: names.CLIENT_SESSION_KEEP_ALIVE,
        value: false,
        desc: 'When true, enables the driver to keep the session alive indefinitely'
      }),
    new Parameter(
      {
        name: names.CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY,
        value: 3600,
        desc: 'The amount of time in seconds that a heartbeat will be sent to the server'
      }),
    new Parameter(
      {
        name: names.JS_TREAT_INTEGER_AS_BIGINT,
        value: false,
        desc: 'When true, enables the driver converts integer columns into BigInt'
      }),
    new Parameter(
      {
        name: names.CLIENT_STAGE_ARRAY_BINDING_THRESHOLD,
        value: 100000,
        desc: 'The client stage array binding threshold'
      }),
    new Parameter(
      {
        name: names.MULTI_STATEMENT_COUNT,
        value: 1,
        desc: 'When 1, multi statement is disable, when 0, multi statement is unlimited'
      }),
  ];

// put all the parameters in a map so they're easy to retrieve and update
var mapParamNameToParam = {};
for (var index = 0, length = parameters.length; index < length; index++)
{
  var parameter = parameters[index];
  mapParamNameToParam[parameter.getName()] = parameter;
}

/**
 * Returns the value of a given parameter.
 *
 * @param {String} parameterName
 *
 * @returns {*}
 */
exports.getValue = function (parameterName)
{
  // resolve the parameter name
  var parameter = mapParamNameToParam[parameterName];

  // verify that a valid parameter name was specified
  Errors.assertInternal(
    Util.exists(parameter), 'invalid parameter name: ' + parameterName);

  return parameter.getValue();
};

/**
 * Updates the parameter values.
 *
 * @param {Object[]} parametersConfig
 */
exports.update = function (parametersConfig)
{
  // if an input is specified
  if (Util.exists(parametersConfig))
  {
    Errors.assertInternal(Util.isArray(parametersConfig));

    // if any of the items in the configs array matches a known
    // parameter, update the corresponding parameter's value
    for (var index = 0, length = parametersConfig.length;
         index < length; index++)
    {
      var parameterConfig = parametersConfig[index];
      if (mapParamNameToParam.hasOwnProperty(parameterConfig.name))
      {
        var parameter = mapParamNameToParam[parameterConfig.name];
        parameter.setValue(parameterConfig.value);
      }
    }
  }
};