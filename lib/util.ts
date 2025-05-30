import util from 'util';
import Url from 'url';
import os from 'os';
import * as Logger from './logger';
import fs from 'fs';
// NOTE: keeping require as it's a circular dependency so * as Errors doesn't work
const Errors = require('./errors');
import net from 'net';
import { name as driverName, version as driverVersion } from '../package.json';

const nodeJSVersion = process.version?.startsWith('v')
  ? process.version.substring(1)
  : process.version;

export { driverName, driverVersion };

export const userAgent = `JavaScript/${driverVersion} (${process.platform}-${process.arch}) NodeJS/${nodeJSVersion}`;

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
export function inherits(constructor: any, superConstructor: any) {
  return util.inherits.apply(util, [constructor, superConstructor]);
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
 */
export function format(format: string, ...params: any[]): string {
  return util.format.apply(util, [format, ...params]);
};

/**
 * Determines if a given value is a function.
 */
export function isFunction(value: any) {
  return !!value && typeof value === 'function';
};

const toString = Object.prototype.toString;

/**
 * Determines if a given value is an object.
 */
export function isObject(value: any) {
  return toString.call(value) === '[object Object]';
};

/**
 * Determines if a given value is a Date.
 */
export function isDate(value: any) {
  return toString.call(value) === '[object Date]';
};

/**
 * Determines if a given value is an array.
 */
export function isArray(value: any) {
  return toString.call(value) === '[object Array]';
};

/**
 * Determines if a given value is a string.
 */
export function isString(value: any) {
  return typeof value === 'string';
};

/**
 * Determines if a given value is a boolean.
 */
export function isBoolean(value: any) {
  return typeof value === 'boolean';
};

/**
 * Determines if a given value is a number.
 */
export function isNumber(value: any) {
  return typeof value === 'number' && isFinite(value);
};

/**
 * Determines if a given value is a private key string in pem format of type pkcs8.
 */
export function isPrivateKey(value: string) {
  const trimmedValue = value.trim();
  // The private key is expected to be decrypted when set in the connection string
  // secret scanner complains about first check since it looks like private key, but it's only check
  // pragma: allowlist nextline secret
  return (trimmedValue.startsWith('-----BEGIN PRIVATE KEY-----') &&
    trimmedValue.endsWith('\n-----END PRIVATE KEY-----'));
};

/**
 * A collection of number-related utility functions.
 */
export const number =
  {
    /**
     * Determines if a given value is a positive number.
     */
    isPositive: function (value: any) {
      return isNumber(value) && (value > 0);
    },

    /**
     * Determines if a given value is a non-negative number.
     */
    isNonNegative: function (value: any) {
      return isNumber(value) && (value >= 0);
    },

    /**
     * Determines if a given value is an integer.
     */
    isInteger: function (value: any) {
      return isNumber(value) && (Math.floor(value) === value);
    },

    /**
     * Determines if a given value is a positive integer.
     */
    isPositiveInteger: function (value: any) {
      return this.isInteger(value) && (value > 0);
    },

    /**
     * Determines if a given value is a non-negative integer.
     */
    isNonNegativeInteger: function (value: any) {
      return this.isInteger(value) && (value >= 0);
    }
  };

/**
 * A collection of string-related utility functions.
 */
export const string =
  {
    /**
     * Determines if a given string is not null or empty.
     */
    isNotNullOrEmpty: function (value: any) {
      return isString(value) && value;
    },

    /**
     * Compares two version numbers of the form 'a.b.c' where a, b and c are
     * numbers (e.g. '1.0.12'). If one or both inputs are invalid versions, the
     * function will return NaN, otherwise, it will return -1 if the first
     * version is smaller, 1 if the first version is bigger, and 0 if the two
     * versions are equal.
     */
    compareVersions: function (version1: string, version2: string) {
      // if one or both inputs are valid, return NaN
      if (!isString(version1) || !isString(version2)) {
        return NaN;
      }

      // split on dot
      const version1Parts = version1.split('.');
      const version2Parts = version2.split('.');

      // add trailing zeros to make the parts arrays the same length
      while (version1Parts.length < version2Parts.length) {
        version1Parts.push('0');
      }
      while (version2Parts.length < version1Parts.length) {
        version2Parts.push('0');
      }

      // compare elements in the two arrays one by one
      let result = 0;
      let version1Part, version2Part;
      for (let index = 0, length = version1Parts.length; index < length; index++) {
        // convert to number before doing any arithmetic
        version1Part = Number(version1Parts[index]);
        version2Part = Number(version2Parts[index]);

        // if one or both values are not numerical, consider the input invalid
        if (!isNumber(version1Part) || !isNumber(version2Part)) {
          result = NaN;
          break;
        }

        // if the two values are different, pick the
        // correct result based on which value is smaller
        if (version1Part !== version2Part) {
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
 * @deprecated Just use if (!value) instead
 */
export function exists(value: any) {
  return (value !== null) && (value !== undefined);
};

/**
 * A collection of url-related utility functions.
 */
export const url =
  {
    /**
     * Appends a query parameter to a url. If an invalid url is specified, an
     * exception is thrown.
     *
     * @param url
     * @param paramName the name of the query parameter.
     * @param paramValue the value of the query parameter.
     */
    appendParam: function (url: string, paramName: string, paramValue: any) {
      // if the specified url is valid
      const urlAsObject = Url.parse(url);
      if (urlAsObject) {
        // if the url already has query parameters, use '&' as the separator
        // when appending the additional query parameter, otherwise use '?'
        url += (urlAsObject.search ? '&' : '?') + paramName + '=' + paramValue;
      }

      return url;
    },

    appendRetryParam: function (option: { url: string, retryCount: number, includeRetryReason: boolean, retryReason: string }) {
      let retryUrl = this.appendParam(option.url, 'retryCount', option.retryCount);
      if (option.includeRetryReason) {
        retryUrl = this.appendParam(retryUrl, 'retryReason', option.retryReason);
      }

      return retryUrl;
    }
  };

/**
 * Shallow-copies everything from a source object into a destination object.
 *
 * @param {Object} dst the object to copy properties to.
 * @param {Object} src the object to copy properties from.
 */
export function apply(dst: any, src: any) {
  // if both dst and src are objects, copy everything from src to dst
  if (isObject(dst) && isObject(src)) {
    for (const key in src) {
      if (Object.prototype.hasOwnProperty.call(src, key)) {
        dst[key] = src[key];
      }
    }
  }

  return dst;
};

/**
 * Returns true if the code is currently being run in the browser, false
 * otherwise.
 */
export function isBrowser() {
  // @ts-ignore TS2339: Property 'browser' does not exist on type 'Process'
  return !!(process && process.browser);
};

/**
 * Returns true if the code is currently being run in node, false otherwise.
 */
export function isNode() {
  return !isBrowser();
};

/**
 * Returns the next sleep time calculated by exponential backoff with
 * decorrelated jitter.
 * sleep = min(cap, random_between(base, sleep * 3))
 * for more details, check out:
 * http://www.awsarchitectureblog.com/2015/03/backoff.html
 * @param base minimum seconds
 * @param cap maximum seconds
 * @param previousSleep previous sleep time
 */
export function nextSleepTime(base: number, cap: number, previousSleep: number) {
  return Math.min(cap, Math.abs(previousSleep * 3 - base) * Math.random() +
    Math.min(base, previousSleep * 3));
};


/**
 * Return next sleep time calculated by the jitter rule.
 */
export function getJitteredSleepTime(numofRetries: number, currentSleepTime: number, totalElapsedTime: number, maxRetryTimeout: number) {
  const nextsleep = getNextSleepTime(numofRetries, currentSleepTime);
  const sleep = maxRetryTimeout !== 0 ? Math.min((maxRetryTimeout - totalElapsedTime), nextsleep) : nextsleep;
  totalElapsedTime += sleep;
  return { sleep, totalElapsedTime };
};

/**
 * Choose one of the number between two numbers.
 */
export function chooseRandom(firstNumber: number, secondNumber: number) {
  return Math.random() * (firstNumber - secondNumber) + secondNumber;
}

/**
 * return the next sleep Time.
 */
export function getNextSleepTime(numofRetries: number,  currentSleepTime: number) {
  const nextSleep = (2 ** (numofRetries));
  return chooseRandom(currentSleepTime + getJitter(currentSleepTime), nextSleep + getJitter(currentSleepTime));
}

/**
 * return the jitter value.
 */
export function getJitter(currentSleepTime: number) {
  const multiplicationFactor = chooseRandom(1, -1);
  return 0.5 * currentSleepTime * multiplicationFactor;
}

/**
 * Check whether the request is the login-request or not.
 */
export function isLoginRequest(loginUrl: string) {
  const endPoints = ['/v1/login-request', '/authenticator-request',];
  return endPoints.some((endPoint) => loginUrl.includes(endPoint));
};

/**
 * Checks if the HTTP response code is retryable
 *
 * @param response HTTP response object
 * @param retry403 will retry HTTP 403?
 */
export function isRetryableHttpError(response: any, retry403: boolean) {
  return response &&
    ((response.statusCode >= 500 && response.statusCode < 600) ||
      (retry403 && response.statusCode === 403) ||
      (response.statusCode === 408) ||
      (response.statusCode === 429));
};

export function validateClientSessionKeepAliveHeartbeatFrequency(input: number, masterValidity: number) {
  let heartbeatFrequency = input;
  const realMax = Math.floor(masterValidity / 4);
  const realMin = Math.floor(realMax / 4);
  if (input > realMax) {
    heartbeatFrequency = realMax;
  } else if (input < realMin) {
    heartbeatFrequency = realMin;
  }

  heartbeatFrequency = Math.floor(heartbeatFrequency);
  return heartbeatFrequency;
};

/**
 * Constructs host name using region and account
 *
 * @param region where the account is located
 * @param account which account to connect to
 */
export function constructHostname(region: string, account: string) {
  let host;
  if (region === 'us-west-2') {
    host = account + '.snowflakecomputing.com';
  } else if (region != null) {
    if (account.indexOf('.') > 0) {
      account = account.substring(0, account.indexOf('.'));
    }
    if (region.startsWith('cn-') || region.startsWith('CN-')) {
      host = account + '.' + region + '.snowflakecomputing.cn';
    } else {
      host = account + '.' + region + '.snowflakecomputing.com';
    }

  } else {
    host = account + '.snowflakecomputing.com';
  }
  return host;
};

/**
 * Returns true if host indicates private link
 */
export function isPrivateLink(host: string) {
  Errors.checkArgumentExists(exists(host), Errors.codes.ERR_CONN_CREATE_MISSING_HOST);
  return host.toLowerCase().includes('privatelink.snowflakecomputing.');
};


export function createOcspResponseCacheServerUrl(host: string) {
  return `http://ocsp.${host}/ocsp_response_cache.json`;
};

/**
 * Returns if command is a PUT command
 */
export function isPutCommand(sqlText: string) {
  return (sqlText.trim().substring(0, 3).toUpperCase() === 'PUT');
};

/**
 * Returns if command is a GET command
 */
export function isGetCommand(sqlText: string) {
  return (sqlText.trim().substring(0, 3).toUpperCase() === 'GET');
};

/**
 * Add double quotes to smkId's value to parse it as a string instead of integer
 * to preserve precision of numbers exceeding JavaScript's max safe integer
 * e.g (inputting 32621973126123526	outputs 32621973126123530)
 *
 * @param body the data in JSON
 */
export function convertSmkIdToString(body: string) {
  return body.replace(/"smkId"(\s*):(\s*)([0-9]+)/g, '"smkId"$1:$2"$3"');
};

/**
 * Under some circumstances the object passed to JSON.stringify in exception handling
 * can contain circular reference, on which JSON.stringify bails out
 * MDN way of handling such error
 */
export function getCircularReplacer() {
  const ancestors: string[] = [];
  return function(key: string, value: any): string {
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    // `this` is the object that value is contained in,
    // i.e., its direct parent.
    // @ts-ignore TS2683: 'this' implicitly has type 'any' because it does not have a type annotation.
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(value)) {
      return '[Circular]';
    }
    ancestors.push(value);
    return value;
  };
};

/**
 * Returns if the provided string is a valid subdomain.
 */
export function isCorrectSubdomain(value: string) {
  const subdomainRegex = RegExp(/^\w+([.-]\w+)*$/i);
  return subdomainRegex.test(value);
};

export function buildCredentialCacheKey(host: string, username: string, credType: string) {
  if (!host || !username || !credType) {
    Logger.getInstance().debug('Cannot build the credential cache key because one of host, username, and credType is null');
    return null;
  }
  return `{${host.toUpperCase()}}:{${username.toUpperCase()}}:{${credType.toUpperCase()}}`;
};

export function checkValidCustomCredentialManager(customCredentialManager: any) {
  if ( typeof customCredentialManager !== 'object') {
    return false;
  }

  const requireMethods = ['write', 'read', 'remove'];

  for (const method of requireMethods) {
    if (!Object.hasOwnProperty.call(customCredentialManager, method) || typeof customCredentialManager[method] !== 'function') {
      return false;
    }
  }
  return true;
};

export function checkParametersDefined(...parameters: any[]) {
  return parameters.every((element) => element !== undefined && element !== null);
};

export function shouldPerformGCPBucket(accessToken: string) {
  return !!accessToken && process.env.SNOWFLAKE_FORCE_GCP_USE_DOWNSCOPED_CREDENTIAL !== 'true';
};

/**
 * Checks if the provided file or directory permissions are correct.
 * @param filePath
 * @param expectedMode
 * @param fsPromises
 * @returns {Promise<boolean>} resolves always to true for Windows
 */
export async function isFileModeCorrect(filePath: string, expectedMode: number, fsPromises: any) {
  if (os.platform() === 'win32') {
    return true;
  }
  return await fsPromises.stat(filePath).then((stats: any) => {
    // we have to limit the number of LSB bits to 9 with the mask, as the stats.mode starts with the file type,
    // e.g. the directory with permissions 755 will have stats.mask of 40755.
    const mask = (1 << 9) - 1;
    return (stats.mode & mask) === expectedMode;
  });
};

/**
 * Checks if the provided file or directory is writable only by the user.
 * @returns {Promise<boolean>} resolves always to true for Windows
 */
export async function isFileNotWritableByGroupOrOthers(configFilePath: string, fsPromises: any) {
  if (os.platform() === 'win32') {
    return true;
  }
  const stats = await fsPromises.stat(configFilePath);
  return (stats.mode & (1 << 4)) === 0 && (stats.mode & (1 << 1)) === 0;
};

export function shouldRetryOktaAuth({ maxRetryTimeout, maxRetryCount, numRetries, startTime, remainingTimeout }: { maxRetryTimeout: number, maxRetryCount: number, numRetries: number, startTime: number, remainingTimeout: number }) {
  return  (maxRetryTimeout === 0 || Date.now() < startTime + remainingTimeout) && numRetries <= maxRetryCount;
};

export function getDriverDirectory() {
  return __dirname;
};

export function validatePath(dir: string) {
  try {
    const stat = fs.statSync(dir);
    return stat.isDirectory();
  } catch {
    Logger.getInstance().error('The location is invalid. Please check this location is accessible or existing');
    return false;
  }
};

export function getEnvVar(variable: string) {
  return process.env[variable.toLowerCase()] || process.env[variable.toUpperCase()];
};

export function validateEmptyString(value: string) {
  return value !== '' ? value : undefined;
};

export function isNotEmptyAsString(variable: string) {
  if (typeof variable === 'string') {
    return variable;
  }
  return exists(variable);
};

export function isNotEmptyString(variable: string) {
  return exists(variable) && variable !== '';
};

/**
 * Checks Whether the object is empty (can be null or undefined) or not.
 */
export function isEmptyObject(object: object) {
  if (!exists(object)) {
    return true;
  }
  if (typeof object !== 'object') {
    return false;
  }
  return Object.keys(object).length === 0;
};

export function isWindows() {
  return os.platform() === 'win32';
};

export async function getFreePort() {
  return new Promise(res => {
    const srv = net.createServer();
    srv.listen(0, () => {
      // @ts-ignore TS2339: Property 'port' does not exist on type 'string | AddressInfo'
      const port = srv.address().port;
      srv.close(() => res(port));
    });
  });
};

export async function isPortOpen(port: number) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', (err: NodeJS.ErrnoException) => {
      s.close();
      if (err['code'] === 'EADDRINUSE') {
        Logger.getInstance().trace(`Port: ${port} is not available. Verification failed`);
        reject('Port not available.');
      } else {
        Logger.getInstance().trace(`There is unexpected error during verification of port availability. Port: ${port}. Error: ${JSON.stringify(err)}`);
      }
    });
    s.once('listening', () => {
      s.close();
      Logger.getInstance().trace(`Closing server run for verification whether the port is available. Port: ${port}`);
      resolve('Listening');
    });
    s.listen(port);
  });
};


/**
* Left strip the specified character from a string.
*/
export function lstrip(str: string, remove: string) {
  while (str.length > 0 && remove.indexOf(str.charAt(0)) !== -1) {
    str = str.substr(1);
  }
  return str;
};


/**
 * This method transforms HTML special characters into their corresponding entity representations.
 */
export function escapeHTML(value: string) {
  if (!exists(value)) {
    return value;
  }
  return value.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Typescript with "module": "commonjs" will transform every import() to a require() statement.
 *
 * This will break ESM dynamic imports resulting in a runtime error:
 * -require() of ES Module... from ... not supported.
 *
 * A hacky solution - https://github.com/microsoft/TypeScript/issues/43329
 *
 * This could be removed once we drop node 18 support as Node 20+ support esm in require()
 */
export async function dynamicImportESMInTypescriptWithCommonJS(moduleName: string) {
  return Function(`return import("${moduleName}")`)()
}
