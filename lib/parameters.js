/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */

var Util   = require('./util');
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
  this.getName = function()
  {
    return name;
  };

  /**
   * Returns the value of the parameter.
   *
   * @returns {*}
   */
  this.getValue = function()
  {
    return value;
  };

  /**
   * Updates the value of the parameter.
   *
   * @param {*} targetValue
   */
  this.setValue = function(targetValue)
  {
    value = targetValue;
  };
}

var names = exports.names = {};
names.JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS = 'JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS';

var parameters =
[
  new Parameter(
  {
    name  : names.JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS,
    value : false,
    desc  : 'Whether to disable OCSP validation in the JavaScript driver ' +
    'when communicating with non-Snowflake endpoints (e.g. S3/Blob).'
  })
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
exports.getValue = function(parameterName)
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
exports.update = function(parametersConfig)
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