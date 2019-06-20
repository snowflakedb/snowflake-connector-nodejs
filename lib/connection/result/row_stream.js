/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Readable = require('stream').Readable;
var Util = require('../../util');
var Errors = require('../../errors');
var ResultStream = require('./result_stream');
var DataTypes = require('./data_types');

/**
 * Creates a stream that can be used to read a statement result row by row.
 *
 * @param {Object} statement
 * @param {Object} context
 * @param {Object} options
 * @constructor
 */
function RowStream(statement, context, options)
{
  // validate non-user-specified arguments
  Errors.assertInternal(Util.exists(statement));
  Errors.assertInternal(Util.exists(context));

  // call Readable constructor
  Readable.call(this,
    {
      objectMode: true,
      highWaterMark: context.connectionConfig.getRowStreamHighWaterMark()
    });

  // extract streaming options
  var start, end, fetchAsString;
  if (Util.isObject(options))
  {
    start = options.start;
    end = options.end;
    fetchAsString = options.fetchAsString;
  }

  // if a fetchAsString value is not specified in the stream options, try the
  // statement and connection options (in that order)
  if (!Util.exists(fetchAsString))
  {
    fetchAsString = context.fetchAsString;
  }
  if (!Util.exists(fetchAsString))
  {
    fetchAsString = context.connectionConfig.getFetchAsString();
  }

  var resultStream = null, numResultStreamInterrupts = 0;
  var rowBuffer = null, rowIndex = 0;
  var columns, mapColumnIdToExtractFnName;
  var initialized = false;

  var self = this;

  /**
   * Reads the next row in the result.
   *
   * @private
   */
  this._read = function ()
  {
    // if the stream has been initialized, just read the next row
    if (initialized)
    {
      readNextRow();
    }
    // if we're still fetching the result, wait for the operation to complete
    else if (context.isFetchingResult)
    {
      context.on('statement-complete', init);
    }
    // if we have a result or a fatal error, call init() in the next tick of
    // the event loop
    else if (context.result || isStatementErrorFatal(context.resultError))
    {
      process.nextTick(init);
    }
    else
    {
      // fetch the result again and call init() upon completion of the operation
      context.refresh(init);
    }
  };

  /**
   * Initializes this stream.
   */
  var init = function init()
  {
    // the stream has now been initialized
    initialized = true;

    // if we have a result
    if (context.result)
    {
      // if no value was specified for the start index or if the specified start
      // index is negative, default to 0, otherwise truncate the fractional part
      start = (!Util.isNumber(start) || (start < 0)) ? 0 : Math.floor(start);

      // if no value was specified for the end index or if the end index is
      // larger than the row index of the last row, default to the index of the
      // last row, otherwise truncate the fractional part
      var returnedRows = context.result.getReturnedRows();
      end = (!Util.isNumber(end) || (end >= returnedRows)) ? returnedRows - 1 :
        Math.floor(end);

      // find all the chunks that overlap with the specified range
      var overlappingChunks = context.result.findOverlappingChunks(start, end);

      // if no chunks overlap or start is greater than end, we're done
      if ((overlappingChunks.length === 0) || (start > end))
      {
        process.nextTick(close);
      }
      else
      {
        // create a result stream from the overlapping chunks
        resultStream = new ResultStream(
          {
            chunks: overlappingChunks,
            prefetchSize: context.connectionConfig.getResultPrefetch()
          });

        readNextRow();
      }
    }
    else
    {
      close(context.resultError);
    }
  };

  /**
   * Processes the row buffer.
   */
  var processRowBuffer = function processRowBuffer()
  {
    // get the row to add to the read queue
    var row = rowBuffer[rowIndex++];

    // if we just read the last row in the row buffer, clear the row buffer and
    // reset the row index so that we load the next chunk in the result stream
    // when _read() is called
    if (rowIndex === rowBuffer.length)
    {
      rowBuffer = null;
      rowIndex = 0;
    }

    // initialize the columns and column-related maps if necessary
    if (!columns)
    {
      columns = statement.getColumns();
    }
    if (!mapColumnIdToExtractFnName)
    {
      mapColumnIdToExtractFnName =
        buildMapColumnExtractFnNames(columns, fetchAsString);
    }

    // add the next row to the read queue
    process.nextTick(function ()
    {
      self.push(externalizeRow(row, columns, mapColumnIdToExtractFnName));
    });
  };

  /**
   * Called when the result stream reads a new chunk.
   *
   * @param {Chunk} chunk
   */
  var onResultStreamData = function onResultStreamData(chunk)
  {
    // unsubscribe from the result stream's 'data' and 'close' events
    resultStream.removeListener('data', onResultStreamData);
    resultStream.removeListener('close', onResultStreamClose);

    // get all the rows in the chunk that overlap with the requested window,
    // and use the resulting array as the new row buffer
    var chunkStart = chunk.getStartIndex();
    var chunkEnd = chunk.getEndIndex();
    rowBuffer = chunk.getRows().slice(
      Math.max(chunkStart, start) - chunkStart,
      Math.min(chunkEnd, end) + 1 - chunkStart);

    // reset the row index
    rowIndex = 0;

    // process the row buffer
    processRowBuffer();
  };

  /**
   * Called when there are no more chunks to read in the result stream or an
   * error is encountered while trying to read the next chunk.
   *
   * @param err
   * @param continueCallback
   */
  var onResultStreamClose = function onResultStreamClose(err, continueCallback)
  {
    // if the error is retryable and
    // the result stream hasn't been closed too many times
    if (isResultStreamErrorRetryable(err) &&
      (numResultStreamInterrupts <
        context.connectionConfig.getResultStreamInterrupts()))
    {
      numResultStreamInterrupts++;

      // fetch the statement result again
      context.refresh(function ()
      {
        if (context.resultError)
        {
          close(context.resultError);
        }
        else
        {
          continueCallback();
        }
      });
    }
    else
    {
      close(err);
    }
  };

  /**
   * Closes the row stream.
   *
   * @param {Error} [err]
   */
  var close = function (err)
  {
    // if we have a result stream, stop listening to events on it
    if (resultStream)
    {
      resultStream.removeListener('data', onResultStreamData);
      resultStream.removeListener('close', onResultStreamClose);
    }

    // we're done, so time to clean up
    rowBuffer = null;
    rowIndex = 0;
    resultStream = null;
    numResultStreamInterrupts = 0;

    if (err)
    {
      emitError(err);
    }
    else
    {
      self.push(null);
    }
  };

  /**
   * Called when we're ready to read the next row in the result.
   */
  var readNextRow = function readNextRow()
  {
    // if we have a row buffer, process it
    if (rowBuffer)
    {
      processRowBuffer();
    }
    else
    {
      // subscribe to the result stream's 'data' and 'close' events
      resultStream.on('data', onResultStreamData);
      resultStream.on('close', onResultStreamClose);

      // issue a request to fetch the next chunk in the result stream
      resultStream.read();
    }
  };

  /**
   * Externalizes an error and emits it.
   *
   * @param {Error} err
   */
  var emitError = function emitError(err)
  {
    self.emit('error', Errors.externalize(err));
  };
}

