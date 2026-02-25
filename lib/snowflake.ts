import core from './core';
import * as Util from './util';
import { NodeHttpClient } from './http/node';
import NodeLogger from './logger/node';

export default core({
  httpClientClass: NodeHttpClient,
  loggerClass: NodeLogger,
  client: {
    version: Util.driverVersion,
    name: Util.driverName,
    environment: process.versions,
  },
});
