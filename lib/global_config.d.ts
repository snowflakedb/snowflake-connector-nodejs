/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */


import { XMLParser } from "fast-xml-parser";
import { OcspModes } from "./core";

declare module GlobalConfig {
    /**
     * Returns the value of the 'insecureConnect' parameter.
     *
     * @returns {boolean}
     */
    export function isInsecureConnect(): boolean;

    declare let ocspFailOpen: boolean;

    /**
     * Returns the value of the 'ocspFailOpen' parameter.
     *
     */
    export function getOcspFailOpen(): boolean;

    /**
     * Returns the OCSP mode.
     *
     */
    export function getOcspMode(): OcspModes

    /**
     * Returns the upper limit for number of entries we can have in the OCSP response cache.
     *
     */
    export function getOcspResponseCacheSizeLimit(): number;

    /**
     * Returns the maximum time in seconds that entries can live in the OCSP response cache.
     *
     */
    export function getOcspResponseCacheMaxAge(): number;

    /**
     * The default JSON parser
     */
    export let jsonColumnVariantParser: CustomParser

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
    export let xmlColumnVariantParser: XMLParser | CustomParser;


    /**
     * Create and update the 'xmlColumnVariantParser' parameter using custom parser configuration.
     *
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
     */

    export function createXmlColumnVariantParser(config: XmlParserConfiguration): Function;

    /**
     * Returns the overriden value of 'keepAlive' or default if not set. Default value is true.
     *
     */
    export function getKeepAlive(): boolean;
}