/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */
const { v4: uuidv4 } = require('uuid');
const Url = require('url');
const QueryString = require('querystring');
const GSErrors = require('../constants/gs_errors')
const QueryStatus = require('../constants/query_status');

var Util = require('../util');
var Errors = require('../errors');
var ErrorCodes = Errors.codes;
var EventEmitter = require('events').EventEmitter;
var Statement = require('./statement');
var Parameters = require('../parameters');
var Authenticator = require('../authentication/authentication');
var Logger = require('../logger');
const {isOktaAuth} = require('../authentication/authentication');

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

  // async max retry and retry pattern from python connector
  const asyncNoDataMaxRetry = 24;
  const asyncRetryPattern = [1, 1, 2, 3, 4, 8, 10];
  const asyncRetryInMilliseconds = 500;

  // Custom regex based on uuid validate
  // Unable to directly use uuid validate because the queryId returned from the server doesn't match the regex
  const queryIdRegex = new RegExp(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i);

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
      Logger.getInstance().trace('Connection heartbeat failed: %s', JSON.stringify(e, Util.getCircularReplacer()));
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
      isOktaAuth(authenticationType))
    {
      throw Errors.createClientError(
        ErrorCodes.ERR_CONN_CREATE_INVALID_AUTH_CONNECT);
    }

    // Get authenticator to use
    const auth = Authenticator.getAuthenticator(connectionConfig, context.getHttpClient());

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

    services.sf.connect({
      callback: connectCallback(self, callback),
      json: body
    });
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
    const auth = Authenticator.getAuthenticator(connectionConfig, context.getHttpClient());

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
   * Gets the response containing the status of the query based on queryId.
   *
   * @param {String} queryId
   *
   * @returns {Object} the query response
   */
  async function getQueryResponse(queryId) {
    // Check if queryId exists and is valid uuid
    Errors.checkArgumentExists(Util.exists(queryId),
      ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID);
    Errors.checkArgumentValid(queryIdRegex.test(queryId),
      ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID, queryId);

    // Form the request options
    const options =
    {
      method: 'GET',
      url: Url.format(
        {
          pathname: `/monitoring/queries/${queryId}`
        }),
    };

    // Get the response containing the query status
    const response = await services.sf.requestAsync(options);

    return response['data'];
  }

  /**
   * Extracts the status of the query from the query response.
   *
   * @param {Object} queryResponse
   *
   * @returns {String} the query status.
   */
  function extractQueryStatus(queryResponse) {
    const queries = queryResponse['data']['queries'];
    let status = QueryStatus.code.NO_DATA; // default status
    if (queries.length > 0) {
      status = queries[0]['status'];
    }

    return status;
  }

  /**
   * Gets the status of the query based on queryId.
   *
   * @param {String} queryId
   *
   * @returns {String} the query status.
   */
  this.getQueryStatus = async function (queryId) {
    return extractQueryStatus(await getQueryResponse(queryId));
  };

  /**
   * Gets the status of the query based on queryId and throws if there's an error.
   *
   * @param {String} queryId
   *
   * @returns {String} the query status.
   */
  this.getQueryStatusThrowIfError = async function (queryId) {
    const status = this.getQueryStatus(queryId);

    let message, code, sqlState = null;

    if (this.isAnError(status)) {
      const response = await getQueryResponse(queryId);
      message = response['message'] || '';
      code = response['code'] || -1;

      if (response['data']) {
        message += response['data']['queries'].length > 0 ? response['data']['queries'][0]['errorMessage'] : '';
        sqlState = response['data']['sqlState'];
      }

      throw Errors.createOperationFailedError(
        code, response, message, sqlState);
    }

    return status;
  };

  /**
   * Gets the results from a previously ran query based on queryId
   *
   * @param {Object} options
   *
   * @returns {Object}
   */
  this.getResultsFromQueryId = async function (options) {
    const queryId = options.queryId;
    let status, noDataCounter = 0, retryPatternPos = 0;

    // Wait until query has finished executing
    let queryStillExecuting = true;
    while (queryStillExecuting) {
      // Check if query is still running and trigger exception if it failed
      status = await this.getQueryStatusThrowIfError(queryId);
      queryStillExecuting = this.isStillRunning(status);
      if (!queryStillExecuting) {
        break;
      }

      // Timeout based on query status retry rules
      await new Promise((resolve) => {
        setTimeout(() => resolve(), asyncRetryInMilliseconds * asyncRetryPattern[retryPatternPos]);
      });

      // If no data, increment the no data counter
      if (QueryStatus.code[status] == QueryStatus.code.NO_DATA) {
        noDataCounter++;
        // Check if retry for no data is exceeded
        if (noDataCounter > asyncNoDataMaxRetry) {
          throw Errors.createClientError(
            ErrorCodes.ERR_GET_RESULTS_QUERY_ID_NO_DATA, true, queryId);
        }
      }

      if (retryPatternPos < asyncRetryPattern.length - 1) {
        retryPatternPos++;
      }
    }

    if (QueryStatus.code[status] != QueryStatus.code.SUCCESS) {
      throw Errors.createClientError(
        ErrorCodes.ERR_GET_RESULTS_QUERY_ID_NOT_SUCCESS_STATUS, true, queryId, status);
    }

    return this.fetchResult(options);
  };

  /**
   * Checks whether the given status is currently running.
   *
   * @param {String} status
   *
   * @returns {Boolean}
   */
  this.isStillRunning = function (status) {
    return QueryStatus.runningStatuses.includes(QueryStatus.code[status]);
  };

  /**
   * Checks whether the given status means that there has been an error.
   *
   * @param {String} status
   *
   * @returns {Boolean}
   */
  this.isAnError = function (status) {
    return QueryStatus.errorStatuses.includes(QueryStatus.code[status]);
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