Util.inherits(RowStream, Readable);

/**
 * Determines if a statement error is fatal.
 *
 * @param {Error} error
 *
 * @returns {Boolean}
 */
function isStatementErrorFatal(error)
{
  return Errors.isOperationFailedError(error) && error.sqlState;
}

/**
 * Determines if a result stream error is a retryable error.
 *
 * @param {Error} error
 * @returns {Boolean}
 */
function isResultStreamErrorRetryable(error)
{
  return Errors.isLargeResultSetError(error) && error.response &&
    (error.response.statusCode === 403);
}

/**
 * Builds a map in which the keys are column ids and the values are the names of
 * the extract functions to use when retrieving row values for the corresponding
 * columns.
 *
 * @param {Object[]} columns
 * @param {String[]} fetchAsString the native types that should be retrieved as
 *   strings.
 *
 * @returns {Object}
 */
function buildMapColumnExtractFnNames(columns, fetchAsString)
{
  var fnNameGetColumnValue = 'getColumnValue';
  var fnNameGetColumnValueAsString = 'getColumnValueAsString';

  var index, length, column;
  var mapColumnIdToExtractFnName = {};

  // if no native types need to be retrieved as strings, extract values normally
  if (!Util.exists(fetchAsString))
  {
    for (index = 0, length = columns.length; index < length; index++)
    {
      column = columns[index];
      mapColumnIdToExtractFnName[column.getId()] = fnNameGetColumnValue;
    }
  }
  else
  {
    // build a map that contains all the native types that need to be
    // retrieved as strings when extracting column values from rows
    var nativeTypesMap = {};
    for (index = 0, length = fetchAsString.length; index < length; index++)
    {
      nativeTypesMap[fetchAsString[index].toUpperCase()] = true;
    }

    // for each column, pick the appropriate extract function
    // based on whether the value needs to be retrieved as a string
    for (index = 0, length = columns.length; index < length; index++)
    {
      column = columns[index];
      mapColumnIdToExtractFnName[column.getId()] =
        nativeTypesMap[DataTypes.toNativeType(column.getType())] ?
          fnNameGetColumnValueAsString : fnNameGetColumnValue;
    }
  }

  return mapColumnIdToExtractFnName;
}

/**
 * Converts an internal representation of a result row to a format appropriate
 * for consumption by the outside world.
 *
 * @param {Object} row
 * @param {Object[]} columns
 * @param {Object} [mapColumnIdToExtractFnName]
 *
 * @returns {Object}
 */
function externalizeRow(row, columns, mapColumnIdToExtractFnName)
{
  var externalizedRow = {};
  for (var index = 0, length = columns.length; index < length; index++)
  {
    var column = columns[index];
    var extractFnName = mapColumnIdToExtractFnName[column.getId()];
    externalizedRow[column.getName()] = row[extractFnName](column.getId());
  }

  return externalizedRow;
}

module.exports = RowStream;