/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { DataType } from "./statement";

declare enum RowMode {
    ARRAY = 'array',
    OBJECT = 'object',
    OBJECT_WITH_RENAMED_DUPLICATED_COLUMNS = 'object_with_renamed_duplicated_columns',
}

export interface ConnectionOptions {

    //Detail information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-options

    /**
     * Your account identifier.
     */
    account: string;

    /**
     * Specifies the name of the client application connecting to Snowflake.
     */
    application?: string;

    /**
     * @deprecated
     * The ID for the region where your account is located.
     */
    region?: string;

    /**
     * Host address to which the driver should connect.
     */
    host?: string;

    /**
     * Specifies a fully-qualified endpoint for connecting to Snowflake. 
     */
    accessUrl?: string;

    /**
     * The login name for your Snowflake user or your Identity Provider (e.g. your login name for Okta).
     */
    username?: string;

    /**
     * Password for the user.
     */
    password?: string;

    /**
     * Specifies the authenticator to use for verifying user login credentials.
     */
    authenticator?: string;

    /**
     * Specifies the hostname of an authenticated proxy server.
     */
    proxyHost?: string;

    /**
     * Specifies the password for the user specified by proxyUser.
     */
    proxyPort?: number;


    serviceName?: string;

    /**
     * Specifies the private key (in PEM format) for key pair authentication.
     */
    privateKey?: string;

    /**
     * Specifies the local path to the private key file (e.g. rsa_key.p8)
     */
    privateKeyPath?: string;

    /**
     * Specifies the passcode to decrypt the private key file, if the file is encrypted.
     */
    privateKeyPass?: string;

    /**
     * Specifies the OAuth token to use for authentication. Set this option if you set the authenticator option to OAUTH.
     */
    token?: string;

    /**
     * The default virtual warehouse to use for the session after connecting. Used for performing queries, loading data, etc.
     */
    warehouse?: string;

    /**
     * The default database to use for the session after connecting.
     */
    database?: string;

    /**
     * The default schema to use for the session after connecting.
     */
    schema?: string;

    /**
     * The default security role to use for the session after connecting.
     */
    role?: string;

    /**
     * Specifies how to return results that contain duplicate column names.
     */
    rowMode?: RowMode;

    /**
     * Enabling this parameter causes the method to return a Node.js Readable stream, which you can use to consume rows as they are received. 
     */
    streamResult?: boolean;

    /**
     * return the following data types as strings: Boolean, Number, Date, Buffer, and JSON.
     */
    fetchAsString?: DataType[] | undefined;

    /**
     * By default, client connections typically time out approximately 3-4 hours after the most recent query was executed.
     */
    clientSessionKeepAlive?: boolean;

    /**
     * Sets the frequency (interval in seconds) between heartbeat messages.
     */
    clientSessionKeepAliveHeartbeatFrequency?: number;

    /**
     * To convert Snowflake INTEGER columns to JavaScript Bigint, which can store larger values than JavaScript Number
     */
    jsTreatIntegerAsBigInt?: boolean;

    /**
     * Sets the maximum number of binds the driver uses in a bulk insert operation. The default value is 100000 (100K).
     */
    arrayBindingThreshold?: number;

    /**
     * Validate default options set by users.
     */
    validateDefaultParameters?: boolean;

    /**
    * 
    */
    forceStageBindError?: number;

    /**
     * Set whether the retry reason is included or not in the retry url.
     */
    includeRetryReason?: boolean;

    /**
     * The option to disable the query context cache feature. The default value is false.
     */
    disableQueryContextCache?: boolean;

    /**
     * The max login timeout value. This value is either 0 or over 300.
     */
    retryTimeout?: number;
}