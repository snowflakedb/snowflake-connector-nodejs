/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { OcspModes } from "./lib/core";

/**
 * The snowflake-sdk module provides an instance to connect to the Snowflake server
 * @see [source](https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver)
 */
declare module 'snowflake-sdk' {

    /**
     * Online Certificate Status Protocol (OCSP), detailed information: https://docs.snowflake.com/en/user-guide/ocsp.
     */
    declare let ocspModes: OcspModes;

    /**
     * Creates a connection object that can be used to communicate with Snowflake.
     */
    export function createConnection(options: ConnectionOptions): Connection;

    /**
     * Deserializes a serialized connection.
     */
    export function deserializeConnection(options: ConnectionOptions, serializedConnection: string): Connection;

    /**
     * Serializes a given connection.
     */
    export function serializeConnection(connection: Connection): string;

    /**
     * Configures this instance of the Snowflake core module.
     */
    export function configure(options?: ConfigureOptions): void;

    /**
     * Creates a connection pool for Snowflake connections.
     */
    export function createPool(options: ConnectionOptions, poolOptions?: PoolOptions): Pool<Connection>;
}

