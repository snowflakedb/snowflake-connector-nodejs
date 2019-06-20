/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('../util');
var Errors = require('../errors');
var SfService = require('../services/sf');
var LargeResultSetService = require('../services/large_result_set');

/**
 * Creates a new ConnectionContext.
 *
 * @param {ConnectionConfig} connectionConfig
 * @param {Object} httpClient
 * @param {Object} config
 *
 * @constructor
 */
function ConnectionContext(connectionConfig, httpClient, config)
{
  // validate input
  Errors.assertInternal(Util.isObject(connectionConfig));
  Errors.assertInternal(Util.isObject(httpClient));

  // if a config object was specified, verify
  // that it has all the information we need
  var sfServiceConfig;
  if (Util.exists(config))
  {
    Errors.assertInternal(Util.isObject(config));
    Errors.assertInternal(Util.isObject(config.services));
    Errors.assertInternal(Util.isObject(config.services.sf));

    sfServiceConfig = config.services.sf;
  }

  // create a map that contains all the services we'll be using
  var services =
    {
      sf: new SfService(connectionConfig, httpClient, sfServiceConfig),
      largeResultSet: new LargeResultSetService(connectionConfig, httpClient)
    };

  /**
   * Returns the ConnectionConfig for use by the connection.
   *
   * @returns {ConnectionConfig}
   */
  this.getConnectionConfig = function ()
  {
    return connectionConfig;
  };

  /**
   * Returns a map that contains all the available services.
   *
   * @returns {Object}
   */
  this.getServices = function ()
  {
    return services;
  };

  /**
   * Returns a configuration object that can be passed as an optional argument
   * to the ConnectionContext constructor to create a new object that has the
   * same state as this ConnectionContext instance.
   *
   * @returns {Object}
   */
  this.getConfig = function ()
  {
    return {
      services:
        {
          sf: services.sf.getConfig()
        }
    };
  };
}

module.exports = ConnectionContext;