/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var EventEmitter = require('events').EventEmitter;
var Util = require('../../util');
var Errors = require('../../errors');
var Chunk = require('./chunk');
var ResultStream = require('./result_stream');
var ChunkCache = require('./chunk_cache');
var Column = require('./column');
var Parameters = require('../../parameters');
var StatementType = require('./statement_type');

/**
 * Creates a new Result.
 *
 * @param {Object} options
 * @constructor
 */
function Result(options)
{
  var data;
  var chunkHeaders;
  var parametersMap;
  var parametersArray;
  var length;
  var index;
  var parameter;
  var mapColumnNameToIndices;
  var columns;
  var column;
  var version;

  // assert that options is a valid object that contains a response, statement,
  // services and connection config
  Errors.assertInternal(Util.isObject(options));
  Errors.assertInternal(Util.isObject(options.response));
  Errors.assertInternal(Util.isObject(options.statement));
  Errors.assertInternal(Util.isObject(options.services));
  Errors.assertInternal(Util.isObject(options.connectionConfig));

  // save the statement, services and connection config
  this._statement = options.statement;
  this._services = options.services;
  this._connectionConfig = options.connectionConfig;

  data = options.response.data;

  this._statementId = data.queryId;
  this._version = version = String(data.version); // don't rely on the version being a number
  this._returnedRows = data.returned;
  this._totalRows = data.total;
  this._statementTypeId = data.statementTypeId;

  // if no chunk headers were specified, but a query-result-master-key (qrmk)
  // was specified, build the chunk headers from the qrmk
  chunkHeaders = data.chunkHeaders;
  if (!Util.isObject(chunkHeaders) && Util.isString(data.qrmk))
  {
    chunkHeaders =
      {
        'x-amz-server-side-encryption-customer-algorithm': 'AES256',
        'x-amz-server-side-encryption-customer-key': data.qrmk
      };
  }
  this._chunkHeaders = chunkHeaders;

  // build a session state object from the response data; this can be used to
  // get the values of the current role, current warehouse, current database,
  // etc.
  this._sessionState = createSessionState(data);

  // convert the parameters array to a map
  parametersMap = {};
  parametersArray = data.parameters;
  for (index = 0, length = parametersArray.length; index < length; index++)
  {
    parameter = parametersArray[index];
    parametersMap[parameter.name] = parameter.value;
  }

  // save the parameters array
  this._parametersArray = parametersArray;

  // TODO: add timezone related information to columns

  // create columns from the rowtype array returned in the result
  var rowtype = data.rowtype;
  var numColumns = rowtype.length;

  this._columns = columns = new Array(numColumns);

  // convert the rowtype array to an array of columns and build an inverted
  // index map in which the keys are the column names and the values are the
  // indices of the columns with the corresponding names
  this._mapColumnNameToIndices = mapColumnNameToIndices = {};
  for (index = 0; index < numColumns; index++)
  {
    // create a new column and add it to the columns array
    columns[index] = column =
      new Column(rowtype[index], index, parametersMap, version);

    // if we don't already have an index array for a column with this name,
    // create a new one, otherwise just append to the existing array of indices
    mapColumnNameToIndices[column.getName()] =
      mapColumnNameToIndices[column.getName()] || [];
    mapColumnNameToIndices[column.getName()].push(index);
  }

  // create chunks
  this._chunks = createChunks(
    data.chunks,
    data.rowset,
    this._columns,
    this._mapColumnNameToIndices,
    this._chunkHeaders,
    parametersMap,
    this._version,
    this._statement,
    this._services);

  /* Disable the ChunkCache until the implementation is complete.
   * 
   *   // create a chunk cache and save a reference to it in case we need to
   *   // TODO: should we be clearing the cache at some point, e.g. when the result
   *   // is destroyed?
   *   this._chunkCache = createChunkCache(
   *   this._chunks,
   *   this._connectionConfig.getResultChunkCacheSize());
    */
}

Util.inherits(Result, EventEmitter);

/**
 * Refreshes the result by updating the chunk urls.
 *
 * @param response
 */
Result.prototype.refresh = function (response)
{
  var chunks = this._chunks;
  var chunkCfgs = response.data.chunks;
  for (var index = 0, length = chunks.length; index < length; index++)
  {
    chunks[index].setUrl(chunkCfgs[index].url);
  }
};

