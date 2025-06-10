const Util = require('./util');
const errorMessages = require('./constants/error_messages');
const ErrorCode = require('./error_code').default;

/**
 * @deprecated Use `ErrorCode` instead
 */
exports.codes = ErrorCode;
exports.ErrorCode = ErrorCode;

/**
 * A map in which the keys are the error codes and the values are the
 * corresponding SQL-states.
 */
const errCodeToSqlState = exports.mapErrorCodeToSqlState =
  {
    405501: '08002',
    405502: '08002',
    405503: '08003',
    407001: '08003',
    407002: '08003'
  };

/**
 * An enumeration of all the different types of errors we create.
 */
const errorTypes =
  {
    // internal synchronous errors
    InternalAssertError: 'InternalAssertError',

    // external synchronous errors
    MissingParameterError: 'MissingParameterError',
    InvalidParameterError: 'InvalidParameterError',

    // external asynchronous errors
    NetworkError: 'NetworkError',
    RequestFailedError: 'RequestFailedError',
    UnexpectedContentError: 'UnexpectedContentError',
    OperationFailedError: 'OperationFailedError',
    LargeResultSetError: 'LargeResultSetError',
    ClientError: 'ClientError',
    OCSPError: 'OCSPError'
  };

/**
 * Ensures the truth of an expression. Used to catch internal programming
 * errors. If the given expression is false, an InternalAssertError will be
 * thrown.
 *
 * @param {Boolean} expression a boolean expression.
 * @param {String} [message] a message for the error should the check fail.
 */
exports.assertInternal = function (expression, message) {
  if (!expression) {
    throw createError(errorTypes.InternalAssertError,
      {
        code: ErrorCode.ERR_INTERNAL_ASSERT_FAILED,
        message: message,
        synchronous: true
      });
  }
};

/**
 * Ensures the truth of an expression. Used to make sure all required arguments
 * are passed in to a method. If the specified expression is false, a
 * MissingParameterError will be thrown.
 *
 * @param {Boolean} expression a boolean expression.
 * @param {Number} errorCode a code for the error should the check fail.
 *
 * @throws will throw an MissingParameter error if the expression is false.
 */
exports.checkArgumentExists = function (expression, errorCode) {
  if (!expression) {
    throw createError(errorTypes.MissingParameterError,
      {
        code: errorCode,
        messageArgs: Array.prototype.slice.call(arguments, 2),
        synchronous: true
      });
  }
};

/**
 * Ensures the truth of an expression. Used for validating arguments to methods.
 * If the specified expression is false, an InvalidParameterError will be
 * thrown.
 *
 * @param {Boolean} expression a boolean expression.
 * @param {Number} errorCode a code for the error should the check fail.
 *
 * @throws will throw an InvalidParameter error if the expression is false.
 */
exports.checkArgumentValid = function (expression, errorCode) {
  if (!expression) {
    throw createError(errorTypes.InvalidParameterError,
      {
        code: errorCode,
        messageArgs: Array.prototype.slice.call(arguments, 2),
        synchronous: true
      });
  }
};

/**
 * Creates a new InvalidParameterError.
 *
 * @param {Number} errorCode the error code to use when building the error.
 * @param {messageArgs} array of error massages
 * @returns {Error}
 */
exports.createInvalidParameterError = function (errorCode, ...messageArgs) {
  return createError(errorTypes.InvalidParameterError,
    {
      code: errorCode,
      messageArgs: messageArgs,
      synchronous: true
    });
};
/**
 * Creates a new NetworkError.
 *
 * @param {Number} errorCode the error code to use when building the error.
 * @param {Error} cause the underlying cause of the network error.
 *
 * @returns {Error}
 */
exports.createNetworkError = function (errorCode, cause) {
  return createError(errorTypes.NetworkError,
    {
      code: errorCode,
      cause: cause
    });
};

/**
 * Creates a new RequestFailedError.
 *
 * @param {Number} errorCode the error code to use when building the error.
 * @param {Object} response the response sent by Global Services.
 *
 * @returns {Error}
 */
exports.createRequestFailedError = function (errorCode, response) {
  return createError(errorTypes.RequestFailedError,
    {
      code: errorCode,
      response: response
    });
};

/**
 * Creates a new UnexpectedContentError.
 *
 * @param {Number} errorCode the error code to use when building the error.
 * @param {String} responseBody the response body sent by Global Services.
 *
 * @returns {Error}
 */
exports.createUnexpectedContentError = function (errorCode, responseBody) {
  return createError(errorTypes.UnexpectedContentError,
    {
      code: errorCode,
      responseBody: responseBody
    });
};

/**
 * Creates a new OperationFailedError.
 *
 * @param {Number} errorCode the error code to use when building the error.
 * @param {Object} data the data sent by Global Services.
 * @param {String} message the error message sent by Global Services.
 * @param {String} sqlState the sql state sent by Global Services.
 *
 * @returns {Error}
 */
exports.createOperationFailedError = function (
  errorCode, data, message, sqlState) {
  return createError(errorTypes.OperationFailedError,
    {
      code: errorCode,
      data: data,
      message: message,
      sqlState: sqlState
    });
};

/**
 * Creates a new LargeResultSetError.
 *
 * @param {Number} errorCode the error code to use when building the error.
 * @param {Object} response the response sent by S3/Blob.
 *
 * @returns {Error}
 */
