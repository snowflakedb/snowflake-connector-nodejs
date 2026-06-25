const assert = require('assert');
const snowflakeEmbed = require('./../../lib/streamlit_embed');
const { EmbeddedStreamlit, generateStreamlitEmbedUrl, SUBJECT_TOKEN_TYPE } = snowflakeEmbed;

// A fake axios instance whose request() records the last request and returns a
// caller-supplied response. This mocks the HTTP layer so no network is used and
// the server endpoint (not in prod yet) is never contacted.
function makeFakeAxios(responder) {
  const calls = [];
  return {
    calls,
    request: async (config) => {
      calls.push(config);
      return responder(config);
    },
  };
}

// A standard 200 token-exchange response whose redirect_uri carries the code in
// the fragment, mirroring the GS system-function output.
function okFragmentResponse(code = 'AZCODE123', redirectHost = 'app.snowflakecomputing.com') {
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      // oxlint-disable-next-line camelcase
      redirect_uri: `https://${redirectHost}/streamlit-app#code=${code}`,
      // oxlint-disable-next-line camelcase
      expires_in: 600,
    },
  };
}

describe('EmbeddedStreamlit', function () {
  const STREAMLIT_ID = 'mydb.myschema.myapp';
  const PARENT_ORIGIN = 'https://analytics.bmw.com';
  const TOKEN_ENDPOINT = 'https://fake.example.com/oauth/token';

  describe('credential modes -> subject_token_type mapping', function () {
    it('PAT maps to programmatic_access_token', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat-secret-value', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await embed.getEmbedUrl();

      const body = new URLSearchParams(axiosInstance.calls[0].data);
      assert.strictEqual(body.get('subject_token'), 'pat-secret-value');
      assert.strictEqual(body.get('subject_token_type'), SUBJECT_TOKEN_TYPE.PAT);
      assert.strictEqual(body.get('subject_token_type'), 'programmatic_access_token');
    });

    it('keyPair maps to provisional JWT URN by default', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ keyPair: 'signed.jwt.value', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await embed.getEmbedUrl();

      const body = new URLSearchParams(axiosInstance.calls[0].data);
      assert.strictEqual(body.get('subject_token'), 'signed.jwt.value');
      assert.strictEqual(body.get('subject_token_type'), 'urn:ietf:params:oauth:token-type:jwt');
    });

    it('keyPair subject_token_type is overridable', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({
        keyPair: 'signed.jwt.value',
        subjectTokenType: 'urn:snowflake:token-type:keypair-future',
        tokenEndpoint: TOKEN_ENDPOINT,
        axiosInstance,
      });
      await embed.getEmbedUrl();

      const body = new URLSearchParams(axiosInstance.calls[0].data);
      assert.strictEqual(body.get('subject_token_type'), 'urn:snowflake:token-type:keypair-future');
    });

    it('sessionToken maps to the session URN', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ sessionToken: 'sess-tok', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await embed.getEmbedUrl();

      const body = new URLSearchParams(axiosInstance.calls[0].data);
      assert.strictEqual(body.get('subject_token'), 'sess-tok');
      assert.strictEqual(body.get('subject_token_type'), 'urn:snowflake:token-type:session');
    });

    it('explicit subjectToken + subjectTokenType passes through verbatim (e.g. WIF)', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({
        subjectToken: 'wif-token',
        subjectTokenType: SUBJECT_TOKEN_TYPE.WIF,
        tokenEndpoint: TOKEN_ENDPOINT,
        axiosInstance,
      });
      await embed.getEmbedUrl();

      const body = new URLSearchParams(axiosInstance.calls[0].data);
      assert.strictEqual(body.get('subject_token'), 'wif-token');
      assert.strictEqual(body.get('subject_token_type'), 'urn:snowflake:token-type:wif');
    });
  });

  describe('request wire shape', function () {
    it('builds scope session:streamlit:<fqn>, token-exchange grant, correct headers, no Authorization', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await embed.getEmbedUrl();

      const call = axiosInstance.calls[0];
      assert.strictEqual(call.method, 'POST');
      assert.strictEqual(call.url, TOKEN_ENDPOINT);

      const body = new URLSearchParams(call.data);
      assert.strictEqual(body.get('scope'), 'session:streamlit:mydb.myschema.myapp');
      assert.strictEqual(body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:token-exchange');

      // application/x-www-form-urlencoded, accept json, and NO client identity.
      assert.match(call.headers['Content-Type'], /application\/x-www-form-urlencoded/);
      assert.strictEqual(call.headers['Accept'], 'application/json');
      assert.strictEqual(call.headers['Authorization'], undefined);

      // Body is a urlencoded string, not gzipped/JSON.
      assert.strictEqual(typeof call.data, 'string');
      assert.ok(!call.data.startsWith('{'));
    });

    it('derives the /oauth/token endpoint from account when none is given', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', account: 'myacct', axiosInstance });
      await embed.getEmbedUrl();

      assert.strictEqual(
        axiosInstance.calls[0].url,
        'https://myacct.snowflakecomputing.com/oauth/token',
      );
    });

    it('derives the endpoint from an explicit host', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', host: 'foo.us-east-1.snowflakecomputing.com', axiosInstance });
      await embed.getEmbedUrl();

      assert.strictEqual(
        axiosInstance.calls[0].url,
        'https://foo.us-east-1.snowflakecomputing.com/oauth/token',
      );
    });

    it('derives the endpoint from a connection accessUrl', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      // Use a non-default port to confirm the port is preserved (URL normalizes
      // away the default :443, so a custom port is the meaningful assertion).
      const fakeConnection = { accessUrl: 'https://acct.eu-west-1.snowflakecomputing.com:8443' };
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', connection: fakeConnection, axiosInstance });
      await embed.getEmbedUrl();

      assert.strictEqual(
        axiosInstance.calls[0].url,
        'https://acct.eu-west-1.snowflakecomputing.com:8443/oauth/token',
      );
    });

    it('sends validateStatus that resolves for non-2xx so the HTTP-status error message is produced', async function () {
      // Without validateStatus, the real axios instance would reject 4xx/5xx
      // before the module's precise "Token exchange failed with HTTP <status>"
      // message is produced. The injected fake never throws, so we must assert
      // validateStatus is present and permissive directly to protect the
      // error-message contract against accidental removal.
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await embed.getEmbedUrl();

      const validateStatus = axiosInstance.calls[0].validateStatus;
      assert.strictEqual(typeof validateStatus, 'function');
      assert.strictEqual(validateStatus(403), true);
      assert.strictEqual(validateStatus(500), true);
      assert.strictEqual(validateStatus(200), true);
    });
  });

  describe('embed URL assembly', function () {
    async function getUrlForRedirect(redirectUri, parentOrigin = PARENT_ORIGIN) {
      const axiosInstance = makeFakeAxios(() => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        // oxlint-disable-next-line camelcase
        data: { redirect_uri: redirectUri, expires_in: 600 },
      }));
      const embed = new EmbeddedStreamlit({ streamlitId: STREAMLIT_ID, parentOrigin });
      embed.prepare({ pat: 'pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      return embed.getEmbedUrl();
    }

    it('extracts the code from the redirect_uri fragment (#code=)', async function () {
      const url = await getUrlForRedirect('https://app.snowflakecomputing.com/sl#code=FRAGCODE');
      assert.strictEqual(
        url,
        'https://app.snowflakecomputing.com/sl?__parentOrigin=https%3A%2F%2Fanalytics.bmw.com&__embeddedApp=true#code=FRAGCODE',
      );
    });

    it('extracts the code from the redirect_uri query (?code=)', async function () {
      const url = await getUrlForRedirect('https://app.snowflakecomputing.com/sl?code=QUERYCODE');
      assert.strictEqual(
        url,
        'https://app.snowflakecomputing.com/sl?__parentOrigin=https%3A%2F%2Fanalytics.bmw.com&__embeddedApp=true#code=QUERYCODE',
      );
    });

    it('extracts the code from a trailing query (&code=) and preserves other query params', async function () {
      const url = await getUrlForRedirect(
        'https://app.snowflakecomputing.com/sl?foo=bar&code=AMPCODE',
      );
      assert.strictEqual(
        url,
        'https://app.snowflakecomputing.com/sl?foo=bar&__parentOrigin=https%3A%2F%2Fanalytics.bmw.com&__embeddedApp=true#code=AMPCODE',
      );
    });

    it('prefers the fragment code over a query code when both are present', async function () {
      // Contract: fragment is checked first, then query. With both present the
      // fragment code must win.
      const url = await getUrlForRedirect(
        'https://app.snowflakecomputing.com/sl?code=QUERYCODE#code=FRAGCODE',
      );
      assert.ok(url.endsWith('#code=FRAGCODE'));
      assert.ok(!url.includes('FRAGCODE&'));
      // The query-form code must NOT have leaked into the assembled URL.
      assert.ok(!url.includes('QUERYCODE'));
    });

    it('round-trips an opaque azcode byte-faithfully (no percent-decoding)', async function () {
      // A non-hex, base64url/base64-ish code carrying '+', '/', '=' and a
      // percent-encoded byte. URLSearchParams would corrupt this ('+' -> space,
      // '%2B' -> '+'); the raw substring extraction must preserve it verbatim.
      const opaque = 'ab+c/d=e%2Bf';
      const url = await getUrlForRedirect(`https://app.snowflakecomputing.com/sl#code=${opaque}`);
      assert.ok(
        url.endsWith(`#code=${opaque}`),
        `expected the azcode to survive byte-for-byte, got: ${url}`,
      );
    });

    it('round-trips an opaque azcode from the query form byte-faithfully', async function () {
      const opaque = 'XY+z/9%3D';
      const url = await getUrlForRedirect(`https://app.snowflakecomputing.com/sl?code=${opaque}`);
      assert.ok(
        url.endsWith(`#code=${opaque}`),
        `expected the query-form azcode to survive byte-for-byte, got: ${url}`,
      );
    });

    it('appends with & when the base already carries a query string', async function () {
      const url = await getUrlForRedirect('https://app.snowflakecomputing.com/sl?keep=1#code=C');
      // The surviving query (?keep=1) must be preserved and embed params appended with &.
      assert.ok(url.startsWith('https://app.snowflakecomputing.com/sl?keep=1&__parentOrigin='));
      assert.ok(url.includes('&__embeddedApp=true'));
      assert.ok(url.endsWith('#code=C'));
    });

    it('url-encodes the parentOrigin', async function () {
      const url = await getUrlForRedirect(
        'https://app.snowflakecomputing.com/sl#code=C',
        'https://my-host.example.com:8443/embed?x=1',
      );
      assert.ok(
        url.includes('__parentOrigin=https%3A%2F%2Fmy-host.example.com%3A8443%2Fembed%3Fx%3D1'),
      );
    });

    it('strips any pre-existing __embeddedApp / __parentOrigin params from the base', async function () {
      const url = await getUrlForRedirect(
        'https://app.snowflakecomputing.com/sl?__embeddedApp=true&__parentOrigin=https%3A%2F%2Fold.com&code=C',
      );
      // Old reserved params must not survive; only one of each remains.
      assert.strictEqual((url.match(/__embeddedApp=true/g) || []).length, 1);
      assert.strictEqual((url.match(/__parentOrigin=/g) || []).length, 1);
      assert.ok(url.includes('__parentOrigin=https%3A%2F%2Fanalytics.bmw.com'));
      assert.ok(!url.includes('old.com'));
      assert.ok(url.endsWith('#code=C'));
    });

    it('exposes expires_in after getEmbedUrl()', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await embed.getEmbedUrl();
      assert.strictEqual(embed.getExpiresIn(), 600);
    });

    it('generateStreamlitEmbedUrl convenience helper returns the assembled URL', async function () {
      const axiosInstance = makeFakeAxios(() =>
        okFragmentResponse('HELPERCODE', 'app.snowflakecomputing.com'),
      );
      const url = await generateStreamlitEmbedUrl({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
        pat: 'pat',
        tokenEndpoint: TOKEN_ENDPOINT,
        axiosInstance,
      });
      assert.ok(url.endsWith('#code=HELPERCODE'));
      assert.ok(url.includes('__embeddedApp=true'));
    });
  });

  describe('error cases', function () {
    it('rejects prepare() with no credential', function () {
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      assert.throws(
        () => embed.prepare({ tokenEndpoint: TOKEN_ENDPOINT }),
        /No credential supplied/,
      );
    });

    it('rejects a missing parentOrigin', function () {
      const embed = new EmbeddedStreamlit({ streamlitId: STREAMLIT_ID });
      assert.throws(() => embed.prepare({ pat: 'pat' }), /parentOrigin is required/);
    });

    it('rejects a streamlitId containing ":"', function () {
      const embed = new EmbeddedStreamlit({
        streamlitId: 'db.schema:app',
        parentOrigin: PARENT_ORIGIN,
      });
      assert.throws(() => embed.prepare({ pat: 'pat' }), /must contain no ':'/);
    });

    it('rejects when the account origin cannot be resolved', function () {
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      // No host/connection/account/tokenEndpoint supplied.
      assert.throws(
        () => embed.prepare({ pat: 'pat' }),
        /Unable to resolve the Snowflake account origin/,
      );
    });

    it('rejects getEmbedUrl() before prepare()', async function () {
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      await assert.rejects(() => embed.getEmbedUrl(), /called before prepare/);
    });

    it('rejects a non-200 token-exchange response', async function () {
      const axiosInstance = makeFakeAxios(() => ({
        status: 403,
        headers: { 'content-type': 'application/json' },
        data: { error: 'forbidden' },
      }));
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await assert.rejects(() => embed.getEmbedUrl(), /HTTP 403/);
    });

    it('rejects a 200 response missing redirect_uri', async function () {
      const axiosInstance = makeFakeAxios(() => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        // oxlint-disable-next-line camelcase
        data: { expires_in: 600 },
      }));
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await assert.rejects(() => embed.getEmbedUrl(), /did not contain a redirect_uri/);
    });

    it('rejects a redirect_uri with no authorization code', async function () {
      const axiosInstance = makeFakeAxios(() => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        // oxlint-disable-next-line camelcase
        data: { redirect_uri: 'https://app.snowflakecomputing.com/sl', expires_in: 600 },
      }));
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await assert.rejects(() => embed.getEmbedUrl(), /did not contain an authorization code/);
    });

    it('parses a JSON string response body (axios non-parsed)', async function () {
      const axiosInstance = makeFakeAxios(() => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify({
          // oxlint-disable-next-line camelcase
          redirect_uri: 'https://app.snowflakecomputing.com/sl#code=STRBODY',
          // oxlint-disable-next-line camelcase
          expires_in: 300,
        }),
      }));
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      const url = await embed.getEmbedUrl();
      assert.ok(url.endsWith('#code=STRBODY'));
    });
  });

  describe('secret hygiene', function () {
    it('does not place the credential in the request URL or headers', async function () {
      const axiosInstance = makeFakeAxios(() => okFragmentResponse());
      const embed = new EmbeddedStreamlit({
        streamlitId: STREAMLIT_ID,
        parentOrigin: PARENT_ORIGIN,
      });
      embed.prepare({ pat: 'super-secret-pat', tokenEndpoint: TOKEN_ENDPOINT, axiosInstance });
      await embed.getEmbedUrl();

      const call = axiosInstance.calls[0];
      assert.ok(!call.url.includes('super-secret-pat'));
      assert.ok(!JSON.stringify(call.headers).includes('super-secret-pat'));
      // The credential lives only in the form body.
      assert.ok(call.data.includes('super-secret-pat'));
    });
  });
});
