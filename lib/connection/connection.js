/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */
const { v4: uuidv4 } = require('uuid');
const Url = require('url');
const QueryString = require('querystring');
const GSErrors = require('../constants/gs_errors')

var Util = require('../util');
var Errors = require('../errors');
var ErrorCodes = Errors.codes;
var EventEmitter = require('events').EventEmitter;
var Statement = require('./statement');
var Parameters = require('../parameters');
var Authenticator = require('../authentication/authentication');
var Logger = require('../logger');


const PRIVATELINK_URL_SUFFIX = ".privatelink.snowflakecomputing.com";

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

  /**
  * Returns true if the session token and master token are valid
  *
  * @returns {boolean}
  */
  this.isTokenValid = function ()
  {
    var tokenInfo = services.sf.getConfig().tokenInfo;

    var sessionTokenExpirationTime = tokenInfo.sessionTokenExpirationTime;
    var isSessionValid = sessionTokenExpirationTime > Date.now();

    var masterTokenExpirationTime = tokenInfo.masterTokenExpirationTime;
    var isMasterValid = masterTokenExpirationTime > Date.now();

    return (isSessionValid && isMasterValid);
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

  this.heartbeat = callback =>
  {
    Logger.getInstance().debug('Issuing heartbeat call');
    const requestID = uuidv4();

    services.sf.request(
      {
        method: 'POST',
        url: Url.format(
          {
            pathname: '/session/heartbeat',
            search: QueryString.stringify(
              {
                requestId: requestID
              })
          }),
        callback: Util.isFunction(callback) ? callback : function (err, body)
        {
          if (err)
          {
            Logger.getInstance().error('Error issuing heartbeat call: %s', err.message);
          }
          else
          {
            Logger.getInstance().debug('Heartbeat response %s', JSON.stringify(body));
          }
        }
      }
    );
  };

  this.heartbeatAsync = () =>
  {
    return new Promise((resolve, reject) =>
    {
      // previous version of driver called `select 1;` which result in `[ { '1': 1 } ]`
      this.heartbeat((err) => err ? reject(err) : resolve([ { '1': 1 } ]));
    });
  };

  /**
   * @return {Promise<boolean>}
   */
  this.isValidAsync = async () =>
  {
    if (!this.isUp())
    {
      return false;
    }
    try
    {
      await this.heartbeatAsync()
      return true;
    }
    catch (e)
    {
      Logger.getInstance().trace('Connection heartbeat failed: %s', JSON.stringify(e));
      return false;
    }
  };

  /**
  * Set the private link as the OCSP cache server's URL.
  *
  * @param {String} host
  *
  * @returns {null}
  */
  this.setupOcspPrivateLink = function (host)
  {
    var ocspCacheServer = `http://ocsp.${host}/ocsp_response_cache.json`;
    process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL = ocspCacheServer;
  }

  /**
  * Callback for connect() used to establish a connection.
  *
  * @param {self} this object
  * @param {Function} callback
  *
  * @returns {function}
  */
  function connectCallback(self, callback)
  {
    return function (err)
    {
      if (Parameters.getValue(Parameters.names.CLIENT_SESSION_KEEP_ALIVE))
      {
        self.keepalive = setInterval(self.heartbeat, Parameters.getValue(Parameters.names.CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY) * 1000, self);
      }
      if (Util.isFunction(callback))
      {
        callback(Errors.externalize(err), self);
      }
    };
  }

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

    if (connectionConfig.host.endsWith(PRIVATELINK_URL_SUFFIX))
    {
      this.setupOcspPrivateLink(connectionConfig.host);
    }

    // connect to the snowflake service and provide our own callback so that
    // the connection can be passed in when invoking the connection.connect()
    // callback
    var self = this;

    var authenticationType = connectionConfig.getAuthenticator();

    // check if authentication type is compatible with connect()
    // external browser and okta are not compatible with connect() due to their usage of async functions
    if (authenticationType === Authenticator.authenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR ||
      authenticationType.startsWith('HTTPS://'))
    {
      throw Errors.createClientError(
        ErrorCodes.ERR_CONN_CREATE_INVALID_AUTH_CONNECT);
    }

    // Get authenticator to use
    var auth = Authenticator.getAuthenticator(connectionConfig);

    try
    {
      auth.authenticate(connectionConfig.getAuthenticator(),
        connectionConfig.getServiceName(),
        connectionConfig.account,
        connectionConfig.username);

      // JSON for connection
      var body = Authenticator.formAuthJSON(connectionConfig.getAuthenticator(),
        connectionConfig.account,
        connectionConfig.username,
        connectionConfig.getClientType(),
        connectionConfig.getClientVersion(),
        connectionConfig.getClientEnvironment());

      // Update JSON body with the authentication values
      auth.updateBody(body);
    }
    catch (authErr)
    {
      throw authErr;
    }

    // Request connection
    services.sf.connect({
      callback: connectCallback(self, callback),
      json: body
    });

    // return the connection to facilitate chaining
    return this;
  };


  /**
   * Establishes a connection if we aren't in a fatal state.
   *
   * @param {Function} callback
   *
   * @returns {Object} the connection object.
   */
  this.connectAsync = async function (callback)
  {
    // invalid callback
    Errors.checkArgumentValid(
      !Util.exists(callback) || Util.isFunction(callback),
      ErrorCodes.ERR_CONN_CONNECT_INVALID_CALLBACK);

    if (connectionConfig.host.endsWith(PRIVATELINK_URL_SUFFIX))
    {
      this.setupOcspPrivateLink(connectionConfig.host);
    }

    // connect to the snowflake service and provide our own callback so that
    // the connection can be passed in when invoking the connection.connect()
    // callback
    var self = this;

    // Get authenticator to use
    var auth = Authenticator.getAuthenticator(connectionConfig);

    try
    {
      await auth.authenticate(connectionConfig.getAuthenticator(),
        connectionConfig.getServiceName(),
        connectionConfig.account,
        connectionConfig.username)
        .then(() =>
        {
          // JSON for connection
          var body = Authenticator.formAuthJSON(connectionConfig.getAuthenticator(),
            connectionConfig.account,
            connectionConfig.username,
            connectionConfig.getClientType(),
            connectionConfig.getClientVersion(),
            connectionConfig.getClientEnvironment());

          // Update JSON body with the authentication values
          auth.updateBody(body);

          // Request connection
          services.sf.connect({
            callback: connectCallback(self, callback),
            json: body
          });
        });
    }
    catch (authErr)
    {
      callback(authErr);
    }

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
    return Statement.createStatementPreExec(
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
    return Statement.createStatementPostExec(
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