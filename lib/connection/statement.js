/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const uuidv4 = require('uuid/v4');

var Url = require('url');
var QueryString = require('querystring');
var EventEmitter = require('events').EventEmitter;
var Util = require('../util');
var Result = require('./result/result');
var Parameters = require('../parameters');
var RowStream = require('./result/row_stream');
var Errors = require('../errors');
var ErrorCodes = Errors.codes;
var Logger = require('../logger');
var NativeTypes = require('./result/data_types').NativeTypes;

var states =
  {
    FETCHING: 'fetching',
    COMPLETE: 'complete'
  };

var statementTypes =
  {
    ROW_PRE_EXEC: 'ROW_PRE_EXEC',
    ROW_POST_EXEC: 'ROW_POST_EXEC',
    FILE_PRE_EXEC: 'FILE_PRE_EXEC'
  };

/**
 * Executes a statement and returns a statement object that can be used to fetch
 * its result.
 *
 * @param {Object} statementOptions
 * @param {Object} services
 * @param {Object} connectionConfig
 *
 * @returns {Object}
 */
exports.createRowStatementPreExec = function (
  statementOptions, services, connectionConfig)
{
  // create a statement context for a pre-exec statement
  var statementContext = createContextPreExec(
    statementOptions, services, connectionConfig);

  // set the statement type
  statementContext.type = statementTypes.ROW_PRE_EXEC;

  return new RowStatementPreExec(
    statementOptions, statementContext, services, connectionConfig);
};

/**
 * Creates a statement object that can be used to fetch the result of a
 * previously executed statement.
 *
 * @param {Object} statementOptions
 * @param {Object} services
 * @param {Object} connectionConfig
 *
 * @returns {Object}
 */
exports.createRowStatementPostExec = function (
  statementOptions, services, connectionConfig)
{
  // check for missing options
  Errors.checkArgumentExists(Util.exists(statementOptions),
    ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_OPTIONS);

  // check for invalid options
  Errors.checkArgumentValid(Util.isObject(statementOptions),
    ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_OPTIONS);

  // check for missing statement id
  Errors.checkArgumentExists(Util.exists(statementOptions.statementId),
    ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_STATEMENT_ID);

  // check for invalid statement id
  Errors.checkArgumentValid(Util.isString(statementOptions.statementId),
    ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_STATEMENT_ID);

  // check for invalid complete callback
  var complete = statementOptions.complete;
  if (Util.exists(complete))
  {
    Errors.checkArgumentValid(Util.isFunction(complete),
      ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_COMPLETE);
  }

  // check for invalid streamResult
  if (Util.exists(statementOptions.streamResult))
  {
    Errors.checkArgumentValid(Util.isBoolean(statementOptions.streamResult),
      ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_STREAM_RESULT);
  }

  // check for invalid fetchAsString
  var fetchAsString = statementOptions.fetchAsString;
  if (Util.exists(fetchAsString))
  {
    // check that the value is an array
    Errors.checkArgumentValid(Util.isArray(fetchAsString),
      ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_FETCH_AS_STRING);

    // check that all the array elements are valid
    var invalidValueIndex = NativeTypes.findInvalidValue(fetchAsString);
    Errors.checkArgumentValid(invalidValueIndex === -1,
      ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_FETCH_AS_STRING_VALUES,
      JSON.stringify(fetchAsString[invalidValueIndex]));
  }

  // validate non-user-specified arguments
  Errors.assertInternal(Util.isObject(services));
  Errors.assertInternal(Util.isObject(connectionConfig));

  // create a statement context
  var statementContext = createStatementContext();

  statementContext.statementId = statementOptions.statementId;
  statementContext.complete = complete;
  statementContext.streamResult = statementOptions.streamResult;
  statementContext.fetchAsString = statementOptions.fetchAsString;

  // set the statement type
  statementContext.type = statementTypes.ROW_POST_EXEC;

  return new RowStatementPostExec(
    statementOptions, statementContext, services, connectionConfig);
};

/**
 * Creates a new statement context object.
 *
 * @returns {Object}
 */
function createStatementContext()
{
  return new EventEmitter();
}

