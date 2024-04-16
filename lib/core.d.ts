/*
 * Copyright (c 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

export enum OcspModes {
    FAIL_CLOSED = 'FAIL_CLOSED',
    FAIL_OPEN = 'FAIL_OPEN',
    INSECURE = 'INSECURE',
}

declare enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    TRACE = 'TRACE',
}
declare module 'snowflake-sdk' {

    export type CustomParser = (rawColumnValue: string) => any;



    export interface ConfigureOptions {
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
}
