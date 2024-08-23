/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const Util = require('./util');
const Errors = require('./errors');
const ErrorCodes = Errors.codes;
const Connection = require('./connection/connection');
const ConnectionConfig = require('./connection/connection_config');
const ConnectionContext = require('./connection/connection_context');
const GenericPool = require('generic-pool');
const Logger = require('./logger');
const LoggerCore = require('./logger/core');
const DataTypes = require('./connection/result/data_types');
const GlobalConfig = require('./global_config');
const { loadConnectionConfiguration } = require('./configuration/connection_configuration');

/**
 * Creates a new instance of the Snowflake core module.
 *
 * @param {Object} options
 *
 * @returns {Object}
 * @constructor
 */
function Core(options) {
  // validate input
  Errors.assertInternal(Util.isObject(options));
  Errors.assertInternal(
    Util.exists(options.httpClient || options.httpClientClass));
  Errors.assertInternal(Util.exists(options.loggerClass));

  // set the logger instance
  Logger.setInstance(new (options.loggerClass)());

  // if a connection class is specified, it must be an object or function
  let connectionClass = options.connectionClass;
  if (Util.exists(connectionClass)) {
    Errors.assertInternal(
      Util.isObject(connectionClass) || Util.isFunction(connectionClass));
  } else {
    // fall back to Connection
    connectionClass = Connection;
  }

  const qaMode = options.qaMode;
  const clientInfo = options.client;
  const ocspModes = GlobalConfig.ocspModes;

  /**
   * Creates a new Connection instance.
   *
   * @param {Object} connectionOptions
   * @param {Object} [config]
   *
   * @returns {Object}
   */
  const createConnection = function createConnection(connectionOptions, config) {
    // create a new ConnectionConfig and skip credential-validation if a config
    // object has been specified; this is because if a config object has been
    // specified, we're trying to deserialize a connection and the account name,
    // username and password don't need to be specified because the config
    // object already contains the tokens we need
    // Alternatively, if the connectionOptions includes token information then we will use that
    // instead of the username/password

    if (connectionOptions == null) {
      try {
        connectionOptions = loadConnectionConfiguration();
      } catch ( error ) {
        Logger.getInstance().debug(`Problem during reading connection configuration from file: ${error.message}`);
        Errors.checkArgumentExists(Util.exists(connectionOptions),
          ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS);
      }
    }

    const validateCredentials = !config && (connectionOptions && !connectionOptions.sessionToken);
    const connectionConfig =
      new ConnectionConfig(connectionOptions, validateCredentials, qaMode, clientInfo);

    // if an http client was specified in the options passed to the module, use
    // it, otherwise create a new HttpClient
    const httpClient = options.httpClient ||
      new options.httpClientClass(connectionConfig);

    return new connectionClass(
      new ConnectionContext(connectionConfig, httpClient, config));
  };

  const instance =
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
      createConnection: function (options) {
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
      createPool: function (connectionOptions, poolOptions) {
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
      deserializeConnection: function (options, serializedConnection) {
        // check for missing serializedConfig
        Errors.checkArgumentExists(Util.exists(serializedConnection),
          ErrorCodes.ERR_CONN_DESERIALIZE_MISSING_CONFIG);

        // check for invalid serializedConfig
        Errors.checkArgumentValid(Util.isString(serializedConnection),
          ErrorCodes.ERR_CONN_DESERIALIZE_INVALID_CONFIG_TYPE);

        // try to json-parse serializedConfig
        let config;
        try {
          config = JSON.parse(serializedConnection);
        } finally {
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
      serializeConnection: function (connection) {
        return connection ? connection.serialize() : connection;
      },

      /**
       * Configures this instance of the Snowflake core module.
       *
       * @param {Object} options
       */
      configure: function (options) {
        const logLevel = extractLogLevel(options);
        const logFilePath = options.logFilePath;
        const additionalLogToConsole = options.additionalLogToConsole;
        if (logLevel != null || logFilePath) {
          Logger.getInstance().debug(`Configuring logger with level: ${logLevel}, filePath: ${logFilePath}, additionalLogToConsole: ${additionalLogToConsole}`);
          Logger.getInstance().configure(
            {
              level: logLevel,
              filePath: logFilePath,
              additionalLogToConsole: additionalLogToConsole
            });
        }

        const insecureConnect = options.insecureConnect;
        if (Util.exists(insecureConnect)) {
          // check that the specified value is a boolean
          Errors.checkArgumentValid(Util.isBoolean(insecureConnect),
            ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_INSECURE_CONNECT);

          GlobalConfig.setInsecureConnect(insecureConnect);
        }

        const ocspFailOpen = options.ocspFailOpen;
        if (Util.exists(ocspFailOpen)) {
          Errors.checkArgumentValid(Util.isBoolean(ocspFailOpen),
            ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_OCSP_MODE);

          GlobalConfig.setOcspFailOpen(ocspFailOpen);
        }

        const jsonColumnVariantParser = options.jsonColumnVariantParser;
        if (Util.exists(jsonColumnVariantParser)) {
          Errors.checkArgumentValid(Util.isFunction(jsonColumnVariantParser),
            ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_JSON_PARSER);

          GlobalConfig.setJsonColumnVariantParser(jsonColumnVariantParser);
        }

        const xmlColumnVariantParser = options.xmlColumnVariantParser;
        const xmlParserConfig = options.xmlParserConfig;
        if (Util.exists(xmlColumnVariantParser)) {
          Errors.checkArgumentValid(Util.isFunction(xmlColumnVariantParser),
            ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_XML_PARSER);

          GlobalConfig.setXmlColumnVariantParser(xmlColumnVariantParser);
        } else if (Util.exists(xmlParserConfig)) {
          GlobalConfig.createXmlColumnVariantParserWithParameters(xmlParserConfig);
        }

        const keepAlive = options.keepAlive;
        if (Util.exists(keepAlive)) {
          Errors.checkArgumentValid(Util.isBoolean(keepAlive),
            ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_KEEP_ALIVE);

          GlobalConfig.setKeepAlive(keepAlive);
        }

        const customCredentialManager = options.customCredentialManager;
        if (Util.exists(customCredentialManager)) {
          Errors.checkArgumentValid(Util.isObject(customCredentialManager),
            ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_CUSTOM_CREDENTIAL_MANAGER);

          GlobalConfig.setCustomCredentialManager(customCredentialManager);
        } 
      }
    };

  function extractLogLevel(options) {
    const logTag = options.logLevel;
    if (Util.exists(logTag)) {
      Errors.checkArgumentValid(LoggerCore.isValidLogTag(logTag),
        ErrorCodes.ERR_GLOBAL_CONFIGURE_INVALID_LOG_LEVEL);

      return LoggerCore.logTagToLevel(logTag);
    }
    return null;
  }

  // add some read-only constants
  const nativeTypeValues = DataTypes.NativeTypes.values;
  Object.defineProperties(instance,
    {
      STRING: { value: nativeTypeValues.STRING },
      BOOLEAN: { value: nativeTypeValues.BOOLEAN },
      NUMBER: { value: nativeTypeValues.NUMBER },
      DATE: { value: nativeTypeValues.DATE },
      JSON: { value: nativeTypeValues.JSON }
    });

  /**
  * Factory for Snowflake connections based on Generic Pool
  *
  * @param {Object} connectionOptions
  *
  * @returns {null}
  */
  function ConnectionFactory(connectionOptions) {
    /**
     * Creates a new connection instance.
     *
     * @returns {Object}
     */
    this.create = function () {
      const connection = new createConnection(connectionOptions);

      return new Promise((resolve, reject) => {
        connection.connect(
          function (err, conn) {
            if (err) {
              Logger.getInstance().error('Unable to connect: ' + err.message);
              reject(new Error(err.message));
            } else {
              resolve(conn);
            }
          }
        );
      });
    };

    /**
    * Destroys the specified connection instance.
    *
    * @param {Object} connection
    *
    * @returns {Object}
    */
    this.destroy = function (connection) {
      return new Promise((resolve) => {
        connection.destroy(function (err) {
          if (err) {
            Logger.getInstance().error('Unable to disconnect: ' + err.message);
          }
          resolve();
        });
      });
    };

    /**
    * Returns the status of the connection.
    *
    * @param {Object} connection
    *
    * @returns {Boolean}
    */
    this.validate = async function (connection) {
      return await connection.isValidAsync();
    };
  }

  /**
  * Creates a connection pool for Snowflake connections
  *
  * @param {Object} connectionOptions
  * @param {Object} poolOptions
  *
  * @returns {Object}
  */
  const createPool = function createPool(connectionOptions, poolOptions) {
    const connectionPool = GenericPool.createPool(
      new ConnectionFactory(connectionOptions),
      poolOptions
    );

    // avoid infinite loop if factory creation fails
    connectionPool.on('factoryCreateError', function (err) {
      const clientResourceRequest = connectionPool._waitingClientsQueue.dequeue();
      if (clientResourceRequest) {
        clientResourceRequest.reject(err);
      }
    });

    return connectionPool;
  };

  return instance;
}

module.exports = Core;
