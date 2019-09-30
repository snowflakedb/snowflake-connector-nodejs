/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 *
 */

var util = require('util');
var Url = require('url');

/**
 * Note: A simple wrapper around util.inherits() for now, but this might change
 * in the future.
 *
 * Inherits the prototype methods from one constructor into another. The
 * prototype of constructor will be set to a new object created from
 * superConstructor.
 *
 * @param constructor
 * @param superConstructor
 *
 * @returns {Object}
 */
exports.inherits = function (constructor, superConstructor)
{
  return util.inherits.apply(util, arguments);
};

/**
 * Note: A simple wrapper around util.format() for now, but this will likely
 * change in the future.
 *
 * Returns a formatted string using the first argument as a printf-like format.
 *
 * The first argument is a string that contains zero or more placeholders.
 * Each placeholder is replaced with the converted value from its corresponding
 * argument. Supported placeholders are:
 *   %s - String.
 *   %d - Number (both integer and float).
 *   %j - JSON. Replaced with the string '[Circular]' if the argument contains
 *        circular references.
 *   %% - single percent sign ('%'). This does not consume an argument.
 *
 * If the placeholder does not have a corresponding argument, the placeholder is
 * not replaced.
 *
 * If there are more arguments than placeholders, the extra arguments are
 * coerced to strings (for objects and symbols, util.inspect() is used) and then
 * concatenated, delimited by a space.
 *
 * If the first argument is not a format string then util.format() returns a
 * string that is the concatenation of all its arguments separated by spaces.
 * Each argument is converted to a string with util.inspect().
 *
 * @returns {String}
 */
exports.format = function (format)
{
  return util.format.apply(util, arguments);
};

/**
 * Determines if a given value is a function.
 *
 * @param value
 *
 * @returns {Boolean}
 */
exports.isFunction = function (value)
{
  return !!value && typeof value === 'function';
};

var toString = Object.prototype.toString;

/**
 * Determines if a given value is an object.
 *
 * @param value
 *
 * @returns {Boolean}
 */
exports.isObject = function (value)
{
  return toString.call(value) === '[object Object]';
};

/**
 * Determines if a given value is a Date.
 *
 * @param value
 *
 * @returns {Boolean}
 */
exports.isDate = function (value)
{
  return toString.call(value) === '[object Date]';
};

/**
 * Determines if a given value is an array.
 *
 * @param value
 *
 * @returns {Boolean}
 */
exports.isArray = function (value)
{
  return toString.call(value) === '[object Array]';
};

/**
 * Determines if a given value is a string.
 *
 * @param value
 *
 * @returns {Boolean}
 */
exports.isString = function (value)
{
  return typeof value === 'string';
};

/**
 * Determines if a given value is a boolean.
 *
 * @param value
 *
 * @returns {Boolean}
 */
exports.isBoolean = function (value)
{
  return typeof value === 'boolean';
};

/**
 * Determines if a given value is a number.
 *
 * @param value
 *
 * @returns {Boolean}
 */
exports.isNumber = function (value)
{
  return typeof value === 'number' && isFinite(value);
};

/**
 * A collection of number-related utility functions.
 */
exports.number =
  {
    /**
     * Determines if a given value is a positive number.
     *
     * @param value
     *
     * @returns {Boolean}
     */
    isPositive: function (value)
    {
      return exports.isNumber(value) && (value > 0);
    },

    /**
     * Determines if a given value is a non-negative number.
     *
     * @param value
     *
     * @returns {Boolean}
     */
    isNonNegative: function (value)
    {
      return exports.isNumber(value) && (value >= 0);
    },

    /**
     * Determines if a given value is an integer.
     *
     * @param value
     *
     * @returns {Boolean}
     */
    isInteger: function (value)
    {
      return exports.isNumber(value) && (Math.floor(value) === value);
    },

    /**
     * Determines if a given value is a positive integer.
     *
     * @param value
     *
     * @returns {Boolean}
     */
    isPositiveInteger: function (value)
    {
      return this.isInteger(value) && (value > 0);
    },

    /**
     * Determines if a given value is a non-negative integer.
     *
     * @param value
     *
     * @returns {Boolean}
     */
    isNonNegativeInteger: function (value)
    {
      return this.isInteger(value) && (value >= 0);
    }
  };

/**
 * A collection of string-related utility functions.
 */