exports.createLargeResultSetError = function (errorCode, response) {
  return createError(errorTypes.LargeResultSetError,
    {
      code: errorCode,
      response: response
    });
};

/**
 * Creates a new ClientError.
 *
 * @param {Number} errorCode the error code to use when building the error.
 * @param {Object} [isFatal] whether the error is fatal.
 *
 * @return {Error}
 */
exports.createClientError = function (errorCode, isFatal) {
  return createError(errorTypes.ClientError,
    {
      code: errorCode,
      isFatal: isFatal,
      messageArgs: Array.prototype.slice.call(arguments, 2)
    });
};

/**
 * Creates a OCSPError
 *
 * @param {Number} errorCode the error code to use when building the error.
 * @param {String} message
 * @returns {Error}
 */
exports.createOCSPError = function (errorCode) {
  return createError(errorTypes.OCSPError,
    {
      code: errorCode,
      messageArgs: Array.prototype.slice.call(arguments, 1)
    }
  );
};

/**
 * Creates a new error by combining the error messages from the json parser and xml parser
 *
 * @param {Object} jsonParseError contains the JSON parse error message
 * @param {Object} xmlParseError contains the XML parse error message
 * @returns {Error}
 */
exports.VariantParseError = function (jsonParseError, xmlParseError) {
  const errMessage = 'VariantParseError: Variant cannot be parsed neither as JSON nor as XML:\n' +
    ` - JSON parse error message: ${jsonParseError.message}\n` +
    ` - XML parse error message: ${xmlParseError.message}`;
  return new Error(errMessage);
};

/**
 * Determines if a given error is an InternalAssertError.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
exports.isInternalAssertError = function (error) {
  return isErrorOfType(error, errorTypes.InternalAssertError);
};

/**
 * Determines if a given error is a MissingParameterError.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
exports.isMissingParameterError = function (error) {
  return isErrorOfType(error, errorTypes.MissingParameterError);
};

/**
 * Determines if a given error is an InvalidParameterError.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
exports.isInvalidParameterError = function (error) {
  return isErrorOfType(error, errorTypes.InvalidParameterError);
};

/**
 * Determines if a given error is a NetworkError.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
exports.isNetworkError = function (error) {
  return isErrorOfType(error, errorTypes.NetworkError);
};

/**
 * Determines if a given error is a RequestFailedError.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
exports.isRequestFailedError = function (error) {
  return isErrorOfType(error, errorTypes.RequestFailedError);
};

/**
 * Determines if a given error is an UnexpectedContentError.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
exports.isUnexpectedContentError = function (error) {
  return isErrorOfType(error, errorTypes.UnexpectedContentError);
};

/**
 * Determines if a given error is an OperationFailedError.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
exports.isOperationFailedError = function (error) {
  return isErrorOfType(error, errorTypes.OperationFailedError);
};

/**
 * Determines if a given error is an LargeResultSetError.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
exports.isLargeResultSetError = function (error) {
  return isErrorOfType(error, errorTypes.LargeResultSetError);
};

/**
 * Externalizes an error.
 *
 * @param {Error} error
 *
 * @returns {Error}
 */
exports.externalize = function (error) {
  return error && error.externalize ? error.externalize() : error;
};

/**
 * Determines if a given error is of a specific type.
 *
 * @param {Error} error
 * @param {String} type
 *
 * @returns {Boolean}
 */
function isErrorOfType(error, type) {
  return error && (error.name === type);
}

/**
 * Creates a generic error.
 *
 * @param {String} name
 * @param {Object} options
 *
 * @returns {Error}
 */
function createError(name, options) {
  // TODO: validate that name is a string and options is an object

  // TODO: this code is a bit of a mess and needs to be cleaned up

  // create a new error
  const error = new Error();

  // set its name
  error.name = name;

  // set the error code
  let code;
  error.code = code = options.code;

  // if no error message was specified in the options
  let message = options.message;
  if (!message) {
    // use the error code to get the error message template
    const messageTemplate = errorMessages[code];

    // if some error message arguments were specified, substitute them into the
    // error message template to get the full error message, otherwise just use
    // the error message template as the error message
    let messageArgs = options.messageArgs;
    if (messageArgs) {
      messageArgs = messageArgs.slice();
      messageArgs.unshift(messageTemplate);
      message = Util.format.apply(Util, messageArgs);
    } else {
      message = messageTemplate;
    }
  }
  error.message = message;

  // if no sql state was specified in the options, use the error code to try to
  // get the appropriate sql state
  let sqlState = options.sqlState;
  if (!sqlState) {
    sqlState = errCodeToSqlState[code];
  }
  error.sqlState = sqlState;

  // set the error data
  error.data = options.data;

  // set the error response and response body
  error.response = options.response;
  error.responseBody = options.responseBody;

  // set the error cause
  error.cause = options.cause;

  // set the error's fatal flag
  error.isFatal = options.isFatal;

  // if the error is not synchronous, add an externalize() method
  if (!options.synchronous) {
    error.externalize = function () {
      const propNames =
        [
          'name',
          'code',
          'message',
          'sqlState',
          'data',
          'response',
          'responseBody',
          'cause',
          'isFatal',
          'stack'
        ];

      const externalizedError = new Error();

      let propName, propValue;
      for (let index = 0, length = propNames.length; index < length; index++) {
        propName = propNames[index];
        propValue = this[propName];
        if (Util.exists(propValue)) {
          externalizedError[propName] = propValue;
        }
      }

      return externalizedError;
    };
  }

  return error;
}
