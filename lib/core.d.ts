/*
 * Copyright (c 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { Options as PoolOptions, Pool } from "generic-pool";
import Connection from "./connection/connection";
import { ConnectionOptions } from "./connection/connection_config";

declare enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    TRACE = 'TRACE',
}

export type CustomParser = (rawColumnValue: string) => any;

export enum OcspModes {
    FAIL_CLOSED = 'FAIL_CLOSED',
    FAIL_OPEN = 'FAIL_OPEN',
    INSECURE = 'INSECURE',
}

interface ConfigureOptions {
    /**
     * Set the logLevel and logFilePath, 
     * https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-logs.
     */
    logLevel?: LogLevel | undefined;
    logFilePath?: string | undefined;

    /**
     * Check the ocsp checking is off.
     */
    insecureConnect?: boolean | undefined;

    /**
     * The default value is true. 
     * Detailed infor.ation: https://docs.snowflake.com/en/user-guide/ocsp.
     */
    ocspFailOpen?: boolean | undefined;

    /**
     * The Snowflake Node.js driver provides the following default parsers for processing JSON and XML data in result sets.
     * Detailed information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-consume.
     */
    jsonColumnVariantParser?: CustomParser;
    xmlColumnVariantParser?: CustomParser;

    /**
     * Specifies whether to enable keep-alive functionality on the socket immediately after receiving a new connection request.
     */
    keepAlive?: boolean,
}

export interface CoreInstance {
    /**
     * Online Certificate Status Protocol (OCSP), detailed information: https://docs.snowflake.com/en/user-guide/ocsp.
     */
    ocspModes: OcspModes;

    /**
     * Creates a connection object that can be used to communicate with Snowflake.
     */
    createConnection(options: ConnectionOptions): Connection;

    /**
     * Deserializes a serialized connection.
     */
    deserializeConnection(options: ConnectionOptions, serializedConnection: string): Connection;

    /**
     * Serializes a given connection.
     */
    serializeConnection(connection: Connection): string;

    /**
     * Configures this instance of the Snowflake core module.
     */
    configure(options?: ConfigureOptions): void;

    /**
     * Creates a connection pool for Snowflake connections.
     */
    createPool(options: ConnectionOptions, poolOptions?: PoolOptions): Pool<Connection>;
}

export default function Core(options: JSON): CoreInstance;
