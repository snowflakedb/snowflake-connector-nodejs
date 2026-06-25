const Util = require('./util');
const Logger = require('./logger');
const defaultAxios = require('./http/axios_instance').default;

/**
 * Subject token type URNs accepted by the Snowflake OAuth token-exchange
 * endpoint for the streamlit embed scope. Verified against
 * GlobalServices SFOAuthTokenType (modules/dbsec/authn-api), 2026-06-25.
 *
 * NOTE: There is no key-pair-JWT subject_token_type in the GS enum today.
 * For the key-pair credential mode the driver does NOT hardcode a type; it
 * exposes an overridable subject_token_type that defaults to
 * SUBJECT_TOKEN_TYPE.JWT below and is documented as PROVISIONAL pending the
 * GS keypair extension.
 */
const SUBJECT_TOKEN_TYPE = {
  SESSION: 'urn:snowflake:token-type:session',
  PAT: 'programmatic_access_token',
  WIF: 'urn:snowflake:token-type:wif',
  OAUTH_ACCESS_TOKEN: 'urn:ietf:params:oauth:token-type:access_token',
  // PROVISIONAL: no GS enum value for key-pair JWT yet (overridable).
  JWT: 'urn:ietf:params:oauth:token-type:jwt',
};

const GRANT_TYPE_TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange';
const TOKEN_PATH = '/oauth/token';

/**
 * Resolve the base origin (scheme://host[:port]) for the account, used to
 * build the token-exchange endpoint when an explicit endpoint is not given.
 *
 * Precedence: explicit host (or full token endpoint) > connection accessUrl >
 * constructed hostname from account.
 *
 * @param {{ host?: string, account?: string, connection?: Object }} opts
 *
 * @returns {string} an origin such as 'https://myaccount.snowflakecomputing.com'
 */
function resolveAccountOrigin(opts) {
  // 1. Explicit host wins. Accept either a bare host or a full URL.
  if (Util.isNotEmptyString(opts.host)) {
    const host = opts.host.trim();
    if (host.startsWith('http://') || host.startsWith('https://')) {
      const parsed = new URL(host);
      return `${parsed.protocol}//${parsed.host}`;
    }
    return `https://${host}`;
  }

  // 2. Connection config accessUrl (set from account/host/region at config time).
  if (opts.connection && typeof opts.connection.accessUrl === 'string') {
    const parsed = new URL(opts.connection.accessUrl);
    return `${parsed.protocol}//${parsed.host}`;
  }
  if (opts.connection && typeof opts.connection.getAccessUrl === 'function') {
    const accessUrl = opts.connection.getAccessUrl();
    if (Util.isNotEmptyString(accessUrl)) {
      const parsed = new URL(accessUrl);
      return `${parsed.protocol}//${parsed.host}`;
    }
  }

  // 3. Fall back to constructing a hostname from the account.
  if (Util.isNotEmptyString(opts.account)) {
    return `https://${Util.constructHostname(null, opts.account)}`;
  }

  throw new Error(
    'Unable to resolve the Snowflake account origin: provide one of host, ' +
      'connection, account, or an explicit tokenEndpoint.',
  );
}

/**
 * Build the absolute /oauth/token endpoint. An explicit tokenEndpoint (used by
 * tests / forward-compatibility) is returned verbatim.
 *
 * @param {Object} opts
 *
 * @returns {string}
 */
function resolveTokenEndpoint(opts) {
  if (Util.isNotEmptyString(opts.tokenEndpoint)) {
    return opts.tokenEndpoint.trim();
  }
  return resolveAccountOrigin(opts) + TOKEN_PATH;
}

/**
 * Resolve the (subject_token, subject_token_type) pair from the prepared
 * credential. Exactly one credential mode must be supplied.
 *
 * Modes (in precedence order):
 *  - subjectToken (+ optional subjectTokenType): explicit escape hatch for
 *    forward-compatibility; the caller fully controls both values.
 *  - pat: Programmatic Access Token -> 'programmatic_access_token'.
 *  - keyPair: a pre-signed key-pair JWT -> PROVISIONAL JWT URN (overridable
 *    via subjectTokenType).
 *  - sessionToken: an existing Snowflake session token -> session URN.
 *
 * Never logs the credential value.
 *
 * @param {Object} opts
 *
 * @returns {{ subjectToken: string, subjectTokenType: string }}
 */
