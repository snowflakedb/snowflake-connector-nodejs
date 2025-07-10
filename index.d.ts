import { WIP_ConnectionOptions } from './lib/connection/types';
import ErrorCodeEnum from './lib/error_code';

/**
 * The snowflake-sdk module provides an instance to connect to the Snowflake server
 * @see [source] {@link https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver}
 */
declare module 'snowflake-sdk' {
  export type CustomParser = (rawColumnValue: string) => any;
  export type Bind = string | number;
  export type InsertBinds = Bind[][];
  export type Binds = Bind[] | InsertBinds;
  export type StatementCallback = (
    err: SnowflakeError | undefined,
    stmt: RowStatement | FileAndStageBindStatement,
    rows?: Array<any> | undefined,
  ) => void;
  export type ConnectionCallback = (err: SnowflakeError | undefined, conn: Connection) => void;
  export type RowMode = 'object' | 'array' | 'object_with_renamed_duplicated_columns';
  export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'OFF';
  export type DataType = 'String' | 'Boolean' | 'Number' | 'Date' | 'JSON' | 'Buffer';
  export type QueryStatus =
    | 'RUNNING'
    | 'ABORTING'
    | 'SUCCESS'
    | 'FAILED_WITH_ERROR'
    | 'ABORTED'
    | 'QUEUED'
    | 'FAILED_WITH_INCIDENT'
    | 'DISCONNECTED'
    | 'RESUMING_WAREHOUSE'
    | 'QUEUED_REPARING_WAREHOUSE'
    | 'RESTARTED'
    | 'BLOCKED'
    | 'NO_DATA';
  export type StatementStatus = 'fetching' | 'complete';

  type PoolOptions = import('generic-pool').Options;
  type Readable = import('stream').Readable;
  type Pool<T> = import('generic-pool').Pool<T>;

  export interface XMlParserConfigOption {
    ignoreAttributes?: boolean;
    alwaysCreateTextNode?: boolean;
    attributeNamePrefix?: string;
    attributesGroupName?: false | null | string;
  }

  export interface ConfigureOptions {
    /**
     * Set the logLevel and logFilePath,
     * https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-logs.
     */
    logLevel?: LogLevel;
    logFilePath?: string;

    /**
     * additionalLogToConsole is a Boolean value that indicates whether to send log messages also to the console when a filePath is specified.
     */
    additionalLogToConsole?: boolean | null;

    /**
     * The option to turn off the OCSP check.
     */
    disableOCSPChecks?: boolean;

    /**
     * The default value is true.
     * Detailed information: https://docs.snowflake.com/en/user-guide/ocsp.
     */
    ocspFailOpen?: boolean;

    /**
     * The Snowflake Node.js driver provides the following default parsers for processing JSON and XML data in result sets.
     * Detailed information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-consume.
     */
    jsonColumnVariantParser?: CustomParser;
    xmlColumnVariantParser?: CustomParser;

    xmlParserConfig?: XMlParserConfigOption;

    /**
     * Specifies whether to enable keep-alive functionality on the socket immediately after receiving a new connection request.
     */
    keepAlive?: boolean;

    /**
     * If the user wants to use their own credential manager for SSO or MFA token caching,
     * pass the custom credential manager to this option.
     */
    customCredentialManager?: object;

    /**
     * The option whether the driver loads the proxy information from the environment variable or not
     * The default value is true. If false, the driver will not get the proxy from the environment variable.
     */
    useEnvProxy?: boolean;
  }