/**
 * Creates a statement object that can be used to execute a PUT or GET file
 * operation.
 *
 * @param {Object} statementOptions
 * @param {Object} services
 * @param {Object} connectionConfig
 *
 * @returns {Object}
 */
exports.createFileStatementPreExec = function (
  statementOptions, services, connectionConfig)
{
  // create a statement context for a pre-exec statement
  var statementContext = createContextPreExec(
    statementOptions, services, connectionConfig);

  // set the statement type
  statementContext.type = statementTypes.FILE_PRE_EXEC;

  return new FileStatementPreExec(
    statementOptions, statementContext, services, connectionConfig);
};

/**
 * Creates a statement context object for pre-exec statement.
 *
 * @param {Object} statementOptions
 * @param {Object} services
 * @param {Object} connectionConfig
 *
 * @returns {Object}
 */
function createContextPreExec(
  statementOptions, services, connectionConfig)
{
  // check for missing options
  Errors.checkArgumentExists(Util.exists(statementOptions),
    ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_OPTIONS);

  // check for invalid options
  Errors.checkArgumentValid(Util.isObject(statementOptions),
    ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_OPTIONS);

  // check for missing sql text
  Errors.checkArgumentExists(Util.exists(statementOptions.sqlText),
    ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_SQL_TEXT);

  // check for invalid sql text
  Errors.checkArgumentValid(Util.isString(statementOptions.sqlText),
    ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_SQL_TEXT);

  // check for invalid complete callback
  var complete = statementOptions.complete;
  if (Util.exists(complete))
  {
    Errors.checkArgumentValid(Util.isFunction(complete),
      ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_COMPLETE);
  }

  // check for invalid streamResult
  if (Util.exists(statementOptions.streamResult))
  {
    Errors.checkArgumentValid(Util.isBoolean(statementOptions.streamResult),
      ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_STREAM_RESULT);
  }

  // check for invalid fetchAsString
  var fetchAsString = statementOptions.fetchAsString;
  if (Util.exists(fetchAsString))
  {
    // check that the value is an array
    Errors.checkArgumentValid(Util.isArray(fetchAsString),
      ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_FETCH_AS_STRING);

    // check that all the array elements are valid
    var invalidValueIndex = NativeTypes.findInvalidValue(fetchAsString);
    Errors.checkArgumentValid(invalidValueIndex === -1,
      ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_FETCH_AS_STRING_VALUES,
      JSON.stringify(fetchAsString[invalidValueIndex]));
  }

  // if parameters are specified, make sure the specified value is an object
  if (Util.exists(statementOptions.parameters))
  {
    Errors.checkArgumentValid(Util.isObject(statementOptions.parameters),
      ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_PARAMETERS);
  }

  // if binds are specified
  var binds = statementOptions.binds;
  if (Util.exists(binds))
  {
    // make sure the specified value is an array
    Errors.checkArgumentValid(Util.isArray(binds),
      ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_BINDS);

    // make sure everything in the binds array is stringifiable
    for (var index = 0, length = binds.length; index < length; index++)
    {
      Errors.checkArgumentValid(JSON.stringify(binds[index]) !== undefined,
        ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_BIND_VALUES, binds[index]);
    }
  }

  // if an internal option is specified, make sure it's boolean
  if (Util.exists(statementOptions.internal))
  {
    Errors.checkArgumentValid(Util.isBoolean(statementOptions.internal),
      ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_INTERNAL);
  }

  // create a statement context
  var statementContext = createStatementContext();

  statementContext.sqlText = statementOptions.sqlText;
  statementContext.complete = complete;
  statementContext.streamResult = statementOptions.streamResult;
  statementContext.fetchAsString = statementOptions.fetchAsString;

  // if a binds array is specified, add it to the statement context
  if (Util.exists(statementOptions.binds))
  {
    statementContext.binds = statementOptions.binds;
  }

  // if parameters are specified, add them to the statement context
  if (Util.exists(statementOptions.parameters))
  {
    statementContext.parameters = statementOptions.parameters;
  }

  // if the internal flag is specified, add it to the statement context
  if (Util.exists(statementOptions.internal))
  {
    statementContext.internal = statementOptions.internal;
  }

  // validate non-user-specified arguments
  Errors.assertInternal(Util.isObject(services));
  Errors.assertInternal(Util.isObject(connectionConfig));

  // if we're not in qa mode, use a random uuid for the statement request id
  if (!connectionConfig.isQaMode())
  {
    statementContext.requestId = uuidv4();
  }
  else // we're in qa mode
  {
    // if a request id or sequence id are specified in the statement options,
    // use them as is; this is to facilitate testing by making things more
    // deterministic
    if (Util.isString(statementOptions.requestId))
    {
      statementContext.requestId = statementOptions.requestId;
    }
  }

  return statementContext;
}

