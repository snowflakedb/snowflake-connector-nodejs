const core = require('./core');
import * as Util from './util';

module.exports = core({
  httpClientClass: require('./http/node').NodeHttpClient,
  loggerClass: require('./logger/node'),
  client: {
    version: Util.driverVersion,
    name: Util.driverName,
    environment: process.versions,
  },
});