/**
 * TODO
 *
 * @param chunks
 * @param capacity
 *
 * @returns {ChunkCache}
 */
function createChunkCache(chunks, capacity)
{
  var chunkCache;
  var onLoadComplete;
  var index;
  var length;

  // create a chunk cache
  chunkCache = new ChunkCache(capacity);

  // every time a chunk is loaded, add it to the cache
  // TODO: should the caching be based on most recently 'used' or most recently
  // 'loaded'?
  onLoadComplete = function (err, chunk)
  {
    if (!err)
    {
      chunkCache.put(chunk);
    }
  };

  // subscribe to the 'loadcomplete' event on all the chunks
  for (index = 0, length = chunks.length; index < length; index++)
  {
    chunks[index].on('loadcomplete', onLoadComplete);
  }

  // TODO: do we need to unsubscribe from the loadcomplete event at some point?

  return chunkCache;
}

/**
 * Creates a session state object from the values of the current role, current
 * warehouse, etc., returned in the result response.
 *
 * @param responseData
 *
 * @returns {Object}
 */
function createSessionState(responseData)
{
  var currentRole = responseData.finalRoleName;
  var currentWarehouse = responseData.finalWarehouseName;
  var currentDatabaseProvider = responseData.databaseProvider;
  var currentDatabase = responseData.finalDatabaseName;
  var currentSchema = responseData.finalSchemaName;

  return {
    getCurrentRole: function ()
    {
      return currentRole;
    },
    getCurrentWarehouse: function ()
    {
      return currentWarehouse;
    },
    getCurrentDatabaseProvider: function ()
    {
      return currentDatabaseProvider;
    },
    getCurrentDatabase: function ()
    {
      return currentDatabase;
    },
    getCurrentSchema: function ()
    {
      return currentSchema;
    }
  };
}

/**
 * Creates an array of Chunk instances from the chunk-related information in the
 * result response.
 *
 * @param chunkCfgs
 * @param rowset
 * @param columns
 * @param mapColumnNameToIndices
 * @param chunkHeaders
 * @param statementParameters
 * @param resultVersion
 * @param statement
 * @param services
 *
 * @returns {Chunk}
 */
function createChunks(chunkCfgs,
                      rowset,
                      columns,
                      mapColumnNameToIndices,
                      chunkHeaders,
                      statementParameters,
                      resultVersion,
                      statement,
                      services)
{
  var chunks;
  var startIndex;
  var length;
  var index;
  var chunkCfg;

  // if we don't have any chunks, or if some records were returned inline,
  // fabricate a config object for the first chunk
  chunkCfgs = chunkCfgs || [];
  if (!chunkCfgs || rowset.length > 0)
  {
    chunkCfgs.unshift(
      {
        rowCount: rowset.length,
        url: null,
        rowset: rowset
      });
  }

  chunks = new Array(chunkCfgs.length);

  // loop over the chunk config objects and build Chunk instances out of them
  startIndex = 0;
  length = chunkCfgs.length;
  for (index = 0; index < length; index++)
  {
    chunkCfg = chunkCfgs[index];

    // augment the chunk config object with additional information
    chunkCfg.statement = statement;
    chunkCfg.services = services;
    chunkCfg.startIndex = startIndex;
    chunkCfg.columns = columns;
    chunkCfg.mapColumnNameToIndices = mapColumnNameToIndices;
    chunkCfg.chunkHeaders = chunkHeaders;
    chunkCfg.statementParameters = statementParameters;
    chunkCfg.resultVersion = resultVersion;

    // increment the start index for the next chunk
    startIndex += chunkCfg.rowCount;

    // create a new Chunk from the config object, and add it to the chunks array
    chunks[index] = new Chunk(chunkCfg);
  }

  return chunks;
}

/**
 * Returns the chunks in this result that overlap with a specified window.
 *
 * @param {Number} start the start index of the window.
 * @param {Number} end the end index of the window.
 *
 * @returns {Chunk[]}
 */
Result.prototype.findOverlappingChunks = function (start, end)
{
  return findOverlappingChunks(this._chunks, start, end);
};

/**
 * Fetches the rows from the result.
 *
 * @param {Object} options
 *
 * @returns {EventEmitter}
 */