/**
 * Creates a new BaseStatement.
 *
 * @param statementOptions
 * @param context
 * @param services
 * @param connectionConfig
 * @constructor
 */
function BaseStatement(
  statementOptions, context, services, connectionConfig)
{
  // call super
  EventEmitter.call(this);

  // validate input
  Errors.assertInternal(Util.isObject(statementOptions));
  Errors.assertInternal(Util.isObject(context));

  context.services = services;
  context.connectionConfig = connectionConfig;
  context.isFetchingResult = true;

  // TODO: add the parameters map to the statement context

  var statement = this;

  /**
   * Returns this statement's SQL text.
   *
   * @returns {String}
   */
  this.getSqlText = function ()
  {
    return context.sqlText;
  };

  /**
   * Returns the current status of this statement.
   *
   * @returns {String}
   */
  this.getStatus = function ()
  {
    return context.isFetchingResult ? states.FETCHING : states.COMPLETE;
  };

  /**
   * Returns the columns produced by this statement.
   *
   * @returns {Object[]}
   */
  this.getColumns = function ()
  {
    return context.result ? context.result.getColumns() : undefined;
  };

  /**
   * Given a column identifier, returns the corresponding column. The column
   * identifier can be either the column name (String) or the column index
   * (Number). If a column is specified and there is more than one column with
   * that name, the first column with the specified name will be returned.
   *
   * @param {String | Number} columnIdentifier
   *
   * @returns {Object}
   */
  this.getColumn = function (columnIdentifier)
  {
    return context.result ? context.result.getColumn(columnIdentifier) :
      undefined;
  };

  /**
   * Returns the number of rows returned by this statement.
   *
   * @returns {Number}
   */
  this.getNumRows = function ()
  {
    return context.result ? context.result.getReturnedRows() : undefined;
  };

  /**
   * Returns the number of rows updated by this statement.
   *
   * @returns {Number}
   */
  this.getNumUpdatedRows = function ()
  {
    return context.result ? context.result.getNumUpdatedRows() : undefined;
  };

  /**
   * Returns an object that contains information about the values of the
   * current warehouse, current database, etc., when this statement finished
   * executing.
   *
   * @returns {Object}
   */
  this.getSessionState = function ()
  {
    return context.result ? context.result.getSessionState() : undefined;
  };

  /**
   * Returns the request id that was used when the statement was issued.
   *
   * @returns {String}
   */
  this.getRequestId = function ()
  {
    return context.requestId;
  };

  /**
   * Returns the statement id generated by the server for this statement.
   * If the statement is still executing and we don't know the statement id
   * yet, this method will return undefined.
   *
   * @returns {String}
   */
  this.getStatementId = function ()
  {
    return context.statementId;
  };

  /**
   * Cancels this statement if possible.
   *
   * @param {Function} [callback]
   */
  this.cancel = function (callback)
  {
    sendCancelStatement(context, statement, callback);
  };

  /**
   * Issues a request to get the statement result again.
   *
   * @param {Function} callback
   */
  context.refresh = function (callback)
  {
    // pick the appropriate function to get the result based on whether we
    // have the statement id or request id (we should have at least one)
    var sendRequestFn = context.statementId ?
      sendRequestPostExec : sendRequestPreExec;

    // the current result error might be transient,
    // so issue a request to get the result again
    sendRequestFn(context, function (err, body)
    {
      // refresh the result
      context.onStatementRequestComp(err, body);

      // if a callback was specified, invoke it
      if (Util.isFunction(callback))
      {
        callback(context);
      }
    });
  };

  /**
   * Called when the statement request is complete.
   *
   * @param err
   * @param body
   */
  context.onStatementRequestComp = function (err, body)
  {
    // if we already have a result or a result error, we invoked the complete
    // callback once, so don't invoke it again
    var suppressComplete = context.result || context.resultError;

    // clear the previous result error
    context.resultError = null;

    // if there was no error, call the success function
    if (!err)
    {
      context.onStatementRequestSucc(body);
    }
    else
    {
      // save the error
      context.resultError = err;

      // if we don't have a statement id and we got a response from GS, extract
      // the statement id from the data
      if (!context.statementId &&
        Errors.isOperationFailedError(err) && err.data)
      {
        context.statementId = err.data.queryId;
      }
    }

    // we're no longer fetching the result
    context.isFetchingResult = false;

    if (!suppressComplete)
    {
      // emit a complete event
      context.emit('statement-complete', Errors.externalize(err), statement);

      // if a complete function was specified, invoke it
      if (Util.exists(context.complete))
      {
        invokeStatementComplete(statement, context);
      }
    }
    else
    {
      Logger.getInstance().debug('refreshed result of statement with %s',
        context.requestId ?
          Util.format('request id = %s', context.requestId) :
          Util.format('statement id = %s', context.statementId));
    }
  };

  /**
   * Called when the statement request is successful. Subclasses must provide
   * their own implementation.
   *
   * @param {Object} body
   */
  context.onStatementRequestSucc = function (body)
  {
  };
}