  export type ConnectionOptions = WIP_ConnectionOptions & {
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
     * Append a region or any sub domains before snowflakecomputing.com to the
     * end of account parameter after a dot, e.g., account=<account>.<region>.
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
     * Specifies the timeout, in milliseconds, for browser activities related to SSO authentication. The default value is 120000 (milliseconds).
     */
    browserActionTimeout?: number;

    /**
     * Customize implementation for opening the browser window used for SSO authentication. By default, the npm `open` package is used.
     */
    openExternalBrowserCallback?: (url: string) => void;

    /**
     * Specifies the lists of hosts that the driver should connect to directly, bypassing the proxy server (e.g. *.amazonaws.com to bypass Amazon S3 access). For multiple hosts, separate the hostnames with a pipe symbol (|).
     * You can also use an asterisk as a wild card. For example: noProxy: "*.amazonaws.com|*.my_company.com"
     */
    noProxy?: string;

    /**
     * Specifies the hostname of an authenticated proxy server.
     */
    proxyHost?: string;

    /**
     * Specifies the username used to connect to an authenticated proxy server.
     */
    proxyUser?: string;

    /**
     * Specifies the password for the user specified by proxyUser.
     */
    proxyPassword?: string;

    /**
     * Specifies the port of an authenticated proxy server.
     */
    proxyPort?: number;

    /**
     * Specifies the protocol used to connect to the authenticated proxy server. Use this property to specify the HTTP protocol: http or https.
     */
    proxyProtocol?: string;

    /**
     * Specifies whether the OCSP request is also sent to the proxy specified.
     */
    useConnectionConfigProxyForOCSP?: boolean;

    /**
     * Specifies the serviceName.
     */
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
     * Number of milliseconds to keep the connection alive with no response. Default: 90000 (1 minute 30 seconds).
     */
    timeout?: number;

    /**
     * The default security role to use for the session after connecting.
     */
    role?: string;

    /**
     * Returns the rowMode string value ('array', 'object' or 'object_with_renamed_duplicated_columns'). Could be null or undefined.
     */
    rowMode?: RowMode;

    /**
     * Enabling this parameter causes the method to return a Node.js Readable stream, which you can use to consume rows as they are received.
     */
    streamResult?: boolean;

    /**
     * return the following data types as strings: Boolean, Number, Date, Buffer, and JSON.
     */
    fetchAsString?: DataType[];

    /**
     * Path to the client configuration file associated with the easy logging feature.
     */
    clientConfigFile?: string;

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
     * The max login timeout value. This value is either 0 or over 300.
     */
    retryTimeout?: number;

    /**
     * The option to skip the SAML URL check in the Okta authentication
     */
    disableSamlUrlCheck?: boolean;

    /**
     * The option to fetch all the null values in the columns as the string null.
     */
    representNullAsStringNull?: boolean;

    /**
     * Number of threads for clients to use to prefetch large result sets. Valid values: 1-10.
     */
    resultPrefetch?: number;

    /**
     * Set whether the retry reason is included or not in the retry url.
     */
    includeRetryReason?: boolean;

    /**
     * Number of retries for the login request.
     */
    sfRetryMaxLoginRetries?: number;

    /**
     * The option to throw an error on the bind stage if this is enabled.
     */
    forceStageBindError?: number;

    /**
     * The option to disable the query context cache.
     */
    disableQueryContextCache?: boolean;

    /**
     * The option to disable GCS_USE_DOWNSCOPED_CREDENTIAL session parameter
     */
    gcsUseDownscopedCredential?: boolean;

    /**
     * The option to use https request only for the snowflake server if other GCP metadata or configuration is already set on the machine.
     * The default value is false.
     */
    forceGCPUseDownscopedCredential?: boolean;

    /**
     * The option to disable the web authentication console login.
     */
    disableConsoleLogin?: boolean;

    /**
     *  Turn on the validation function which checks whether all the connection configuration from users are valid or not.
     */
    validateDefaultParameters?: boolean;

    /**
     *  The option to set the location where the token will be saved for the token authentication (MFA and SSO).
     *  The path must include the folder path only.
     */
    credentialCacheDir?: string;

    /**
     * The option to enable the MFA token. The default value is false.
     */
    clientRequestMFAToken?: boolean;

    /**
     *  The option to include the passcode from DUO into the password.
     */
    passcodeInPassword?: boolean;

    /**
     *  The option to pass passcode from DUO.
     */
    passcode?: string;
  };

  export interface Connection {
    /**
     * Returns true if the connection is active otherwise false.
     */
    isUp(): boolean;

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
     */
    setupOcspPrivateLink(host: string): void;

    /**
     * Establishes a connection if not in a fatal state.
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
    execute(options: StatementOption): RowStatement | FileAndStageBindStatement;

    /**
     * Fetches the result of a previously issued statement.
     */
    fetchResult(options: StatementOption): RowStatement | FileAndStageBindStatement;

    /**
     * Immediately terminates the connection without waiting for currently executing statements to complete.
     */
    destroy(fn: ConnectionCallback): void;

    /**
     * Gets the status of the query based on queryId.
     */
    getQueryStatus(queryId: string): Promise<string>;

    /**
     * Gets the status of the query based on queryId and throws if there's an error.
     */
    getQueryStatusThrowIfError(queryId: string): Promise<string>;

    /**
     *  Gets the results from a previously ran query based on queryId.
     */
    getResultsFromQueryId(
      options: StatementOption,
    ): Promise<RowStatement | FileAndStageBindStatement>;

    /**
     * Returns the value of the SERVICE_NAME parameter
     */
    getServiceName(): string;

    /**
     * Checks whether the given status is currently running.
     */
    isStillRunning(status: QueryStatus): boolean;

    /**
     * Checks whether the given status means that there has been an error.
     */
    isAnError(): boolean;

    /*
     * Returns a serialized version of this connection.
     */
    serialize(): string;
  }

  export interface StatementOption {
    sqlText: string;
    complete?: StatementCallback;

    /**
     * Enable asynchronous queries by including asyncExec: true in the connection.execute method.
     */
    asyncExec?: boolean;

    /**
     * The requestId is for resubmitting requests.
     * Detailed Information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-execute.
     */
    requestId?: string;

    /**
     * The request GUID is a unique identifier of an HTTP request issued to Snowflake.
     * Unlike the requestId, it is regenerated even when the request is resend with the retry mechanism.
     * If not specified, request GUIDs are attached to all requests to Snowflake for better traceability.
     * In the majority of cases it should not be set or filled with false value.
     */
    excludeGuid?: string;

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
     * The fetchAsString option is to return the following data types as strings: Boolean, Number, Date, Buffer, and JSON.
     * Detailed information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-consume.
     */
    fetchAsString?: DataType[];

