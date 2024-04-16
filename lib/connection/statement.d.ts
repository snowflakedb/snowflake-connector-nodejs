/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { Readable } from 'stream';

export enum DataType {
    String = 'String',
    Boolean = 'Boolean',
    Number = 'Number',
    Date = 'Date',
    JSON = 'JSON',
    Buffer = 'Buffer',
}

export enum StatementStatus {
    Fetching = "fetching",
    Complete = "complete",
}

declare module 'snowflake-sdk' {
    type Bind = string | number;
    type InsertBinds = Bind[][];
    type Binds = Bind[] | InsertBinds;
    type StatementCallback = (err: SnowflakeError | undefined, stmt: RowStatement | FileAndStageBindStatement, rows: any[] | undefined) => void;

    interface StreamOptions {
        start?: number;
        end?: number;
        fetchAsString?: DataType[] | undefined;
    }

    export interface StatemnentOption {
        sqlText: string;
        complete: StatementCallback,

        /**
         * The requestId is for resubmitting requests.
         * Detailed Information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-execute.
         */
        requestId?: string;

        /**
         * Use different rest endpoints based on whether the query id is available.
         */
        queryId?: string;

        /**
         * You can also consume a result as a stream of rows by setting the streamResult connection parameter to true in connection.execute 
         * when calling the statement.streamRows() method.
         * Detailed Information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-consume.
         */
        streamResult?: boolean;

        /**
         * Find information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-execute.
         */
        binds?: Binds;

        /**
         * Thje fetchAsString option is to return the following data types as strings: Boolean, Number, Date, Buffer, and JSON.
         * Detailed information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-consume.
         */
        fetchAsString?: DataType[];

        /**
         * Detailed information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-execute.
         */
        parameters?: Record<string, any>;
    }

    export interface RowStatement {
        /**
         * Returns this statement's SQL text.
         */
        getSqlText(): string;

        /**
         * Returns the current status of this statement.
         */
        getStatus(): StatementStatus;

        /**
         * Returns the columns produced by this statement.
         */
        getColumns(): Column[];

        /**
         * Given a column identifier, returns the corresponding column. 
         * The column identifier can be either the column name (String) or the column index(Number). 
         * If a column is specified and there is more than one column with that name, 
         * the first column with the specified name will be returned.
         */
        getColumn(columnIdentifier: string | number): Column;

        /**
         * Returns the number of rows returned by this statement.
         */
        getNumRows(): number;

        /**
         * Returns the number of rows updated by this statement.
         *
         */
        getNumUpdatedRows(): number | undefined;

        /**
         * Returns an object that contains information about the values of 
         * the current warehouse, current database, etc., 
         * when this statement finished executing.
         */
        getSessionState(): object | undefined;

        /**
         * Returns the request id that was used when the statement was issued.
         */
        getRequestId(): string;

        /**
         * Returns the query id generated by the server for this statement. 
         * If the statement is still executing and we don't know the query id yet, 
         * this method will return undefined.
         *
         * Should use getQueryId instead.
         * @deprecated 
         * @returns {String}
         */
        getStatementId(): string

        /**
         * Returns the query id generated by the server for this statement.
         * If the statement is still executing and we don't know the query id
         * yet, this method will return undefined.
         *
         */
        getQueryId(): string;

        /**
         * Streams the rows in this statement's result. If start and end values are
         * specified, only rows in the specified range are streamed.
         *
         * @param {Object} options
         */
        streamRows(options?: StreamOptions): Readable;

        /**
         * Fetches the rows in this statement's result and invokes the each()
         * callback on each row. If start and end values are specified, the each()
         * callback will only be invoked on rows in the specified range.
         * 
         * @param {Object} options
         */
        fetchRows(options?: StreamOptions): Readable;
    }

    export interface FileAndStageBindStatement extends RowStatement {
        hasNext(): () => boolean;
        NextResult(): () => void;
    }
}