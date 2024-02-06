import core from "./core";
import { NodeHttpClient } from './http/node'
import { driverName, driverVersion } from './util';

const coreInstance = core(
    {
        httpClientClass: NodeHttpClient,
        loggerClass: require('./logger/node'),
        client:
        {
            version: Util.driverVersion,
            name: driverName,
            environment: driverVersion,
        }
    }
);

export default coreInstance;
