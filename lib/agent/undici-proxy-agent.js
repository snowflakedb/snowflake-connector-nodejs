/**
 * MIT License
 *
 * Copyright (c) Matteo Collina and Undici contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict'

/**
 * File copied from undici https://github.com/nodejs/undici/blob/main/lib/proxy-agent.js as it is on 2023-08-16 with following changes:
 * - [it's reason for reimplementation] added OCSP socket validation callback function and additional http agent as parameters - they are used in OCSP validation
 * - fixed imports to refer to undici package paths - if they are imported from raw 'undici' then errors are generated
 * - added Snowflake Logger
 * - disable eslint checks for the file
 */

/* eslint-disable */
const { kProxy, kClose, kDestroy, kInterceptors } = require('undici/lib/core/symbols')
const { URL } = require('url')
const Agent = require('undici/lib/agent')
const Pool = require('undici/lib/pool')
const DispatcherBase = require('undici/lib/dispatcher-base')
const { InvalidArgumentError, RequestAbortedError } = require('undici/lib/core/errors')
const buildConnector = require('undici/lib/core/connect')
const kAgent = Symbol('proxy agent')
const kClient = Symbol('proxy client')
const kProxyHeaders = Symbol('proxy headers')
const kRequestTls = Symbol('request tls settings')
const kProxyTls = Symbol('proxy tls settings')
const kConnectEndpoint = Symbol('connect endpoint function')

const Logger = require('../logger')

function defaultProtocolPort (protocol) {
  return protocol === 'https:' ? 443 : 80
}

function buildProxyOptions (opts) {
  if (typeof opts === 'string') {
    opts = { uri: opts }
  }

  if (!opts || !opts.uri) {
    throw new InvalidArgumentError('Proxy opts.uri is mandatory')
  }

  return {
    uri: opts.uri,
    protocol: opts.protocol || 'https'
  }
}

function defaultFactory (origin, opts) {
  return new Pool(origin, opts)
}

class ProxyAgent extends DispatcherBase {
  constructor (opts) {
    super(opts)
    this[kProxy] = buildProxyOptions(opts)
    this[kAgent] = new Agent(opts)
    this[kInterceptors] = opts.interceptors && opts.interceptors.ProxyAgent && Array.isArray(opts.interceptors.ProxyAgent)
      ? opts.interceptors.ProxyAgent
      : []
    this.ocspValidationCallback = opts.ocspValidationCallback;
    this.ocspResponderHttpAgent = opts.ocspResponderHttpAgent;

    if (typeof opts === 'string') {
      opts = { uri: opts }
    }

    if (!opts || !opts.uri) {
      throw new InvalidArgumentError('Proxy opts.uri is mandatory')
    }
    Logger.getInstance().debug(`Using proxy ${opts.uri}`)

    const { clientFactory = defaultFactory } = opts

    if (typeof clientFactory !== 'function') {
      throw new InvalidArgumentError('Proxy opts.clientFactory must be a function.')
    }

    this[kRequestTls] = opts.requestTls
    this[kProxyTls] = opts.proxyTls
    this[kProxyHeaders] = opts.headers || {}

    if (opts.auth && opts.token) {
      throw new InvalidArgumentError('opts.auth cannot be used in combination with opts.token')
    } else if (opts.auth) {
      /* @deprecated in favour of opts.token */
      this[kProxyHeaders]['proxy-authorization'] = `Basic ${opts.auth}`
    } else if (opts.token) {
      this[kProxyHeaders]['proxy-authorization'] = opts.token
    }

    const resolvedUrl = new URL(opts.uri)
    const { origin, port, host } = resolvedUrl

    const connect = buildConnector({ ...opts.proxyTls })
    this[kConnectEndpoint] = buildConnector({ ...opts.requestTls })
    this[kClient] = clientFactory(resolvedUrl, { connect })
    this[kAgent] = new Agent({
      ...opts,
      connect: async (opts, callback) => {
        let requestedHost = opts.host
        if (!opts.port) {
          requestedHost += `:${defaultProtocolPort(opts.protocol)}`
        }
        try {
          const { socket, statusCode } = await this[kClient].connect({
            origin,
            port,
            path: requestedHost,
            signal: opts.signal,
            headers: {
              ...this[kProxyHeaders],
              host
            }
          })
          if (statusCode !== 200) {
            socket.on('error', () => {}).destroy()
            callback(new RequestAbortedError('Proxy response !== 200 when HTTP Tunneling'))
          }
          if (opts.protocol !== 'https:') {
            callback(null, socket)
            return
          }
          let servername
          if (this[kRequestTls]) {
            servername = this[kRequestTls].servername
          } else {
            servername = opts.servername
          }
          this[kConnectEndpoint]({ ...opts, servername, httpSocket: socket }, this.ocspValidationCallback(callback, servername, this.ocspResponderHttpAgent, null))
        } catch (err) {
          callback(err)
        }
      }
    })
  }

  dispatch (opts, handler) {
    const { host } = new URL(opts.origin)
    const headers = buildHeaders(opts.headers)
    throwIfProxyAuthIsSent(headers)
    return this[kAgent].dispatch(
      {
        ...opts,
        headers: {
          ...headers,
          host
        }
      },
      handler
    )
  }

  async [kClose] () {
    await this[kAgent].close()
    await this[kClient].close()
  }

  async [kDestroy] () {
    await this[kAgent].destroy()
    await this[kClient].destroy()
  }
}

/**
 * @param {string[] | Record<string, string>} headers
 * @returns {Record<string, string>}
 */
function buildHeaders (headers) {
  // When using undici.fetch, the headers list is stored
  // as an array.
  if (Array.isArray(headers)) {
    /** @type {Record<string, string>} */
    const headersPair = {}

    for (let i = 0; i < headers.length; i += 2) {
      headersPair[headers[i]] = headers[i + 1]
    }

    return headersPair
  }

  return headers
}

/**
 * @param {Record<string, string>} headers
 *
 * Previous versions of ProxyAgent suggests the Proxy-Authorization in request headers
 * Nevertheless, it was changed and to avoid a security vulnerability by end users
 * this check was created.
 * It should be removed in the next major version for performance reasons
 */
function throwIfProxyAuthIsSent (headers) {
  const existProxyAuth = headers && Object.keys(headers)
    .find((key) => key.toLowerCase() === 'proxy-authorization')
  if (existProxyAuth) {
    throw new InvalidArgumentError('Proxy-Authorization should be sent in ProxyAgent constructor')
  }
}

module.exports = ProxyAgent
/* eslint-enable */