Util.inherits(BaseStatement, EventEmitter);

/**
 * Invokes the statement complete callback.
 *
 * @param {Object} statement
 * @param {Object} context
 */
function invokeStatementComplete(statement, context)
{
  // find out if the result will be streamed;
  // if a value is not specified, get it from the connection
  var streamResult = context.streamResult;
  if (!Util.exists(streamResult))
  {
    streamResult = context.connectionConfig.getStreamResult();
  }

  // if the result will be streamed later,
  // invoke the complete callback right away
  if (streamResult)
  {
    context.complete(Errors.externalize(context.resultError), statement);
  }
  else
  {
    process.nextTick(function ()
    {
      // aggregate all the rows into an array and pass this
      // array to the complete callback as the last argument
      var rows = [];
      statement.streamRows()
        .on('data', function (row)
        {
          rows.push(row);
        })
        .on('end', function ()
        {
          context.complete(null, statement, rows);
        })
        .on('error', function (err)
        {
          context.complete(Errors.externalize(err), statement);
        });
    });
  }
}

/**
 * Creates a new RowStatementPreExec instance.
 *
 * @param {Object} statementOptions
 * @param {Object} context
 * @param {Object} services
 * @param {Object} connectionConfig
 * @constructor
 */
function RowStatementPreExec(
  statementOptions,
  context,
  services,
  connectionConfig)
{
  // call super
  BaseStatement.apply(this, arguments);

  // add the result request headers to the context
  context.resultRequestHeaders = buildResultRequestHeadersRow();

  /**
   * Called when the request to get the statement result is successful.
   *
   * @param {Object} body
   */
  context.onStatementRequestSucc =
    createOnStatementRequestSuccRow(this, context);

  /**
   * Fetches the rows in this statement's result and invokes the each()
   * callback on each row. If start and end values are specified, the each()
   * callback will only be invoked on rows in the specified range.
   *
   * @param {Object} options
   */
  this.fetchRows = createFnFetchRows(this, context);

  /**
   * Streams the rows in this statement's result. If start and end values are
   * specified, only rows in the specified range are streamed.
   *
   * @param {Object} options
   */
  this.streamRows = createFnStreamRows(this, context);

  // send a request to execute the statement
  sendRequestPreExec(context, context.onStatementRequestComp);
}

Util.inherits(RowStatementPreExec, BaseStatement);

/**
 * Creates a function that can be used by row statements to process the response
 * when the request is successful.
 *
 * @param statement
 * @param context
 * @returns {Function}
 */
