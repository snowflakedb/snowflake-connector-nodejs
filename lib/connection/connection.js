/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const uuidv4 = require('uuid/v4');

var Util = require('../util');
var Errors = require('../errors');
var ErrorCodes = Errors.codes;
var EventEmitter = require('events').EventEmitter;
var Statement = require('./statement');
var Parameters = require('../parameters');

/**
 * Creates a new Connection instance.
 *
 * @param {ConnectionContext} context
 *
 * @returns {Object}
 */
function Connection(context)
{
  // validate input
  Errors.assertInternal(Util.isObject(context));

  var services = context.getServices();
  var connectionConfig = context.getConnectionConfig();

  // generate an id for the connection
  var id = uuidv4();

  //Make session tokens available for testing
  this.getTokens = function ()
  {
    if (connectionConfig._qaMode)
    {
      return services.sf.getConfig() && services.sf.getConfig().tokenInfo;
    }
    return {};
  }
  /**
   * Returns true if the connection is active otherwise false
   *
   * @returns {boolean}
   */
  this.isUp = function ()
  {
    return services.sf.isConnected();
  };

  this.getServiceName = function ()
  {
    return services.sf.getServiceName();
  };

  this.getClientSessionKeepAlive = function ()
  {
    return services.sf.getClientSessionKeepAlive();
  };

  this.getClientSessionKeepAliveHeartbeatFrequency = function ()
  {
    return services.sf.getClientSessionKeepAliveHeartbeatFrequency();
  };

  this.getJsTreatIntegerAsBigInt = function ()
  {
    return services.sf.getJsTreatIntegerAsBigInt();
  };

  /**
   * Returns the connection id.
   *
   * @returns {String}
   */
  this.getId = function ()
  {
    return id;
  };

  this.heartbeat = function (self)
  {
    self.execute({
      sqlText: 'select /* nodejs:heartbeat */ 1;',
      complete: function ()
      {
      },
      internal: true,
    });
  };

  /**
   * Establishes a connection if we aren't in a fatal state.
   *
   * @param {Function} callback
   *
   * @returns {Object} the connection object.
   */
  this.connect = function (callback)
  {
    // invalid callback
    Errors.checkArgumentValid(
      !Util.exists(callback) || Util.isFunction(callback),
      ErrorCodes.ERR_CONN_CONNECT_INVALID_CALLBACK);

    // connect to the snowflake service and provide our own callback so that
    // the connection can be passed in when invoking the connection.connect()
    // callback
    var self = this;

    services.sf.connect(
      {
        callback: function (err)
        {
          if (Parameters.getValue(Parameters.names.CLIENT_SESSION_KEEP_ALIVE))
          {
            self.keepalive = setInterval(self.heartbeat, Parameters.getValue(Parameters.names.CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY) * 1000, self);
          }

          if (Util.isFunction(callback))
          {
            callback(Errors.externalize(err), self);
          }
        }
      });

    // return the connection to facilitate chaining
    return this;
  };

  /**
   * Executes a statement.
   *
   * @param {Object} options
   *
   * @returns {Object}
   */
  this.execute = function (options)
  {
    return Statement.createRowStatementPreExec(
      options, services, connectionConfig);
  };

  /**
   * Fetches the result of a previously issued statement.
   *
   * @param {Object} options
   *
   * @returns {Object}
   */
  this.fetchResult = function (options)
  {
    return Statement.createRowStatementPostExec(
      options, services, connectionConfig);
  };

  /**
   * Immediately terminates the connection without waiting for currently
   * executing statements to complete.
   *
   * @param {Function} callback
   *
   * @returns {Object} the connection object.
   */
  this.destroy = function (callback)
  {
    // invalid callback
    Errors.checkArgumentValid(
      !Util.exists(callback) || Util.isFunction(callback),
      ErrorCodes.ERR_CONN_DESTROY_INVALID_CALLBACK);

    // log out of the snowflake service and provide our own callback so that
    // the connection can be passed in when invoking the connection.destroy()
    // callback
    var self = this;
    services.sf.destroy(
      {
        callback: function (err)
        {
          if (Util.exists(self.keepalive))
          {
            clearInterval(self.keepalive);
          }

          if (Util.isFunction(callback))
          {
            callback(Errors.externalize(err), self);
          }
        }
      });

    // return the connection to facilitate chaining
    return this;
  };

  /**
   * Returns a serialized version of this connection.
   *
   * @returns {String}
   */
  this.serialize = function ()
  {
    return JSON.stringify(context.getConfig());
  };

  EventEmitter.call(this);
}

Util.inherits(Connection, EventEmitter);

module.exports = Connection;