Result.prototype.fetchRows = function (options)
{
  // validate options
  Errors.assertInternal(Util.isObject(options));
  Errors.assertInternal(Util.isFunction(options.each));

  // if no value was specified for the start index or if the specified start
  // index is negative, default to 0, otherwise truncate the fractional part
  var start = options.startIndex;
  start = (!Util.isNumber(start) || (start < 0)) ? 0 : Math.floor(start);

  // if no value was specified for the end index or if the end index is larger
  // than the row index of the last row, default to the index of the last row,
  // otherwise truncate the fractional part
  var returnedRows = this.getReturnedRows();
  var end = options.endIndex;
  end = (!Util.isNumber(end) || (end >= returnedRows)) ? returnedRows - 1 :
    Math.floor(end);

  // create an EventEmitter that will be returned to the
  // caller to track progress of the fetch-rows operation
  var operation = new EventEmitter();

  // define a function to asynchronously complete the operation
  var asyncComplete = function (err, continueCallback)
  {
    process.nextTick(function ()
    {
      operation.emit('complete', err, continueCallback);
    });
  };

  // if the start index is greater than the end index, asynchronously
  // complete the operation and return the operation
  if (start > end)
  {
    // the operation is now complete
    asyncComplete();
    return operation;
  }

  var connectionConfig = this._connectionConfig;

  // create a context object to store the state of the operation; we could store
  // the state in the operation itself, but it would be good to keep this state
  // private
  var context =
    {
      maxNumRowsToProcess: end - start + 1,
      numRowsProcessed: 0,
      rowBatchSize: connectionConfig.getResultProcessingBatchSize(),
      rowBatchDuration: connectionConfig.getResultProcessingBatchDuration()
    };

  // identify the chunks needed to get the requested rows, and create a stream
  // to read their contents
  var resultStream = new ResultStream(
    {
      chunks: findOverlappingChunks(this._chunks, start, end),
      prefetchSize: connectionConfig.getResultPrefetch()
    });

  // subscribe to the stream's 'close' event
  resultStream.on('close', function (err, continueCallback)
  {
    // the operation is now complete
    asyncComplete(err, continueCallback);
  });

  // subscribe to the stream's 'data' event
  resultStream.on('data', function (chunk)
  {
    // start processing the chunk rows
    processChunk(chunk);
  });

  /**
   * Processes the rows in a given chunk.
   *
   * @param {Object} chunk
   */
  var processChunk = function (chunk)
  {
    // get all the rows in the current chunk that overlap with the requested
    // window
    var chunkStart = chunk.getStartIndex();
    var chunkEnd = chunk.getEndIndex();
    var rows = chunk.getRows().slice(
      Math.max(chunkStart, start) - chunkStart,
      Math.min(chunkEnd, end) + 1 - chunkStart);

    var rowIndex = 0;
    var rowsLength = rows.length;

    // create a function that can be called to batch-process rows
    var processRows = function ()
    {
      // get the start position and start time
      var startIndex = rowIndex;
      var startTime = Date.now();

      var each = options.each;
      while (rowIndex < rowsLength)
      {
        // invoke the each() callback on the current row
        var ret = each(rows[rowIndex++]);

        context.numRowsProcessed++;

        // if the callback returned false, stop processing rows
        if (ret === false)
        {
          var stoppedProcessingRows = true;
          break;
        }

        // use the current position and current time to check if we've been
        // processing rows for too long; if so, leave the rest for the next
        // tick of the event loop
        if ((rowIndex - startIndex) >= context.rowBatchSize &&
          (Date.now() - startTime) > context.rowBatchDuration)
        {
          process.nextTick(processRows);
          break;
        }
      }

      // if there are no more rows for us to process in this chunk
      if (!(rowIndex < rowsLength) || stoppedProcessingRows)
      {
        // if we exhausted all the rows in this chunk and we haven't yet
        // processed all the rows we want to process, ask the result stream to
        // do another read
        if (!(rowIndex < rowsLength) &&
          context.numRowsProcessed !== context.maxNumRowsToProcess)
        {
          resultStream.read();
        }
        else
        {
          // we've either processed all the rows we wanted to process or we
          // were told to stop processing rows by the each() callback; either
          // way, close the result stream to complete the operation
          resultStream.asyncClose();
        }
      }
    };

    // start processing rows
    processRows();
  };

  // start reading from the stream in the next tick of the event loop
  process.nextTick(function ()
  {
    resultStream.read();
  });

  return operation;
};