function createOnStatementRequestSuccRow(statement, context)
{
  return function (body)
  {
    // if we don't already have a result
    if (!context.result)
    {
      // build a result from the response
      context.result = new Result(
        {
          response: body,
          statement: statement,
          services: context.services,
          connectionConfig: context.connectionConfig
        });

      // save the statement id
      context.statementId = context.result.getStatementId();
    }
    else
    {
      // refresh the existing result
      context.result.refresh(body);
    }

    // only update the parameters if the statement isn't a post-exec statement
    if (context.type !== statementTypes.ROW_POST_EXEC)
    {
      Parameters.update(context.result.getParametersArray());
    }
  };
}

/**
 * Creates a new FileStatementPreExec instance.
 *
 * @param {Object} statementOptions
 * @param {Object} context
 * @param {Object} services
 * @param {Object} connectionConfig
 * @constructor
 */
function FileStatementPreExec(
  statementOptions, context, services, connectionConfig)
{
  // call super
  BaseStatement.apply(this, arguments);

  // add the result request headers to the context
  context.resultRequestHeaders = buildResultRequestHeadersFile();

  /**
   * Called when the statement request is successful.
   *
   * @param {Object} body
   */
  context.onStatementRequestSucc = function (body)
  {
    context.fileMetadata = body;
  };

  /**
   * Returns the file metadata generated by the statement.
   *
   * @returns {Object}
   */
  this.getFileMetadata = function ()
  {
    return context.fileMetadata;
  };

  // send a request to execute the file statement
  sendRequestPreExec(context, context.onStatementRequestComp);
}

Util.inherits(FileStatementPreExec, BaseStatement);

/**
 * Creates a new RowStatementPostExec instance.
 *
 * @param {Object} statementOptions
 * @param {Object} context
 * @param {Object} services
 * @param {Object} connectionConfig
 * @constructor
 */
function RowStatementPostExec(
  statementOptions, context, services, connectionConfig)
{
  // call super
  BaseStatement.apply(this, arguments);

  // add the result request headers to the context
  context.resultRequestHeaders = buildResultRequestHeadersRow();

  /**
   * Called when the statement request is successful.
   *
   * @param {Object} body
   */
  context.onStatementRequestSucc =
    createOnStatementRequestSuccRow(this, context);

  /**
   * Fetches the rows in this statement's result and invokes the each()
   * callback on each row. If startIndex and endIndex values are specified, the
   * each() callback will only be invoked on rows in the requested range. The
   * end() callback will be invoked when either all the requested rows have been
   * successfully processed, or if an error was encountered while trying to
   * fetch the requested rows.
   *
   * @param {Object} options
   */
  this.fetchRows = createFnFetchRows(this, context);

  /**
   * Streams the rows in this statement's result. If start and end values are
   * specified, only rows in the specified range are streamed.
   *
   * @param {Object} options
   */
  this.streamRows = createFnStreamRows(this, context);

  // send a request to fetch the result
  sendRequestPostExec(context, context.onStatementRequestComp);
}

Util.inherits(RowStatementPostExec, BaseStatement);

/**
 * Creates a function that fetches the rows in a statement's result and
 * invokes the each() callback on each row. If start and end values are
 * specified, the each() callback will only be invoked on rows in the
 * specified range.
 *
 * @param statement
 * @param context
 */
function createFnFetchRows(statement, context)
{
  return function (options)
  {
    // check for missing options
    Errors.checkArgumentExists(Util.exists(options),
      ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_OPTIONS);

    // check for invalid options
    Errors.checkArgumentValid(Util.isObject(options),
      ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_OPTIONS);

    // check for missing each()
    Errors.checkArgumentExists(Util.exists(options.each),
      ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_EACH);

    // check for invalid each()
    Errors.checkArgumentValid(Util.isFunction(options.each),
      ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_EACH);

    // check for missing end()
    Errors.checkArgumentExists(Util.exists(options.end),
      ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_END);

    // check for invalid end()
    Errors.checkArgumentValid(Util.isFunction(options.end),
      ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_END);

    // if we're still trying to fetch the result, create an error of our own
    // and invoke the end() callback
    if (context.isFetchingResult)
    {
      process.nextTick(function ()
      {
        options.end(Errors.createClientError(
          ErrorCodes.ERR_STMT_FETCH_ROWS_FETCHING_RESULT).externalize(),
          statement);
      });
    }
    // if there was an error the last time we tried to get the result
    else if (context.resultError)
    {
      // if we have a fatal error, end the fetch rows operation since we're not
      // going to be able to get any rows, either because the statement failed
      // or because the result's been purged
      if (Errors.isOperationFailedError(context.resultError) &&
        context.resultError.sqlState)
      {
        process.nextTick(function ()
        {
          endFetchRows(options, statement, context);
        });
      }
      else
      {
        context.refresh(function ()
        {
          // if there was no error, fetch rows from the result
          if (!context.resultError)
          {
            fetchRowsFromResult(options, statement, context);
          }
          else
          {
            // give up because it's unlikely we'll succeed if we retry again
            endFetchRows(options, statement, context);
          }
        });
      }
    }
    else
    {
      fetchRowsFromResult(options, statement, context);
    }
  };
}

