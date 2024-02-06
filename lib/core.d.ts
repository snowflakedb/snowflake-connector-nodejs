/*
 * Copyright (c 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { Options as PoolOptions, Pool } from "generic-pool";
import Connection from "./connection/connection";
import { ConnectionOptions } from "./connection/connection_config";

export const STRING = "STRING";
export const BOOLEAN = "BOOLEAN";
export const NUMBER = "NUMBER";
export const DATE = "DATE";
export const JSON = "JSON";

export enum ocspModes {
    FAIL_CLOSED = "FAIL_CLOSED",
    FAIL_OPEN = "FAIL_OPEN",
    INSECURE = "INSECURE",
}

export interface ConfigureOptions {
    logLevel?: "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE" | undefined;
    insecureConnect?: boolean | undefined;
    ocspFailOpen?: boolean | undefined;
}


interface CoreInstance {
    ocspModes: ocspModes;
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
