const Logger = require('../../../lib/logger');
const { NodeHttpClient } = require('../../../lib/http/node');
const Util = require('../../../lib/util');

const HOOK_TYPE = {
  FOR_ARGS: 'args',
  FOR_RETURNED_VALUE: 'returned',
};

module.exports.HOOK_TYPE = HOOK_TYPE;

class Interceptor {
  constructor(methodName, hookType, callback) {
    this.methodName = methodName;
    this.hookType = hookType || HOOK_TYPE.FOR_ARGS;
    this.callback = callback;
  }

  execute(...args) {
    this.callback(...args);
  }
}

class Interceptors {
  constructor(initialInterceptors) {
    this.interceptorsMap = this.createInterceptorsMap(initialInterceptors);
  }

  add(methodName, hookType, callback, interceptor = undefined) {
    if (!interceptor) {
      interceptor = new Interceptor(methodName, hookType, callback);
    }
    this.interceptorsMap[interceptor.methodName][interceptor.hookType] = interceptor;
  }

  get(methodName, hookType) {
    return this.interceptorsMap[methodName][hookType];
  }

  intercept(methodName, hookType, ...args) {
    // When no interceptor registered - ignores and does not raise any error
    try {
      return this.get(methodName, hookType)?.execute(...args);
    } catch (e) {
      throw 'Unable to execute interceptor method in tests.  Error: ' + e;
    }
  }

  clear() {
    this.interceptorsMap = this.createInterceptorsMap();
  }

  createInterceptorsMap(initialInterceptors = {}) {
    if (initialInterceptors instanceof Interceptors) {
      return initialInterceptors.interceptorsMap;
    }
    // Map creating another map for each accessed key not present in the map
    // (analogy - DefaultDict from Python).
    return new Proxy(initialInterceptors, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        } else {
          // Create an empty object, store it in target, and return it
          const newObj = {};
          target[prop] = newObj;
          return newObj;
        }
      },
    });
  }
}

module.exports.Interceptors = Interceptors;

function HttpClientWithInterceptors(connectionConfig, initialInterceptors) {
  Logger.getInstance().trace(
    'Initializing HttpClientWithInterceptors with Connection Config[%s]',
    connectionConfig.describeIdentityAttributes(),
  );
  this.interceptors = new Interceptors(initialInterceptors);
  NodeHttpClient.apply(this, [connectionConfig]);
}

Util.inherits(HttpClientWithInterceptors, NodeHttpClient);

//To add new methods to be intercepted wrap them here with appropriate interceptors calls
HttpClientWithInterceptors.prototype.requestAsync = async function (url, options) {
  this.interceptors.intercept('requestAsync', HOOK_TYPE.FOR_ARGS, url, options);
  const response = await NodeHttpClient.prototype.requestAsync.call(this, url, options);
  this.interceptors.intercept('requestAsync', HOOK_TYPE.FOR_RETURNED_VALUE, response);
  return response;
};

HttpClientWithInterceptors.prototype.request = function (url, options) {
  this.interceptors.intercept('request', HOOK_TYPE.FOR_ARGS, url, options);
  const response = NodeHttpClient.prototype.request.call(this, url, options);
  this.interceptors.intercept('request', HOOK_TYPE.FOR_RETURNED_VALUE, response);
  return response;
};

// Factory method for HttpClientWithInterceptors to be able to partially initialize class
// with interceptors used in fully instantiated object.
function getHttpClientWithInterceptorsClass(interceptors) {
  function HttpClientWithInterceptorsWrapper(connectionConfig) {
    HttpClientWithInterceptors.apply(this, [connectionConfig, interceptors]);
  }
  Util.inherits(HttpClientWithInterceptorsWrapper, HttpClientWithInterceptors);

  return HttpClientWithInterceptorsWrapper;
}

module.exports.getHttpClientWithInterceptorsClass = getHttpClientWithInterceptorsClass;
