import { SnowflakeError } from "../errors";
import { BaseStatement } from "./statement";

export type Bind = string | number;
export type Binds = Bind[] | InsertBinds;
export type InsertBinds = Bind[][];

interface SQLOption {
    sqlText: string;
    streamResult?: boolean | undefined;
    binds?: Binds | undefined;
    fetchAsString?: Array<"String" | "Boolean" | "Number" | "Date" | "JSON" | "Buffer"> | undefined;
    complete?: (err: SnowflakeError | undefined, stmt: BaseStatement, rows: any[] | undefined) => void;
    parameters?: Record<string, unknown>;
}

export type Connection = NodeJS.EventEmitter & {
    /**
     * Make session tokens available for testing
     */
    getTokens(): unknown;

    /**
     * Returns true if the connection is active otherwise false
     */
    isUp(): boolean;

    isTokenValid(): boolean;
    getServiceName(): string;
    getClientSessionKeepAlive(): boolean;
    getClientSessionKeepAliveHeartbeatFrequency(): number;
    getJsTreatIntegerAsBigInt(): boolean;

    /**
     * Returns the connection id.
     */
    getId(): string;
    heartbeat(): void;
    heartbeatAsync(): Promise<Array>;

    /**
     * Returns true if the connection is good to send a query otherwise false
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
    connect(callback: (err: SnowflakeError | undefined, conn: Connection) => void): void;

    /**
     * Establishes a connection if not in a fatal state.
     *
     * If you do not set the authenticator option to `EXTERNALBROWSER` (in order to use browser-based SSO) or
     * `https://<okta_account_name>.okta.com` (in order to use native SSO through Okta), call the {@link connect}
     * method.
     */
    connectAsync(callback: (err: SnowflakeError | undefined, conn: Connection) => void): Promise<void>;

    execute(options: SQLOption): BaseStatement;

    /**
     * Fetches the result of a previously issued statement.
     */
    fetchResult(): any;

    /**
     * Immediately terminates the connection without waiting for
     * currently executing statements to complete.
     */
    destroy(fn: (err: SnowflakeError | undefined, conn: Connection) => void): void;

    /**
     * Returns a serialized version of this connection.
     */
    serialize(): string;
};

export default Connection;