exports.string =
  {
    /**
     * Determines if a given string is not null or empty.
     *
     * @param {*} value
     *
     * @returns {Boolean}
     */
    isNotNullOrEmpty: function (value)
    {
      return exports.isString(value) && value;
    },

    /**
     * Compares two version numbers of the form 'a.b.c' where a, b and c are
     * numbers (e.g. '1.0.12'). If one or both inputs are invalid versions, the
     * function will return NaN, otherwise, it will return -1 if the first
     * version is smaller, 1 if the first version is bigger, and 0 if the two
     * versions are equal.
     *
     * @param {String} version1
     * @param {String} version2
     *
     * @returns {Number}
     */
    compareVersions: function (version1, version2)
    {
      // if one or both inputs are valid, return NaN
      if (!exports.isString(version1) || !exports.isString(version2))
      {
        return NaN;
      }

      // split on dot
      var version1Parts = version1.split('.');
      var version2Parts = version2.split('.');

      // add trailing zeros to make the parts arrays the same length
      while (version1Parts.length < version2Parts.length)
      {
        version1Parts.push('0');
      }
      while (version2Parts.length < version1Parts.length)
      {
        version2Parts.push('0');
      }

      // compare elements in the two arrays one by one
      var result = 0;
      var version1Part, version2Part;
      for (var index = 0, length = version1Parts.length; index < length; index++)
      {
        // convert to number before doing any arithmetic
        version1Part = Number(version1Parts[index]);
        version2Part = Number(version2Parts[index]);

        // if one or both values are not numerical, consider the input invalid
        if (!exports.isNumber(version1Part) || !exports.isNumber(version2Part))
        {
          result = NaN;
          break;
        }

        // if the two values are different, pick the
        // correct result based on which value is smaller
        if (version1Part !== version2Part)
        {
          result = version1Part < version2Part ? -1 : 1;
          break;
        }
      }

      return result;
    }
  };

/**
 * Determines if a given value is not null or undefined.
 *
 * @param value
 *
 * @returns {Boolean}
 */
exports.exists = function (value)
{
  return (value !== null) && (value !== undefined);
};

/**
 * A collection of url-related utility functions.
 */
exports.url =
  {
    /**
     * Appends a query parameter to a url. If an invalid url is specified, an
     * exception is thrown.
     *
     * @param {String} url
     * @param {String} paramName the name of the query parameter.
     * @param {String} paramValue the value of the query parameter.
     *
     * @returns {String}
     */
    appendParam: function (url, paramName, paramValue)
    {
      // if the specified url is valid
      var urlAsObject = Url.parse(url);
      if (urlAsObject)
      {
        // if the url already has query parameters, use '&' as the separator
        // when appending the additional query parameter, otherwise use '?'
        url += (urlAsObject.search ? '&' : '?') + paramName + '=' + paramValue;
      }

      return url;
    }
  };

/**
 * Shallow-copies everything from a source object into a destination object.
 *
 * @param {Object} dst the object to copy properties to.
 * @param {Object} src the object to copy properties from.
 *
 * @returns {Object} the destination object.
 */
exports.apply = function (dst, src)
{
  // if both dst and src are objects, copy everything from src to dst
  if (this.isObject(dst) && this.isObject(src))
  {
    for (var key in src)
    {
      if (src.hasOwnProperty(key))
      {
        dst[key] = src[key];
      }
    }
  }

  return dst;
};

/**
 * Returns true if the code is currently being run in the browser, false
 * otherwise.
 *
 * @returns {Boolean}
 */
exports.isBrowser = function ()
{
  return !!(process && process.browser);
};

/**
 * Returns true if the code is currently being run in node, false otherwise.
 *
 * @returns {Boolean}
 */
exports.isNode = function ()
{
  return !this.isBrowser();
};

/**
 * Returns the next sleep time calculated by exponential backoff with
 * decorrelated jitter.
 *  sleep = min(cap, random_between(base, sleep * 3))
 * for more details, check out:
 * http://www.awsarchitectureblog.com/2015/03/backoff.html
 * @param base minimum seconds
 * @param cap maximum seconds
 * @param previousSleep previous sleep time
 * @returns {number} next sleep time
 */
exports.nextSleepTime = function (
  base, cap, previousSleep)
{
  return Math.min(cap, Math.abs(previousSleep * 3 - base) * Math.random() +
    Math.min(base, previousSleep * 3));
};

/**
 * Checks if the HTTP response code is retryable
 *
 * @param response HTTP response object
 * @param retry403 will retry HTTP 403?
 * @returns {*|boolean} true if retryable otherwise false
 */
exports.isRetryableHttpError = function (response, retry403)
{
  return response &&
    ((response.statusCode >= 500 && response.statusCode < 600) ||
      (retry403 && response.statusCode === 403) ||
      (response.statusCode === 408));
};

exports.validateClientSessionKeepAliveHeartbeatFrequency = function (input, masterValidity)
{
  var heartbeatFrequency = input;
  var realMax = Math.floor(masterValidity / 4);
  var realMin = Math.floor(realMax / 4);
  if (input > realMax)
  {
    heartbeatFrequency = realMax;
  }
  else if (input < realMin)
  {
    heartbeatFrequency = realMin;
  }

  heartbeatFrequency = Math.floor(heartbeatFrequency);
  return heartbeatFrequency;
};

// driver version
const driverVersion = require('./../package.json').version;
exports.driverVersion = driverVersion;

// nodeJS version
let nodeJSVersion = process.version;
if (nodeJSVersion && nodeJSVersion.startsWith('v'))
{
  nodeJSVersion = nodeJSVersion.substring(1);
}
// user-agent HTTP header
const userAgent = 'JavaScript' + '/' + driverVersion
  + ' (' + process.platform + '-' + process.arch + ') ' + 'NodeJS' + '/' + nodeJSVersion;

exports.userAgent = userAgent;
