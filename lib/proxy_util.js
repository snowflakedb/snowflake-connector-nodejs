/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const Logger = require('./logger');
const Errors = require('./errors');
const Util = require('./util');
const GlobalConfig = require('./global_config');
const ErrorCodes = Errors.codes;

/**
* remove http:// or https:// from the input, e.g. used with proxy URL
* @param input
* @returns {string}
*/
exports.removeScheme = function (input) {
  return input.toString().replace(/(^\w+:|^)\/\//, '');
};

/**
 * Try to get the PROXY environmental variables
 * On Windows, envvar name is case-insensitive, but on *nix, it's case-sensitive
 *
 * Compare them with the proxy specified on the Connection, if any
 * Return with the log constructed from the components detection and comparison
 * If there's something to warn the user about, return that too
 *
 * @param the agentOptions object from agent creation
 * @returns {object}
 */
exports.getCompareAndLogEnvAndAgentProxies = function (agentOptions) {
  const envProxy = {};
  const logMessages = { 'messages': '', 'warnings': '' };
  envProxy.httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  envProxy.httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  envProxy.noProxy = process.env.NO_PROXY || process.env.no_proxy;
  
  envProxy.logHttpProxy = envProxy.httpProxy ?
    'HTTP_PROXY: ' + envProxy.httpProxy : 'HTTP_PROXY: <unset>';
  envProxy.logHttpsProxy = envProxy.httpsProxy ?
    'HTTPS_PROXY: ' + envProxy.httpsProxy : 'HTTPS_PROXY: <unset>';
  envProxy.logNoProxy = envProxy.noProxy ?
    'NO_PROXY: ' + envProxy.noProxy : 'NO_PROXY: <unset>';
  
  // log PROXY envvars
  if (envProxy.httpProxy || envProxy.httpsProxy) {
    logMessages.messages = logMessages.messages + ' // PROXY environment variables: '
        + `${envProxy.logHttpProxy} ${envProxy.logHttpsProxy} ${envProxy.logNoProxy}.`;
  }
  
  // log proxy config on Connection, if any set
  if (agentOptions.host) {
    const proxyHostAndPort = agentOptions.host + ':' + agentOptions.port;
    const proxyProtocolHostAndPort = agentOptions.protocol ?
      ' protocol=' + agentOptions.protocol + ' proxy=' + proxyHostAndPort
      : ' proxy=' + proxyHostAndPort;
    const proxyUsername = agentOptions.user ? ' user=' + agentOptions.user : '';
    logMessages.messages = logMessages.messages + ` // Proxy configured in Agent:${proxyProtocolHostAndPort}${proxyUsername}`;
  
    // check if both the PROXY envvars and Connection proxy config is set
    // generate warnings if they are, and are also different
    if (envProxy.httpProxy &&
            this.removeScheme(envProxy.httpProxy).toLowerCase() !== this.removeScheme(proxyHostAndPort).toLowerCase()) {
      logMessages.warnings = logMessages.warnings + ` Using both the HTTP_PROXY (${envProxy.httpProxy})`
            + ` and the proxyHost:proxyPort (${proxyHostAndPort}) settings to connect, but with different values.`
            + ' If you experience connectivity issues, try unsetting one of them.';
    }
    if (envProxy.httpsProxy &&
            this.removeScheme(envProxy.httpsProxy).toLowerCase() !== this.removeScheme(proxyHostAndPort).toLowerCase()) {
      logMessages.warnings = logMessages.warnings + ` Using both the HTTPS_PROXY (${envProxy.httpsProxy})`
            + ` and the proxyHost:proxyPort (${proxyHostAndPort}) settings to connect, but with different values.`
            + ' If you experience connectivity issues, try unsetting one of them.';
    }
  }
  logMessages.messages = logMessages.messages ? logMessages.messages : ' none.';
  
  return logMessages;
};

exports.validateProxy = function (proxy) {
  const { host, port, noProxy, user, password } = proxy;
  // check for missing proxyHost
  Errors.checkArgumentExists(Util.exists(host),
    ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_HOST);
  
  // check for invalid proxyHost
  Errors.checkArgumentValid(Util.isString(host),
    ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_HOST);
  
  // check for missing proxyPort
  Errors.checkArgumentExists(Util.exists(port),
    ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_PORT);
  
  // check for invalid proxyPort
  Errors.checkArgumentValid(Util.isNumber(port),
    ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_PORT);
  
  if (Util.exists(noProxy)) {
    // check for invalid noProxy
    Errors.checkArgumentValid(Util.isString(noProxy),
      ErrorCodes.ERR_CONN_CREATE_INVALID_NO_PROXY);
  }
  
  if (Util.exists(user) || Util.exists(password)) {
    // check for missing proxyUser
    Errors.checkArgumentExists(Util.exists(user),
      ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_USER);
  
    // check for invalid proxyUser
    Errors.checkArgumentValid(Util.isString(user),
      ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_USER);
  
    // check for missing proxyPassword
    Errors.checkArgumentExists(Util.exists(password),
      ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_PASS);
  
    // check for invalid proxyPassword
    Errors.checkArgumentValid(Util.isString(password),
      ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_PASS);
  
  } else {
    delete proxy.user;
    delete proxy.password;
  }
};
  
exports.validateEmptyString = function (value) {
  return value !== '' ? value : undefined;
};
  
exports.getProxyFromEnv = function (isHttps = true) {
  const protocol = isHttps ? 'https' : 'http';
  let proxyFromEnv = Util.getEnvVar(`${protocol}_proxy`);
  if (!proxyFromEnv){
    return null;
  }
  
  Logger.getInstance().debug(`Util.getProxyEnv: Using ${protocol.toUpperCase()}_PROXY from the environment variable`);
  if (proxyFromEnv.indexOf('://') === -1) {
    Logger.getInstance().info('Util.getProxyEnv: the protocol was missing from the environment proxy. Use the HTTP protocol.');
    proxyFromEnv = 'http' + '://' + proxyFromEnv;
  }
  proxyFromEnv = new URL(proxyFromEnv);
  const proxy = {
    host: Util.validateEmptyString(proxyFromEnv.hostname),
    port: Number(Util.validateEmptyString(proxyFromEnv.port)),
    user: Util.validateEmptyString(proxyFromEnv.username),
    password: Util.validateEmptyString(proxyFromEnv.password),
    protocol: Util.validateEmptyString(proxyFromEnv.protocol),
    noProxy: this.getNoProxyEnv(),
  };
  this.validateProxy(proxy);
  return proxy;
};
  
exports.getNoProxyEnv = function () {
  const noProxy = Util.getEnvVar('no_proxy');
  if (noProxy) {
    return noProxy.split(',').join('|');
  }
  return undefined;
};

exports.getHostFromURL = function (destination) {
  if (destination.indexOf('://') === -1) {
    destination = 'https' + '://' + destination;
  }
  
  try {
    return new URL(destination).hostname;
  } catch (err) {
    Logger.getInstance().error(`Failed to parse the destination to URL with the error: ${err}. Return destination as the host: ${destination}`);
    return destination;
  }
};

exports.getProxy = function (proxy, fileLocation, isHttps) {
  if (!proxy && GlobalConfig.isEnvProxyActive()) {
    proxy = this.getProxyFromEnv(isHttps);
    if (proxy) {
      Logger.getInstance().debug(`${fileLocation} loads the proxy info from the environment variable host: ${proxy.host}`);
    }
  }
  return proxy;
};