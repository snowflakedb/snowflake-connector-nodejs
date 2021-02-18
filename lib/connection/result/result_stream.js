/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var EventEmitter = require('events').EventEmitter;
var Util = require('../../util');
var Errors = require('../../errors');

/**
 * Creates a stream-like object that can be used to read the contents of an
 * array of chunks with the ability to prefetch chunks as we go. Every time the
 * contents of a new chunk become available, a 'data' event is fired. When there
 * are no more chunks to read, a 'close' event is fired to indicate that the
 * read operation is complete. If no chunks are specified in the options, the
 * stream asynchronously fires a 'close' event after it is returned.
 *
 * @param {Object} [options] An options object with the following properties:
 *   {Object[]} chunks       - The chunks to read.
 *   {Number}   prefetchSize - The number of chunks to prefetch every time a new
 *     chunk is read.
 *
 * @constructor
 */
function ResultStream(options)
{
  // options should be an object
  Errors.assertInternal(Util.isObject(options));

  var chunks = options.chunks;
  var prefetchSize = options.prefetchSize;

  // chunks should be an array
  Errors.assertInternal(Util.isArray(chunks));

  // prefetch size should be non-negative
  Errors.assertInternal(Util.isNumber(prefetchSize) && (prefetchSize >= 0));

  // start with the first chunk
  var start = 0;

  var self = this;

  /**
   * Called when a chunk fires a 'loadcomplete' event.
   *
   * @param {Error} err
   * @param {Chunk} chunk
   */
  var onLoadComplete = function (err, chunk)
  {
    // unsubscribe from the 'loadcomplete' event
    chunk.removeListener('loadcomplete', onLoadComplete);

    // if the chunk load succeeded
    if (!err)
    {
      // move on to the next chunk
      start++;

      // emit an event to signal that new data is available
      self.emit('data', chunk);
    }
    else
    {
      // close the stream with an error; also, include a callback when emitting
      // the event in case someone wants to fix the problem and ask us to
      // continue from where we got interrupted
      close(self, err, doLoad);
    }
  };

  /**
   * Identifies the next chunk to load and issues requests to fetch both its
   * contents plus the contents of the next few chunks. If there are no more
   * chunks to load, a 'close' event is fired on the stream to notify
   * subscribers that all the chunks have been successfully read.
   */
  var doLoad = function ()
  {
    // get the array of chunks whose contents need to be fetched
    var buffer = chunks.slice(start, start + prefetchSize + 1);

    // the first chunk in the buffer is the next chunk we want to load
    var nextChunk = buffer[0];

    // if we don't have anymore chunks to load, we're done
    if (!nextChunk)
    {
      self.asyncClose();
    }
    else
    {
      // fire off requests to load all the chunks in the buffer that aren't
      // already loading
      var chunk, index, length;
      for (index = 0, length = buffer.length; index < length; index++)
      {
        chunk = buffer[index];
        if (!chunk.isLoading())
        {
          chunk.load();
        }
      }

      // subscribe to the loadcomplete event on the next chunk
      nextChunk.on('loadcomplete', onLoadComplete);
    }
  };

  /**
   * Reads the next chunk of data in the result stream.
   */
  this.read = function ()
  {
    // TODO: if there are no more chunks to read, should we raise an error?
    // TODO: what if we're already in the middle of a read?

    // read the next chunk
    doLoad();
  };
}

Util.inherits(ResultStream, EventEmitter);

/**
 * Asynchronously closes this stream.
 *
 * @returns {ResultStream}
 */
ResultStream.prototype.asyncClose = function ()
{
  // schedule an operation to close the stream in
  // the next tick of the event loop
  var self = this;
  process.nextTick(function ()
  {
    close(self);
  });

  return this;
};

/**
 * Closes a given result stream.
 *
 * @param {ResultStream} stream The stream to close.
 * @param {Error} [err] The error, if any, to fire with the close event.
 * @param {Function} [callback] The callback, if any, to fire with the close
 *   event. This is in case someone wants to fix the problem and ask the stream
 *   to resume from the point of interruption.
 */
function close(stream, err, callback)
{
  stream.emit('close', err, callback);
}

module.exports = ResultStream;