/**
 * Creates a function that streams the rows in a statement's result. If start
 * and end values are specified, only rows in the specified range are streamed.
 *
 * @param statement
 * @param context
 */
function createFnStreamRows(statement, context)
{
  return function (options)
  {
    // if some options are specified
    if (Util.exists(options))
    {
      // check for invalid options
      Errors.checkArgumentValid(Util.isObject(options),
        ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_OPTIONS);

      // check for invalid start
      if (Util.exists(options.start))
      {
        Errors.checkArgumentValid(Util.isNumber(options.start),
          ErrorCodes.ERR_STMT_STREAM_ROWS_INVALID_START);
      }

      // check for invalid end
      if (Util.exists(options.end))
      {
        Errors.checkArgumentValid(Util.isNumber(options.end),
          ErrorCodes.ERR_STMT_STREAM_ROWS_INVALID_END);
      }

      // check for invalid fetchAsString
      var fetchAsString = options.fetchAsString;
      if (Util.exists(fetchAsString))
      {
        // check that the value is an array
        Errors.checkArgumentValid(Util.isArray(fetchAsString),
          ErrorCodes.ERR_STMT_STREAM_ROWS_INVALID_FETCH_AS_STRING);

        // check that all the array elements are valid
        var invalidValueIndex = NativeTypes.findInvalidValue(fetchAsString);
        Errors.checkArgumentValid(invalidValueIndex === -1,
          ErrorCodes.ERR_STMT_STREAM_ROWS_INVALID_FETCH_AS_STRING_VALUES,
          JSON.stringify(fetchAsString[invalidValueIndex]));
      }
    }

    return new RowStream(statement, context, options);
  };
}

/**
 * Ends the fetchRows() operation.
 *
 * @param {Object} options the options passed to fetchRows().
 * @param {Object} statement
 * @param {Object} context
 */
function endFetchRows(options, statement, context)
{
  options.end(Errors.externalize(context.resultError), statement);
}

/**
 * Fetches rows from the statement's result.
 *
 * @param {Object} options the options passed to fetchRows().
 * @param {Object} statement
 * @param {Object} context
 */
function fetchRowsFromResult(options, statement, context)
{
  var numInterrupts = 0;

  // forward to the result to get a FetchRowsOperation object
  var operation = context.result.fetchRows(options);

  // subscribe to the operation's 'complete' event
  operation.on('complete', function (err, continueCallback)
  {
    // we want to retry if the error is retryable and the
    // result stream hasn't been closed too many times
    if (Errors.isLargeResultSetError(err) && err.response &&
      (err.response.statusCode === 403) &&
      (numInterrupts <
        context.connectionConfig.getResultStreamInterrupts()))
    {
      // increment the interrupt counter
      numInterrupts++;

      // issue a request to fetch the result again
      sendRequestPostExec(context, function (err, body)
      {
        // refresh the result
        context.onStatementRequestComp(err, body);

        // if there was no error, continue from where we got interrupted
        if (!err)
        {
          continueCallback();
        }
      });
    }
    else
    {
      endFetchRows(options, statement, context);
    }
  });
}

/**
 * Issues a request to cancel a statement.
 *
 * @param {Object} statementContext
 * @param {Object} statement
 * @param {Function} callback
 */