/**
 * Given a sorted array of chunks, returns a sub-array that overlaps with a
 * specified window.
 *
 * @param chunks
 * @param windowStart
 * @param windowEnd
 *
 * @returns {Array}
 */
function findOverlappingChunks(chunks, windowStart, windowEnd)
{
  var overlappingChunks = [];

  if (chunks.length !== 0)
  {
    // get the index of the first chunk that overlaps with the specified window
    var index = findFirstOverlappingChunk(chunks, windowStart, windowEnd);

    // iterate over the chunks starting with the first overlapping chunk and
    // keep going until there's no overlap
    for (var length = chunks.length; index < length; index++)
    {
      var chunk = chunks[index];
      if (chunk.overlapsWithWindow(windowStart, windowEnd))
      {
        overlappingChunks.push(chunk);
      }
      else
      {
        // no future chunks will overlap because the chunks array is sorted
        break;
      }
    }
  }

  return overlappingChunks;
}

/**
 * Given a sorted array of chunks, returns the index of the first chunk in the
 * array that overlaps with a specified window.
 *
 * @param chunks
 * @param windowStartIndex
 * @param windowEndIndex
 *
 * @returns {number}
 */
function findFirstOverlappingChunk(chunks, windowStartIndex, windowEndIndex)
{
  var helper = function (chunks,
                         chunkIndexLeft,
                         chunkIndexRight,
                         windowStartIndex,
                         windowEndIndex)
  {
    var result;
    var chunkIndexMiddle;
    var middleChunk;
    var middleChunkEndIndex;

    // initialize the return value to -1
    result = -1;

    // compute the index of the middle chunk and get the middle chunk
    chunkIndexMiddle = Math.floor((chunkIndexLeft + chunkIndexRight) / 2);
    middleChunk = chunks[chunkIndexMiddle];

    // if we have two or fewer chunks
    if ((chunkIndexMiddle === chunkIndexLeft) ||
      (chunkIndexMiddle === chunkIndexRight))
    {
      // if we have just one chunk, and it overlaps with the specified window,
      // we've found the chunk we were looking for
      if (chunkIndexLeft === chunkIndexRight)
      {
        if (middleChunk.overlapsWithWindow(windowStartIndex, windowEndIndex))
        {
          result = chunkIndexLeft;
        }
      }
      else // we just have two chunks left to check
      {
        // if the first chunk overlaps with the specified window, that's the
        // chunk we were looking for
        if (chunks[chunkIndexLeft].overlapsWithWindow(
          windowStartIndex, windowEndIndex))
        {
          result = chunkIndexLeft;
        }

        // otherwise, if the second chunk overlaps with the specified window,
        // that's the chunk we were looking for
        else if (chunks[chunkIndexRight].overlapsWithWindow(
          windowStartIndex, windowEndIndex))
        {
          result = chunkIndexRight;
        }
      }

      return result;
    }

    // if the middle chunk does not overlap with the specified window
    if (!middleChunk.overlapsWithWindow(windowStartIndex, windowEndIndex))
    {
      middleChunkEndIndex = middleChunk.getEndIndex();

      // if the window is to the right of the middle chunk,
      // recurse on the right half
      if (windowStartIndex > middleChunkEndIndex)
      {
        return helper(
          chunks,
          chunkIndexMiddle,
          chunkIndexRight,
          windowStartIndex,
          windowEndIndex);
      }
      else
      {
        // recurse on the left half
        return helper(
          chunks,
          chunkIndexLeft,
          chunkIndexMiddle,
          windowStartIndex,
          windowEndIndex);
      }
    }
    else
    {
      // if the middle chunk overlaps but the chunk before it does not, the
      // middle chunk is the one we were looking
      if ((chunkIndexMiddle === 0) ||
        !chunks[chunkIndexMiddle - 1].overlapsWithWindow(
          windowStartIndex, windowEndIndex))
      {
        return chunkIndexMiddle;
      }
      else
      {
        // recurse on the left half
        return helper(
          chunks,
          chunkIndexLeft,
          chunkIndexMiddle,
          windowStartIndex,
          windowEndIndex);
      }
    }
  };

  return helper(chunks, 0, chunks.length - 1, windowStartIndex, windowEndIndex);
}

