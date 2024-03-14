/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { Readable } from 'stream';
import { SnowflakeError } from '../errors';
import Column from './result/column';

type Bind = string | number;
type InsertBinds = Bind[][];
type Binds = Bind[] | InsertBinds;
type StatementCallback = (err: SnowflakeError | undefined, stmt: RowStatement | FileAndStageBindStatement, rows: any[] | undefined) => void;

export enum DataType {
    String = 'String',
    Boolean = 'Boolean',
    Number = 'Number',
    Date = 'Date',
    JSON = 'JSON',
    Buffer = 'Buffer',
}

interface StreamOptions {
    start?: number;
    end?: number;
    fetchAsString?: DataType[] | undefined;
}

export interface StatemnentOption {
    sqlText: string;
    complete: StatementCallback,
    requestId?: string;
    queryId?: string;
    streamResult?: boolean;
    binds?: Binds;
    fetchAsString?: DataType[];
    parameters?: Record<string, unknown>;
}

declare enum StatementStatus {
    Fetching = "fetching",
    Complete = "complete",
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
     * Given a column identifier, returns the corresponding column. The column
     * identifier can be either the column name (String) or the column index
     * (Number). If a column is specified and there is more than one column with
     * that name, the first column with the specified name will be returned.
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
     * Returns an object that contains information about the values of the
     * current warehouse, current database, etc., when this statement finished
     * executing.
     */
    getSessionState(): object | undefined;

    /**
     * Returns the request id that was used when the statement was issued.
     */
    getRequestId(): string;

    /**
  * Returns the query id generated by the server for this statement.
  * If the statement is still executing and we don't know the query id
  * yet, this method will return undefined.
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