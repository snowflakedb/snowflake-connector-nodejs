/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('./util');
var Errors = require('./errors');
var ErrorCodes = Errors.codes;
var Connection = require('./connection/connection');
var ConnectionConfig = require('./connection/connection_config');
var ConnectionContext = require('./connection/connection_context');
var GenericPool = require("generic-pool");
var Logger = require('./logger');
var LoggerCore = require('./logger/core');
var DataTypes = require('./connection/result/data_types');
var GlobalConfig = require('./global_config');

/**
 * Creates a new instance of the Snowflake core module.
 *
 * @param {Object} options
 *
 * @returns {Object}
 * @constructor
 */
function Core(options)
{
  // validate input
  Errors.assertInternal(Util.isObject(options));
  Errors.assertInternal(
    Util.exists(options.httpClient || options.httpClientClass));
  Errors.assertInternal(Util.exists(options.loggerClass));

  // set the logger instance
  Logger.setInstance(new (options.loggerClass)());

  // if a connection class is specified, it must be an object or function
  var connectionClass = options.connectionClass;
  if (Util.exists(connectionClass))
  {
    Errors.assertInternal(
      Util.isObject(connectionClass) || Util.isFunction(connectionClass));
  }
  else
  {
    // fall back to Connection
    connectionClass = Connection;
  }

  var qaMode = options.qaMode;
  var clientInfo = options.client;
  var ocspModes = GlobalConfig.ocspModes;

  /**
   * Creates a new Connection instance.
   *
   * @param {Object} connectionOptions
   * @param {Object} [config]
   *
   * @returns {Object}
   */
  var createConnection = function createConnection(connectionOptions, config)
  {
    // create a new ConnectionConfig and skip credential-validation if a config
    // object has been specified; this is because if a config object has been
    // specified, we're trying to deserialize a connection and the account name,
    // username and password don't need to be specified because the config
    // object already contains the tokens we need
    // Alternatively, if the connectionOptions includes token information then we will use that
    // instead of the username/password

    var validateCredentials = !config && (connectionOptions && !connectionOptions.sessionToken)
    var connectionConfig =
      new ConnectionConfig(connectionOptions, validateCredentials, qaMode, clientInfo);

    // if an http client was specified in the options passed to the module, use
    // it, otherwise create a new HttpClient
    var httpClient = options.httpClient ||
      new options.httpClientClass(connectionConfig);

    return new connectionClass(
      new ConnectionContext(connectionConfig, httpClient, config));
  };

  var instance =
    {
      ocspModes: ocspModes,
      /**
       * Creates a connection object that can be used to communicate with
       * Snowflake.
       *
       * @param {Object} options
       *
       * @returns {Object}
       */
      createConnection: function (options)
      {
        return createConnection(options);
      },

      /**
      * Creates a connection pool for Snowflake connections
      *
      * @param {Object} connectionOptions
      * @param {Object} poolOptions
      *
      * @returns {Object}
      */
      createPool: function (connectionOptions, poolOptions)
      {
        return createPool(connectionOptions, poolOptions);
      },

      /**
       * Deserializes a serialized connection.
       *
       * @param {Object} options
       * @param {String} serializedConnection
       *
       * @returns {Object}
       */
      deserializeConnection: function (options, serializedConnection)
      {
        // check for missing serializedConfig
        Errors.checkArgumentExists(Util.exists(serializedConnection),
          ErrorCodes.ERR_CONN_DESERIALIZE_MISSING_CONFIG);

        // check for invalid serializedConfig
        Errors.checkArgumentValid(Util.isString(serializedConnection),
          ErrorCodes.ERR_CONN_DESERIALIZE_INVALID_CONFIG_TYPE);

        // try to json-parse serializedConfig
        var config;
        try
        {
          config = JSON.parse(serializedConnection);
        }
        catch (err)
        {
        }
        finally
        {
          // if serializedConfig can't be parsed to json, throw an error
          Errors.checkArgumentValid(Util.isObject(config),
            ErrorCodes.ERR_CONN_DESERIALIZE_INVALID_CONFIG_FORM);
        }

        return createConnection(options, config);
      },

      /**
       * Serializes a given connection.
       *
       * @param {Object} connection
       *
       * @returns {String} a serialized version of the connection.
       */
      serializeConnection: function (connection)
      {
        return connection ? connection.serialize() : connection;
      },

      /**
       * Configures this instance of the Snowflake core module.
       *
       * @param {Object} options
       */
      configure: function (options)
      {
        var logTag = options.logLevel;
        if (Util.exists(logTag))
        {
          // check that the specified value is a valid tag
          Errors.checkArgumentValid(LoggerCore.isValidLogTag(logTag),
            ErrorCodes.ERR_GLOGAL_CONFIGURE_INVALID_LOG_LEVEL);

          Logger.getInstance().configure(
            {
              level: LoggerCore.logTagToLevel(logTag)
            });
        }

        var insecureConnect = options.insecureConnect;
        if (Util.exists(insecureConnect))
        {
          // check that the specified value is a boolean
          Errors.checkArgumentValid(Util.isBoolean(insecureConnect),
            ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_INSECURE_CONNECT);

          GlobalConfig.setInsecureConnect(insecureConnect);
        }
        let ocspFailOpen = options.ocspFailOpen;
        if (Util.exists(ocspFailOpen))
        {
          Errors.checkArgumentValid(Util.isBoolean(ocspFailOpen),
            ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_OCSP_MODE);

          GlobalConfig.setOcspFailOpen(ocspFailOpen);
        }
      }
    };

  // add some read-only constants
  var nativeTypeValues = DataTypes.NativeTypes.values;
  Object.defineProperties(instance,
    {
      STRING: {value: nativeTypeValues.STRING},
      BOOLEAN: {value: nativeTypeValues.BOOLEAN},
      NUMBER: {value: nativeTypeValues.NUMBER},
      DATE: {value: nativeTypeValues.DATE},
      JSON: {value: nativeTypeValues.JSON}
    });

  /**
  * Factory for Snowflake connections based on Generic Pool
  *
  * @param {Object} connectionOptions
  *
  * @returns {null}
  */
  function ConnectionFactory(connectionOptions)
  {
    /**
     * Creates a new connection instance.
     *
     * @returns {Object}
     */
    this.create = function ()
    {
      const connection = new createConnection(connectionOptions);

      return new Promise((resolve, reject) =>
      {
        connection.connect(
          function (err, conn)
          {
            if (err)
            {
              console.error('Unable to connect: ' + err.message);
              reject(new Error(err.message));
            }
            else
            {
              resolve(conn);
            }
          }
        );
      });
    }

    /**
    * Destroys the specified connection instance.
    *
    * @param {Object} connection
    *
    * @returns {Object}
    */
    this.destroy = function (connection)
    {
      return new Promise((resolve) =>
      {
        connection.destroy(function (err, conn)
        {
          if (err)
          {
            console.error('Unable to disconnect: ' + err.message);
          }
          resolve();
        });
      });
    }

    /**
    * Returns the status of the connection.
    *
    * @param {Object} connection
    *
    * @returns {Boolean}
    */
    this.validate = async function (connection)
    {
      var heartbeat = await connection.heartbeatAsync();
      return ((heartbeat[0][1] == 1) && connection.isUp());
    }
  }

  /**
  * Creates a connection pool for Snowflake connections
  *
  * @param {Object} connectionOptions
  * @param {Object} poolOptions
  *
  * @returns {Object}
  */
  var createPool = function createPool(connectionOptions, poolOptions)
  {
    const connectionPool = GenericPool.createPool(
      new ConnectionFactory(connectionOptions),
      poolOptions
    );

    // avoid infinite loop if factory creation fails
    connectionPool.on('factoryCreateError', function(err) {
        const clientResourceRequest = connectionPool._waitingClientsQueue.dequeue();
    })

    return connectionPool;
  };

  return instance;
}

module.exports = Core;
