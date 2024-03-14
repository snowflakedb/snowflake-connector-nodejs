/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

import { XMLParser } from "fast-xml-parser";

export enum Rest {
    HTTPS_PORT = 443,
    HTTPS_PROTOCOL = 'https',
}

export enum OcspModes {
    FAIL_CLOSED = 'FAIL_CLOSED',
    FAIL_OPEN = 'FAIL_OPEN',
    INSECURE = 'INSECURE',
}

/**
 * Updates the value of the 'insecureConnect' parameter.
 *
 * @param {boolean} value
 */
export function setInsecureConnect(value: boolean): void;

/**
 * Returns the value of the 'insecureConnect' parameter.
 *
 * @returns {boolean}
 */
export function isInsecureConnect(): boolean;

declare let ocspFailOpen: boolean;

/**
 * Updates the value of the 'ocspFailOpen' parameter.
 *
 * @param {boolean} value
 */
export function setOcspFailOpen(): void;

/**
 * Returns the value of the 'ocspFailOpen' parameter.
 *
 * @param {boolean} value
 */
export function getOcspFailOpen(): boolean;

/**
 * Returns the OCSP mode.
 *
 * @returns {string}
 */
export function getOcspMode(): OcspModes

/**
 * Returns the upper limit for number of entries we can have in the OCSP response cache.
 *
 * @returns {number}
 */
export function getOcspResponseCacheSizeLimit(): number;

/**
 * Returns the maximum time in seconds that entries can live in the OCSP response cache.
 *
 * @returns {number}
 */
export function getOcspResponseCacheMaxAge(): number;

/**
 * Creates a cache directory.
 *
 * @returns {string}
 */
export function mkdirCacheDir(): string;


// The default JSON parser
export let jsonColumnVariantParser: (rawColumnValue: string) => any;

/**
 * Updates the value of the 'jsonColumnVariantParser' parameter.
 *
 * @param {Function: (rawColumnValue: string) => any} value
 */
export function setJsonColumnVariantParser(value: (rawColumnValue: string) => any): void;

/**
 * As a default we set parameters values identical like in fast-xml-parser lib defaults
 * thus preserving backward compatibility if customer doesn't set custom configuration
 * and give possibility to set only part of parameters.
 */
interface XmlParserConfiguration {
    ignoreAttributes?: boolean,
    alwaysCreateTextNode?: boolean,
    attributeNamePrefix?: string,
    attributesGroupName?: boolean,
}

// The default XML parser
export let xmlColumnVariantParser: XMLParser;

/**
 * Updates the value of the 'xmlColumnVariantParser' parameter.
 * Return fucntion with custom XmlParser configuration or default if not set.
 *
 * @param {Function: (rawColumnValue: string) => any} value
 */
export function setXmlColumnVariantParser(value: (rawColumnValue: string) => any): void;

/**
 * Create and update the 'xmlColumnVariantParser' parameter using custom parser configuration.
 *
 * @param {Function: (rawColumnValue: string) => any} params
 */
export function createXmlColumnVariantParserWithParameters(params: XmlParserConfiguration): void;

/**
 * Create function to parse XML using XMlParser with custom configuration.
 * Parametrs that you can override:
 *  ignoreAttributes: true,
 *  attributeNamePrefix: '@_',
 *  attributesGroupName: false,
 *  alwaysCreateTextNode: false
 *
 * @param {object} config
 */

export function createXmlColumnVariantParser(config: XmlParserConfiguration): Function;

/**
 * Updates the value of the 'keepAlive' parameter.
 *
 * @param {boolean} value
 */
export function setKeepAlive(value: boolean): void;

/**
 * Returns the overriden value of 'keepAlive' or default if not set. Default value is true.
 *
 * @param {boolean} value
 */
export function getKeepAlive(): boolean;

