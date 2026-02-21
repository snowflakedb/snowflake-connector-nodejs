import core from './core';
import * as Util from './util';

export default core({
  httpClientClass: require('./http/node').NodeHttpClient,
  loggerClass: require('./logger/node'),
  client: {
    version: Util.driverVersion,
    name: Util.driverName,
    environment: process.versions,
  },
});