/**
 * Returns the columns in this result.
 *
 * @returns {Object[]}
 */
Result.prototype.getColumns = function ()
{
  return this._columns;
};

/**
 * Given a column identifier, returns the corresponding column. The column
 * identifier can be either the column name (String) or the column index
 * (Number). If a column name is specified and there is more than one column
 * with that name, the first column with the specified name will be returned.
 *
 * @param {String | Number} columnIdentifier
 *
 * @returns {Object}
 */
Result.prototype.getColumn = function (columnIdentifier)
{
  var columnIndex;

  // if the column identifier is a string, treat it as a column
  // name and use it to get the index of the specified column
  if (Util.isString(columnIdentifier))
  {
    // if a valid column name was specified, get the index of the first column
    // with the specified name
    if (mapColumnNameToIndices.hasOwnProperty(columnIdentifier))
    {
      columnIndex = mapColumnNameToIndices[columnIdentifier][0];
    }
  }
  // if the column identifier is a number, treat it as a column index
  else if (Util.isNumber(columnIdentifier))
  {
    columnIndex = columnIdentifier;
  }

  return this._columns[columnIndex];
};

/**
 * Returns the statement id generated by the server for the statement that
 * produced this result.
 *
 * @returns {string}
 */
Result.prototype.getStatementId = function ()
{
  return this._statementId;
};

/**
 * Returns the number of rows in this result.
 *
 * @returns {number}
 */
Result.prototype.getReturnedRows = function ()
{
  return this._returnedRows;
};

/**
 * Returns the number of rows updated by the statement that produced this
 * result. If the statement isn't a DML, we return -1.
 *
 * @returns {Number}
 */
Result.prototype.getNumUpdatedRows = function ()
{
  // initialize if necessary
  if (!this._numUpdatedRows)
  {
    var numUpdatedRows = -1;

    // the updated-rows metric only applies to dml's
    var statementTypeId = this._statementTypeId;
    if (StatementType.isDml(statementTypeId))
    {
      if (StatementType.isInsert(statementTypeId) ||
        StatementType.isUpdate(statementTypeId) ||
        StatementType.isDelete(statementTypeId) ||
        StatementType.isMerge(statementTypeId) ||
        StatementType.isMultiTableInsert(statementTypeId))
      {
        var chunks = this._chunks;
        var columns = this._columns;

        // if the statement is a dml, the result should be small,
        // meaning we only have one chunk
        Errors.assertInternal(Util.isArray(chunks) && (chunks.length === 1));

        // add up the values in all the columns
        numUpdatedRows = 0;
        var rows = chunks[0].getRows();
        for (var rowIndex = 0, rowsLength = rows.length;
             rowIndex < rowsLength; rowIndex++)
        {
          var row = rows[rowIndex];
          for (var colIndex = 0, colsLength = columns.length;
               colIndex < colsLength; colIndex++)
          {
            numUpdatedRows += Number(
              row.getColumnValue(columns[colIndex].getId()));
          }
        }
      }
      // TODO: handle 'copy' and 'unload'
    }

    this._numUpdatedRows = numUpdatedRows;
  }

  return this._numUpdatedRows;
};

/**
 * Returns the number of rows we would have had in this result if the value of
 * the ROWS_PER_RESULTSET parameter was 0 at the time this statement was
 * executed.
 *
 * @returns {number}
 */
Result.prototype.getTotalRows = function ()
{
  return this._totalRows;
};

/**
 * Returns the parameters associated with this result. These parameters contain
 * directives about how to consume and present the result.
 *
 * @returns {Object[]}
 */
Result.prototype.getParametersArray = function ()
{
  return this._parametersArray;
};

/**
 * Returns an object that contains information about the values of the current
 * warehouse, current database, and any other session-related state when the
 * statement that produced this result finished executing.
 *
 * @returns {Object}
 */
Result.prototype.getSessionState = function ()
{
  return this._sessionState;
};

/**
 * Returns the version associated with this result.
 *
 * @returns {string}
 */
Result.prototype.getVersion = function ()
{
  return this._version;
};

module.exports = Result;