function resolveCredential(opts) {
  // Explicit escape hatch: caller provides the raw pair.
  if (Util.isNotEmptyString(opts.subjectToken)) {
    return {
      subjectToken: opts.subjectToken,
      // Default to the provisional JWT URN only if the caller did not name one.
      subjectTokenType: Util.isNotEmptyString(opts.subjectTokenType)
        ? opts.subjectTokenType
        : SUBJECT_TOKEN_TYPE.JWT,
    };
  }

  if (Util.isNotEmptyString(opts.pat)) {
    return {
      subjectToken: opts.pat,
      subjectTokenType: SUBJECT_TOKEN_TYPE.PAT,
    };
  }

  if (Util.isNotEmptyString(opts.keyPair)) {
    // keyPair is a pre-signed RS256 JWT. No GS subject_token_type exists for
    // key-pair JWT yet, so the type is PROVISIONAL and overridable.
    return {
      subjectToken: opts.keyPair,
      subjectTokenType: Util.isNotEmptyString(opts.subjectTokenType)
        ? opts.subjectTokenType
        : SUBJECT_TOKEN_TYPE.JWT,
    };
  }

  if (Util.isNotEmptyString(opts.sessionToken)) {
    return {
      subjectToken: opts.sessionToken,
      subjectTokenType: SUBJECT_TOKEN_TYPE.SESSION,
    };
  }

  throw new Error(
    'No credential supplied to EmbeddedStreamlit.prepare(): provide one of ' +
      'pat, keyPair, sessionToken, or an explicit (subjectToken, subjectTokenType).',
  );
}

/**
 * Build the token-exchange scope for a streamlit app. The streamlitId is the
 * fully-qualified name (db.schema.app) and MUST contain no ':' so it cannot
 * break out of the scope grammar.
 *
 * @param {string} streamlitId
 *
 * @returns {string} e.g. 'session:streamlit:db.schema.app'
 */
function buildScope(streamlitId) {
  if (!Util.isNotEmptyString(streamlitId)) {
    throw new Error('streamlitId (the db.schema.app fully-qualified name) is required.');
  }
  if (streamlitId.indexOf(':') >= 0) {
    throw new Error(
      `Invalid streamlitId "${streamlitId}": the fully-qualified name must contain no ':'.`,
    );
  }
  return `session:streamlit:${streamlitId}`;
}

/**
 * Match the RAW (un-decoded) value of a 'code' parameter inside a fragment or
 * query string. We deliberately do NOT parse with URLSearchParams, because that
 * percent-decodes the value (and turns '+' into a space). GS treats the azcode
 * opaquely (StreamlitGenerateEmbedUrl.java does setFragment("code=" + azCode)),
 * so the driver must round-trip the code byte-for-byte: an opaque/base64url
 * code containing '+', '/', '=' or '%' must reach the browser unchanged.
 *
 * @param {string} segment the raw fragment or query string (no leading '#'/'?')
 *
 * @returns {string|null} the raw value following 'code=' up to the next '&', or null
 */
function matchRawCode(segment) {
  // (?:^|&)code=  anchors on a full parameter boundary so 'somecode=x' never matches.
  const match = /(?:^|&)code=([^&]*)/.exec(segment);
  return match ? match[1] : null;
}

/**
 * Extract the single-use authorization code from a token-exchange
 * redirect_uri. The code may be carried as a URL fragment ('#code=...') OR
 * query ('?code=...' / '&code=...'). The fragment form is checked first.
 *
 * The code is sliced out of the RAW fragment/query substring (not decoded via
 * URLSearchParams) so it is byte-faithful to whatever GS placed in
 * redirect_uri, regardless of the code's character set.
 *
 * @param {string} redirectUri
 *
 * @returns {string} the authorization code, exactly as carried in redirect_uri
 */
function extractAuthorizationCode(redirectUri) {
  const parsed = new URL(redirectUri);

  // 1. Fragment form: '#code=...' (may carry multiple '&'-joined pairs).
  if (parsed.hash) {
    // Strip the leading '#'. parsed.hash is the raw, un-decoded fragment.
    const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const fragCode = matchRawCode(fragment);
    if (fragCode !== null && fragCode.length > 0) {
      return fragCode;
    }
  }

  // 2. Query form: '?code=...' / '&code=...'. parsed.search is the raw,
  //    un-decoded query (including the leading '?', which we strip).
  if (parsed.search) {
    const query = parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search;
    const queryCode = matchRawCode(query);
    if (queryCode !== null && queryCode.length > 0) {
      return queryCode;
    }
  }

  throw new Error('Token-exchange redirect_uri did not contain an authorization code.');
}

