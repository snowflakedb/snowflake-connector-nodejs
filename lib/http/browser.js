const Util = require('../util');
const request = require('browser-request');
const { HttpClient } = require('./base');
const Logger = require('../logger');

/**
 * Creates a client that can be used to make requests in the browser.
 *
 * @param {ConnectionConfig} connectionConfig
 * @constructor
 */
function BrowserHttpClient(connectionConfig) {
  Logger.getInstance().trace('Initializing BrowserHttpClient with Connection Config[%s]',
    connectionConfig.describeIdentityAttributes());
  HttpClient.apply(this, [connectionConfig]);
}

Util.inherits(BrowserHttpClient, HttpClient);

/**
 * @inheritDoc
 */
BrowserHttpClient.prototype.getRequestModule = function () {
  return request;
};

module.exports = BrowserHttpClient;