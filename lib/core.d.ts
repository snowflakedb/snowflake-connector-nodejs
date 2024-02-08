/*
 * Copyright (c 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { Options as PoolOptions, Pool } from "generic-pool";
import Connection from "./connection/connection";
import { ConnectionOptions } from "./connection/connection_config";

enum OcspModes {
    FAIL_CLOSED = "FAIL_CLOSED",
    FAIL_OPEN = "FAIL_OPEN",
    INSECURE = "INSECURE",
}

enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    TRACE = 'TRACE',
}

type CustomParser = (rawColumnValue: string) => any;

interface ConfigureOptions {
    logLevel?: LogLevel | undefined;
    logFilePath?: string | undefined;
    insecureConnect?: boolean | undefined;
    ocspFailOpen?: boolean | undefined;
    jsonColumnVariantParser?: CustomParser;
    xmlColumnVariantParser?: CustomParser;
    keepAlive?: boolean,
}

export interface CoreInstance {
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

    readonly STRING: string;
    readonly BOOLEAN: string;
    readonly NUMBER: string;
    readonly DATE: string;
    readonly JSON: string;

}

export default function Core(options: JSON): CoreInstance;