function sendCancelStatement(statementContext, statement, callback)
{
  var url;
  var json;

  // use different rest endpoints based on whether the statement id is available
  if (statementContext.statementId)
  {
    url = '/queries/' + statementContext.statementId + '/abort-request';
  }
  else
  {
    url = '/queries/v1/abort-request';
    json =
      {
        requestId: statementContext.requestId
      };
  }

  // issue a request to cancel the statement
  statementContext.services.sf.request(
    {
      method: 'POST',
      url: url,
      json: json,
      callback: function (err)
      {
        // if a callback was specified, invoke it
        if (Util.isFunction(callback))
        {
          callback(Errors.externalize(err), statement);
        }
      }
    });
}

/**
 * Issues a request to get the result of a statement that hasn't been previously
 * executed.
 *
 * @param statementContext
 * @param onResultAvailable
 */
function sendRequestPreExec(statementContext, onResultAvailable)
{
  // get the request headers
  var headers = statementContext.resultRequestHeaders;

  // build the basic json for the request
  var json =
    {
      disableOfflineChunks: false,
      sqlText: statementContext.sqlText
    };

  // if binds are specified, build a binds map and include it in the request
  if (Util.exists(statementContext.binds))
  {
    json.bindings = buildBindsMap(statementContext.binds);
  }

  // include statement parameters if a value was specified
  if (Util.exists(statementContext.parameters))
  {
    json.parameters = statementContext.parameters;
  }

  // include the internal flag if a value was specified
  if (Util.exists(statementContext.internal))
  {
    json.isInternal = statementContext.internal;
  }

  // use the snowflake service to issue the request
  sendSfRequest(statementContext,
    {
      method: 'POST',
      headers: headers,
      url: Url.format(
        {
          pathname: '/queries/v1/query-request',
          search: QueryString.stringify(
            {
              requestId: statementContext.requestId
            })
        }),
      json: json,
      callback: buildResultRequestCallback(
        statementContext, headers, onResultAvailable)
    },
    true);
}

/**
 * Converts a bind variables array to a map that can be included in the
 * POST-body when issuing a pre-exec statement request.
 *
 * @param bindsArray
 *
 * @returns {Object}
 */
function buildBindsMap(bindsArray)
{
  var bindsMap = {};
  var isArrayBinding = bindsArray.length > 0 && Util.isArray(bindsArray[0]);
  var singleArray = isArrayBinding ? bindsArray[0] : bindsArray;

  for (var index = 0, length = singleArray.length; index < length; index++)
  {
    var value = singleArray[index];

    // pick the appropriate logical data type based on the bind value
    var type;
    if (Util.isBoolean(value))
    {
      type = 'BOOLEAN';
    }
    else if (Util.isObject(value) || Util.isArray(value))
    {
      type = 'VARIANT';
    }
    else if (Util.isNumber(value))
    {
      if (Number(value) === value && value % 1 === 0)
      {
        // if value is integer
        type = 'FIXED';
      }
      else
      {
        type = 'REAL';
      }
    }
    else
    {
      type = 'TEXT';
    }

    // convert non-null values to a string if necessary; we don't convert null
    // because the client might want to run something like
    //   sql text = update t set name = :1 where id = 1;, binds = [null]
    // and converting null to a string would result in us executing
    //   sql text = update t set name = 'null' where id = 1;
    // instead of
    //   sql text = update t set name = null where id = 1;
    if (!isArrayBinding)
    {
      if (value !== null && !Util.isString(value))
      {
        if (value instanceof Date) {
          value = value.toJSON();
        } else {
          value = JSON.stringify(value);
        }
      }
    }
    else
    {
      value = [];
      for (var rowIndex = 0; rowIndex < bindsArray.length; rowIndex++)
      {
        var value0 = bindsArray[rowIndex][index];
        if (value0 !== null && !Util.isString(value0))
        {
          if (value0 instanceof Date) {
            value0 = value0.toJSON();
          } else {
            value0 = JSON.stringify(value0);
          }
        }
        value.push(value0);
      }
    }

    // add an entry for the bind variable to the map
    bindsMap[index + 1] =
      {
        type: type,
        value: value
      };
  }

  return bindsMap;
}

