export interface ConnectionOptions {
    account: string;
    application: string;
    /**
     * @deprecated
     */
    region?: string;
    host?: string;
    accessUrl?: string;
    username?: string;
    password?: string;
    authenticator?: string;
    proxyHost?: string;
    proxyPort?: number;
    serviceName?: string;
    privateKey?: string;
    privateKeyPath?: string;
    privateKeyPass?: string;
    token?: string;
    warehouse?: string;
    database?: string;
    schema?: string;
    role?: string;
    rowMode?: string;
    streamResult?: boolean;
    fetchAsString?: Array;
    clientSessionKeepAlive?: boolean;
    clientSessionKeepAliveHeartbeatFrequency?: number;
    jsTreatIntegerAsBigInt?: boolean;
    sessionToken?: string;
    masterToken?: string;
    sessionTokenExpirationTime?: number;
    masterTokenExpirationTime?: number;
    agentClass?: any;
    validateDefaultParameters?: boolean;
    arrayBindingThreshold?: number;
    gcsUseDownscopedCredential?: boolean;
    forceStageBindError?: number;
    includeRetryReason?: boolean;
    disableQueryContextCache?: boolean;
    retryTimeout?: number;
}