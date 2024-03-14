/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { SnowflakeError } from "../errors";
import { RowStatement, FileAndStageBindStatement, StatemnentOption } from "./statement";

declare enum QueryStatus {
    RUNNING = 'RUNNING',
    ABORTING = 'ABORTING',
    SUCCESS = 'SUCCESS',
    FAILED_WITH_ERROR = 'FAILED_WITH_ERROR',
    ABORTED = 'ABORTED',
    QUEUED = 'QUEUED',
    FAILED_WITH_INCIDENT = 'FAILED_WITH_INCIDENT',
    DISCONNECTED = 'DISCONNECTED',
    RESUMING_WAREHOUSE = 'RESUMING_WAREHOUSE',
    QUEUED_REPARING_WAREHOUSE = 'QUEUED_REPARING_WAREHOUSE',
    RESTARTED = 'RESTARTED',
    BLOCKED = 'BLOCKED',
    NO_DATA = 'NO_DATA',
}

type ConnectionCallback = (err: SnowflakeError | undefined, conn: Connection) => void

export type Connection = NodeJS.EventEmitter & {
    /**
     * Returns true if the connection is active otherwise false.
     */
    isUp(): boolean;

    /**
     * Returns true if the session token and master token are valid.
     */
    isTokenValid(): boolean;

    /**
     * Returns the connection id.
     */
    getId(): string;

    /**
     * Returns true if the connection is good to send a query otherwise false.
     */
    isValidAsync(): Promise<boolean>;

    /**
     * Set the private link as the OCSP cache server's URL.
     *
     */
    setupOcspPrivateLink(host: string): void;

    /**
     * Establishes a connection if not in a fatal state.
     *
     */
    connect(callback: ConnectionCallback): void;

    /**
     * Establishes a connection if not in a fatal state.
     *
     * If you do not set the authenticator option to `EXTERNALBROWSER` (in order to use browser-based SSO) or
     * `https://<okta_account_name>.okta.com` (in order to use native SSO through Okta), call the {@link connect}
     * method.
     */
    connectAsync(callback: ConnectionCallback): Promise<void>;

    /**
     * Executes a statement.
     */
    execute(options: StatemnentOption): RowStatement | FileAndStageBindStatement;

    /**
     * Fetches the result of a previously issued statement.
     */
    fetchResult(options: StatemnentOption): RowStatement | FileAndStageBindStatement;

    /**
     * Immediately terminates the connection without waiting for currently executing statements to complete.
     */
    destroy(fn: ConnectionCallback): void;

    /**                          
     * Gets the status of the query based on queryId.
     */
    getQueryStatus(queryId: string): string;

    /**
     * Gets the status of the query based on queryId and throws if there's an error.
     */
    getQueryStatusThrowIfError(queryId: string): string;

    /**
     *  Gets the results from a previously ran query based on queryId.
     */
    getResultsFromQueryId(options: StatemnentOption): RowStatement | FileAndStageBindStatement;

    /**
     * Checks whether the given status is currently running.
     */
    isStillRunning(status: QueryStatus): boolean;

    /**
     * Checks whether the given status means that there has been an error.
     */
    isAnError(): boolean;

    /**
     * Returns a serialized version of this connection.
     */
    serialize(): string;
};

export default Connection;