    /**
     * Detailed information: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-execute.
     */
    parameters?: Record<string, any>;

    /**
     * Returns the rowMode string value ('array', 'object' or 'object_with_renamed_duplicated_columns'). Could be null or undefined.
     */
    rowMode?: RowMode;

    /**
     * Current working directory to use for GET/PUT execution using relative paths from a client location
     * that is different from the connector directory.
     */
    cwd?: string;

    /**
     * `true` to enable a describe only query.
     */
    describeOnly?: boolean;
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
     * If the statement is still executing, and we don't know the query id yet,
     * this method will return undefined.
     * Should use getQueryId instead.
     * @deprecated
     * @returns {String}
     */
    getStatementId(): string;

    /**
     * Returns the query id generated by the server for this statement.
     * If the statement is still executing, and we don't know the query id
     * yet, this method will return undefined.
     */
    getQueryId(): string;

    /**
     *  Cancels this statement if possible.
     */
    cancel(callback?: StatementCallback): void;

    /**
     * Streams the rows in this statement's result. If start and end values are
     * specified, only rows in the specified range are streamed.
     */
    streamRows(options?: StreamOptions): Readable;

    /**
     * Fetches the rows in this statement's result and invokes each()
     * callback on each row. If start and end values are specified each()
     * callback will only be invoked on rows in the specified range.
     */
    fetchRows(options?: StreamOptions): Readable;
  }

  export interface Column {
    /**
     * Returns the name of this column.
     */
    getName(): string;

    /**
     * Returns the index of this column.
     */
    getIndex(): number;

    /**
     * Returns the id of this column.
     */
    getId(): number;

    /**
     * Determines if this column is nullable.
     */
    isNullable(): boolean;

    /**
     * Returns the scale associated with this column.
     */
    getScale(): number;

    /**
     * Returns the type associated with this column.
     */
    getType(): string;

    /**
     * Returns the precision associated with this column
     */
    getPrecision(): number;

    /**
     * Returns true if this column is type STRING.
     */
    isString(): boolean;

    /**
     * Returns true if this column is type BINARY.
     */
    isBinary(): boolean;

    /**
     * Returns true if this column is type NUMBER.
     */
    isNumber(): boolean;

    /**
     * Returns true if this column is type BOOLEAN.
     */
    isBoolean(): boolean;

    /**
     * Returns true if this column is type DATE.
     */
    isDate(): boolean;

    /**
     * Returns true if this column is type TIME.
     */
    isTime(): boolean;

    /**
     * Returns true if this column is type TIMESTAMP.
     */
    isTimestamp(): boolean;

    /**
     * Returns true if this column is type TIMESTAMP_LTZ.
     */
    isTimestampLtz(): boolean;

    /**
     * Returns true if this column is type TIMESTAMP_NTZ.
     */
    isTimestampNtz(): boolean;

    /**
     * Returns true if this column is type TIMESTAMP_TZ.
     */
    isTimestampTz(): boolean;

    /**
     * Returns true if this column is type VARIANT.
     */
    isVariant(): boolean;

    /**
     * Returns true if this column is type OBJECT.
     */
    isObject(): boolean;

    /**
     * Returns true if this column is type ARRAY.
     */
    isArray(): boolean;

    /**
     * Returns true if this column is type MAP.
     */
    isMap(): boolean;

    /**
     * Returns the value of this column in a row.
     */
    getRowValue(row: object): any;

    /**
     * Returns the value of this in a row as a String.
     */
    getRowValueAsString(row: object): string;
  }

  export interface OcspModes {
    FAIL_CLOSED: string;
    FAIL_OPEN: string;
    INSECURE: string;
  }

  export interface FileAndStageBindStatement extends RowStatement {
    hasNext: () => boolean;
    NextResult: () => void;
  }

  export interface SnowflakeErrorExternal extends Error {
    name: any;
    message: any;
    code?: any;
    sqlState?: any;
    data?: any;
    response?: any;
    responseBody?: any;
    cause?: any;
    isFatal?: any;
    stack?: any;
  }

  export interface SnowflakeError extends Error {
    code?: ErrorCodeEnum;
    sqlState?: string;
    data?: Record<string, any>;
    response?: Record<string, any>;
    responseBody?: string;
    cause?: Error;
    isFatal?: boolean;
    externalize?: () => SnowflakeErrorExternal | undefined;
  }

  export interface StreamOptions {
    start?: number;
    end?: number;
    fetchAsString?: DataType[];
  }

  export const ErrorCode: typeof ErrorCodeEnum;

  /**
   * Online Certificate Status Protocol (OCSP), detailed information: https://docs.snowflake.com/en/user-guide/ocsp.
   */
  export const ocspModes: OcspModes;

  /**
   * Creates a connection object that can be used to communicate with Snowflake.
   */
  export function createConnection(options: ConnectionOptions): Connection;

  /**
   * Deserializes a serialized connection.
   */
  export function deserializeConnection(
    options: ConnectionOptions,
    serializedConnection: string,
  ): Connection;

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
  export function createPool(
    options: ConnectionOptions,
    poolOptions?: PoolOptions,
  ): Pool<Connection>;
}