/**
 * Issues a request to get the result of a statement that has been previously
 * executed.
 *
 * @param statementContext
 * @param onResultAvailable
 */
function sendRequestPostExec(statementContext, onResultAvailable)
{
  // get the request headers
  var headers = statementContext.resultRequestHeaders;

  // use the snowflake service to issue the request
  sendSfRequest(statementContext,
    {
      method: 'GET',
      headers: headers,
      url: Url.format(
        {
          pathname: '/queries/' + statementContext.statementId + '/result',
          search: QueryString.stringify(
            {
              disableOfflineChunks: false
            })
        }),
      callback: buildResultRequestCallback(
        statementContext, headers, onResultAvailable)
    });
}

/**
 * Issues a statement-related request using the Snowflake service.
 *
 * @param {Object} statementContext the statement context.
 * @param {Object} options the request options.
 * @param {Boolean} [appendQueryParamOnRetry] whether retry=true should be
 *   appended to the url if the request is retried.
 */
function sendSfRequest(statementContext, options, appendQueryParamOnRetry)
{
  var sf = statementContext.services.sf;
  var connectionConfig = statementContext.connectionConfig;

  // clone the options
  options = Util.apply({}, options);

  // get the original url and callback
  var urlOrig = options.url;
  var callbackOrig = options.callback;

  var numRetries = 0;
  var maxNumRetries = connectionConfig.getRetrySfMaxNumRetries();
  var sleep = connectionConfig.getRetrySfStartingSleepTime();

  // create a function to send the request
  var sendRequest = function ()
  {
    // if this is a retry and a query parameter should be appended to the url on
    // retry, update the url
    if ((numRetries > 0) && appendQueryParamOnRetry)
    {
      options.url = Util.url.appendParam(urlOrig, 'retry', true);
    }

    sf.request(options);
  };

  // replace the specified callback with a new one that retries
  options.callback = function (err)
  {
    // if we haven't exceeded the maximum number of retries yet and the server
    // came back with a retryable error code
    if (numRetries < maxNumRetries &&
      err && Util.isRetryableHttpError(
        err.response, false // no retry for HTTP 403
      ))
    {
      // increment the retry count
      numRetries++;

      // use exponential backoff with decorrelated jitter to compute the
      // next sleep time.
      var cap = connectionConfig.getRetrySfMaxSleepTime();
      sleep = Util.nextSleepTime(1, cap, sleep);

      Logger.getInstance().debug(
        'Retrying statement with request id %s, retry count = %s',
        statementContext.requestId, numRetries);

      // wait the appropriate amount of time before retrying the request
      setTimeout(sendRequest, sleep * 1000);
    }
    else
    {
      // invoke the original callback
      callbackOrig.apply(this, arguments);
    }
  };

  // issue the request
  sendRequest();
}

/**
 * Builds a callback for use in an exec-statement or fetch-result request.
 *
 * @param statementContext
 * @param headers
 * @param onResultAvailable
 *
 * @returns {Function}
 */
function buildResultRequestCallback(
  statementContext, headers, onResultAvailable)
{
  var callback = function (err, body)
  {
    // if the result is not ready yet, extract the result url from the response
    // and issue a GET request to try to fetch the result again
    if (!err && body && (body.code === '333333' || body.code === '333334'))
    {
      // extract the statement id from the response and save it
      statementContext.statementId = body.data.queryId;

      // extract the result url from the response and try to get the result
      // again
      sendSfRequest(statementContext,
        {
          method: 'GET',
          headers: headers,
          url: body.data.getResultUrl,
          callback: callback
        });
    }
    else
    {
      onResultAvailable.call(null, err, body);
    }
  };

  return callback;
}

/**
 * Builds the request headers for a row statement request.
 *
 * @returns {Object}
 */
function buildResultRequestHeadersRow()
{
  return {
    'Accept': 'application/snowflake'
  };
}

/**
 * Builds the request headers for a file statement request.
 *
 * @returns {Object}
 */
function buildResultRequestHeadersFile()
{
  return {
    'Accept': 'application/json'
  };
}
