const Logger = require('./logger');
const net = require('net');

/**
 * Determines if a given URL is valid.
 *
 * @param url
 *
 * @returns {Boolean}
 */
exports.isValidURL = function (url) {
  const regex = '^http(s?)\\:\\/\\/[0-9a-zA-Z]([-.\\w]*[0-9a-zA-Z@:])*(:(0-9)*)*(\\/?)([a-zA-Z0-9\\-\\.\\?\\,\\&\\(\\)\\/\\\\\\+&%\\$#_=@]*)?$';
  if (!url.match(regex)) {
    Logger.getInstance().debug('The provided URL is not a valid URL. URL: %s', url);
    return false;
  }
  return true;
};

/**
 * Encodes the given URL. 
 * 
 * @param {String} url 
 * 
 * @returns {String} the encoded URL
 */
exports.urlEncode = function (url) { 
  /** The encodeURIComponent() method encodes special characters including: , / ? : @ & = + $ #
     but escapes space as %20B. Replace with + for consistency across drivers. */
  return encodeURIComponent(url).replace(/%20/g, '+');
};

/**
* Returns an object with host and port properties.
* Unspecified ports get set to 0.
* @param {String} address
*
* @returns {Object} { host: string, port: number }
*/
exports.parseAddress = function (address) {
  let host, port;

  // upfront check for IPv6 before we take the port off 
  if (net.isIPv6(address)) {
    host = address;
    port = 0;
    return { host, port };
  }

  const match = address.match(/^(.*):(\d+)$/);

  if (match) {
    host = match[1];
    port = parseInt(match[2], 10);
  } else {
    host = address;
    port = 0;
  }

  // Remove brackets from IPv6 addresses with ports
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }

  return { host, port };
};