/**
 * Compute the embed base URL: scheme://host[:port]/path of redirect_uri, with
 * the authorization code removed AND any pre-existing __embeddedApp /
 * __parentOrigin params stripped, preserving any other query params.
 *
 * @param {string} redirectUri
 *
 * @returns {URL} a URL whose hash is cleared and whose reserved params are removed
 */
function computeEmbedBase(redirectUri) {
  const base = new URL(redirectUri);
  // The code lives in the fragment in the common case; always clear it.
  base.hash = '';
  // Remove the code and the reserved embed params if the server echoed them.
  base.searchParams.delete('code');
  base.searchParams.delete('__embeddedApp');
  base.searchParams.delete('__parentOrigin');
  return base;
}

/**
 * Assemble the final embed URL, reproducing the proven system-function output
 * format from GS StreamlitGenerateEmbedUrl.java:
 *   base + '?__parentOrigin=' + urlencode(parentOrigin)
 *        + '&__embeddedApp=true'
 *        + '#code=' + code
 * If the base already carries query params, the embed params are appended with
 * '&' rather than '?'.
 *
 * @param {string} redirectUri the server-provided redirect_uri
 * @param {string} parentOrigin the embedding page origin
 *
 * @returns {string} the final embed URL
 */
function assembleEmbedUrl(redirectUri, parentOrigin) {
  const code = extractAuthorizationCode(redirectUri);
  const base = computeEmbedBase(redirectUri);

  // Preserve any surviving query string, then append reserved params.
  const existingQuery = base.search; // includes leading '?' or '' if none
  const separator = existingQuery && existingQuery.length > 1 ? '&' : '?';
  const baseStr = `${base.protocol}//${base.host}${base.pathname}${existingQuery}`;

  return (
    baseStr +
    separator +
    '__parentOrigin=' +
    encodeURIComponent(parentOrigin) +
    '&__embeddedApp=true' +
    '#code=' +
    code
  );
}

/**
 * POST the token-exchange request as application/x-www-form-urlencoded.
 *
 * This deliberately uses the raw axios instance (not http/base.js
 * requestAsync, which gzips and JSON-stringifies the body) so the body is sent
 * as a clean form-encoded grant request, mirroring how
 * lib/authentication/auth_oauth_client_credentials.ts builds its urlencoded
 * grant.
 *
 * The streamlit-embed token-exchange path carries NO OAuth client identity:
 * no Authorization header, no client_id / client_secret.
 *
 * @param {Object} cfg
 * @param {string} cfg.tokenEndpoint absolute /oauth/token URL
 * @param {string} cfg.subjectToken the credential value (secret)
 * @param {string} cfg.subjectTokenType the subject_token_type URN
 * @param {string} cfg.scope the session:streamlit:<fqn> scope
 * @param {Object} cfg.axiosInstance injectable axios instance (for tests)
 *
 * @returns {Promise<Object>} parsed JSON response body
 */
async function postTokenExchange(cfg) {
  const body = new URLSearchParams();
  // oxlint-disable-next-line camelcase
  body.set('grant_type', GRANT_TYPE_TOKEN_EXCHANGE);
  // oxlint-disable-next-line camelcase
  body.set('subject_token', cfg.subjectToken);
  // oxlint-disable-next-line camelcase
  body.set('subject_token_type', cfg.subjectTokenType);
  body.set('scope', cfg.scope);

  Logger.getInstance().debug(
    'EmbeddedStreamlit: requesting token exchange at %s (scope=%s, subject_token_type=%s)',
    cfg.tokenEndpoint,
    cfg.scope,
    cfg.subjectTokenType,
  );

  const response = await cfg.axiosInstance.request({
    method: 'POST',
    url: cfg.tokenEndpoint,
    data: body.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json',
    },
    // Resolve for any status so we can craft a precise error message.
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    throw new Error(
      `Token exchange failed with HTTP ${response.status} from ${cfg.tokenEndpoint}.`,
    );
  }

  const data =
    typeof response.data === 'string' && response.data.length > 0
      ? JSON.parse(response.data)
      : response.data;

  if (!data || !Util.isNotEmptyString(data.redirect_uri)) {
    throw new Error('Token exchange response did not contain a redirect_uri.');
  }

  return data;
}

