/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('../util');
var request = require('browser-request');
var Base = require('./base');

/**
 * Creates a client that can be used to make requests in the browser.
 *
 * @param {ConnectionConfig} connectionConfig
 * @constructor
 */
function BrowserHttpClient(connectionConfig)
{
  Base.apply(this, arguments);
}

Util.inherits(BrowserHttpClient, Base);

/**
 * @inheritDoc
 */
BrowserHttpClient.prototype.getRequestModule = function ()
{
  return request;
};

module.exports = BrowserHttpClient;