/**
 * Helper to generate a Streamlit embed URL via OAuth token-exchange. This is a
 * one-shot convenience wrapper around the EmbeddedStreamlit class.
 *
 * @param {Object} options { streamlitId, parentOrigin, ...credential }
 *
 * @returns {Promise<string>} the final embed URL
 */
async function generateStreamlitEmbedUrl(options = {}) {
  const embed = new EmbeddedStreamlit({
    streamlitId: options.streamlitId,
    parentOrigin: options.parentOrigin,
  });
  embed.prepare(options);
  return embed.getEmbedUrl();
}

/**
 * Generates a short-lived Streamlit embed URL by performing an OAuth
 * token-exchange against the Snowflake /oauth/token endpoint with a service
 * credential, then assembling the embed URL. This replaces the
 * SYSTEM$STREAMLIT_GENERATE_EMBED_URL SQL system function for embedding
 * Streamlit-in-Snowflake apps in 3rd-party pages, without a SQL session.
 *
 * Usage:
 *   const embed = new snowflake.EmbeddedStreamlit({
 *     streamlitId: 'db.schema.app',
 *     parentOrigin: 'https://analytics.example.com',
 *   });
 *   embed.prepare({ pat: '<pat>', account: 'myaccount' });
 *   const url = await embed.getEmbedUrl();
 */
class EmbeddedStreamlit {
  /**
   * @param {Object} config
   * @param {string} config.streamlitId fully-qualified app name (db.schema.app)
   * @param {string} config.parentOrigin origin of the embedding page
   */
  constructor(config = {}) {
    this._streamlitId = config.streamlitId;
    this._parentOrigin = config.parentOrigin;
    this._prepared = null;
  }

  /**
   * Prepare the credential and target endpoint. Exactly one credential mode
   * must be supplied (pat | keyPair | sessionToken | explicit subjectToken).
   *
   * @param {Object} options
   * @param {string} [options.pat] Programmatic Access Token value
   * @param {string} [options.keyPair] a pre-signed RS256 key-pair JWT
   * @param {string} [options.sessionToken] an existing Snowflake session token
   * @param {string} [options.subjectToken] explicit subject_token (escape hatch)
   * @param {string} [options.subjectTokenType] explicit/override subject_token_type
   * @param {Object} [options.connection] a Snowflake connection (for accessUrl)
   * @param {string} [options.account] account name (used to construct the host)
   * @param {string} [options.host] explicit host or full base URL
   * @param {string} [options.user] account user (reserved; not required today)
   * @param {string} [options.tokenEndpoint] explicit /oauth/token URL (tests)
   * @param {Object} [options.axiosInstance] injectable axios instance (tests)
   *
   * @returns {EmbeddedStreamlit} this, for chaining
   */
  prepare(options = {}) {
    if (!Util.isNotEmptyString(this._parentOrigin)) {
      throw new Error('parentOrigin is required to build the embed URL.');
    }
    // Validate the scope eagerly so a bad streamlitId fails fast.
    const scope = buildScope(this._streamlitId);
    const credential = resolveCredential(options);
    const tokenEndpoint = resolveTokenEndpoint(options);

    this._prepared = {
      scope,
      subjectToken: credential.subjectToken,
      subjectTokenType: credential.subjectTokenType,
      tokenEndpoint,
      axiosInstance: options.axiosInstance || defaultAxios,
    };
    return this;
  }

  /**
   * Perform the token-exchange and return the assembled embed URL.
   *
   * @returns {Promise<string>} the final embed URL
   */
  async getEmbedUrl() {
    if (!this._prepared) {
      throw new Error('EmbeddedStreamlit.getEmbedUrl() called before prepare().');
    }
    const data = await postTokenExchange(this._prepared);
    this._expiresIn = typeof data.expires_in === 'number' ? data.expires_in : undefined;
    return assembleEmbedUrl(data.redirect_uri, this._parentOrigin);
  }

  /**
   * The token-exchange expires_in (seconds), available after getEmbedUrl().
   *
   * @returns {number|undefined}
   */
  getExpiresIn() {
    return this._expiresIn;
  }
}

module.exports = {
  EmbeddedStreamlit,
  generateStreamlitEmbedUrl,
  SUBJECT_TOKEN_TYPE,
  // Exported for unit testing of the internal pieces.
  _internal: {
    resolveAccountOrigin,
    resolveTokenEndpoint,
    resolveCredential,
    buildScope,
    extractAuthorizationCode,
    computeEmbedBase,
    assembleEmbedUrl,
    postTokenExchange,
  },
};
