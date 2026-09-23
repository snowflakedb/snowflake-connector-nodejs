import assert from 'assert';
import net from 'net';
import authUtil from '../../../lib/authentication/authentication_util';

type RendererResult = { error: string | null };
type Renderer = (result: RendererResult) => string;

interface ServerResult {
  resolved: string | null;
  rejected: unknown | null;
}

interface ServerOptions {
  renderer?: Renderer;
  allowedOrigin?: string;
}

// Spin up the callback server, send it a single HTTP request line over a raw
// TCP socket (mimicking the browser redirect), and collect both the raw HTTP
// response and the resolve/reject outcome of the surrounding promise. When
// `renderer` is omitted, createServer falls back to its built-in default.
function runServer(
  requestLine: string,
  renderer?: Renderer,
): Promise<{ response: string; outcome: ServerResult }> {
  return runServerRequests([`${requestLine}\r\n\r\n`], renderer ? { renderer } : {}).then(
    ({ responses, outcome }) => ({ response: responses[0], outcome }),
  );
}

function runServerRequests(
  requests: string[],
  options: ServerOptions,
): Promise<{ responses: string[]; outcome: ServerResult }> {
  return new Promise((resolveOuter, rejectOuter) => {
    const outcome: ServerResult = { resolved: null, rejected: null };
    const responses: string[] = [];

    const server = authUtil.createServer(
      (value: string) => {
        outcome.resolved = value;
      },
      (err: unknown) => {
        outcome.rejected = err;
      },
      options,
    );

    server.on('error', rejectOuter);

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const sendRequest = (index: number) => {
        const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
          client.write(requests[index]);
        });

        let response = '';
        client.setEncoding('utf8');
        client.on('data', (chunk) => {
          response += chunk;
        });
        const finish = () => {
          responses.push(response);
          if (index + 1 < requests.length) {
            sendRequest(index + 1);
          } else {
            setImmediate(() => resolveOuter({ responses, outcome }));
          }
        };
        client.once('close', finish);
        client.once('error', () => {});
      };
      sendRequest(0);
    });
  });
}

describe('createServer', function () {
  function assertHtmlOkResponse(response: string) {
    assert.match(response, /^HTTP\/1\.1 200 OK/);
    assert.match(response, /content-type: text\/html; charset=utf-8/i);
  }

  describe('with a custom renderer', function () {
    const customRenderer = ({ error }: RendererResult) => (error ? `BAD ${error}` : 'OK');

    it('renders the renderer output and resolves on the success redirect', async function () {
      const requestLine = 'GET /?token=fake-saml-token HTTP/1.1';
      const { response, outcome } = await runServer(requestLine, customRenderer);

      assertHtmlOkResponse(response);
      assert.ok(response.includes('OK'), `expected success body, got: ${response}`);
      assert.strictEqual(outcome.resolved, requestLine);
      assert.strictEqual(outcome.rejected, null);
    });

    it('renders the renderer output and rejects on the error redirect', async function () {
      const { response, outcome } = await runServer(
        'GET /?error=access_denied&error_description=user+declined HTTP/1.1',
        customRenderer,
      );

      assertHtmlOkResponse(response);
      assert.match(response, /BAD .*access_denied/);
      assert.strictEqual(outcome.resolved, null);
      assert.match(String(outcome.rejected), /access_denied/);
    });
  });

  describe('with the default renderer', function () {
    it('renders the default confirmation body and resolves on the success redirect', async function () {
      const requestLine = 'GET /?token=fake-saml-token HTTP/1.1';
      const { response, outcome } = await runServer(requestLine);

      assertHtmlOkResponse(response);
      assert.match(response, /Your identity was confirmed and propagated to Snowflake/);
      assert.strictEqual(outcome.resolved, requestLine);
      assert.strictEqual(outcome.rejected, null);
    });

    it('renders the error and rejects on the error redirect', async function () {
      const { response, outcome } = await runServer(
        'GET /?error=access_denied&error_description=user+declined HTTP/1.1',
      );

      assertHtmlOkResponse(response);
      assert.match(response, /access_denied/);
      assert.strictEqual(outcome.resolved, null);
      assert.match(String(outcome.rejected), /access_denied/);
    });
  });

  describe('with an allowed Origin', function () {
    const allowedOrigin = 'https://account.snowflakecomputing.com:443';
    const validGet =
      'GET /?token=valid-token HTTP/1.1\r\nOrigin: https://account.snowflakecomputing.com\r\n\r\n';

    it('accepts matching Origins with equivalent default ports', async function () {
      const { responses, outcome } = await runServerRequests([validGet], { allowedOrigin });

      assertHtmlOkResponse(responses[0]);
      assert.strictEqual(outcome.resolved, validGet.split(/\r?\n/, 1)[0]);
    });

    it('ignores a foreign Origin and accepts a later callback', async function () {
      const foreign =
        'GET /?token=foreign-token HTTP/1.1\r\nOrigin: https://other.snowflakecomputing.com\r\n\r\n';
      const duplicate =
        'GET /?token=duplicate-origin HTTP/1.1\r\nOrigin: https://account.snowflakecomputing.com\r\nOrigin: null\r\n\r\n';
      const { responses, outcome } = await runServerRequests([foreign, duplicate, validGet], {
        allowedOrigin,
      });

      assert.deepStrictEqual(responses.slice(0, 2), ['', '']);
      assertHtmlOkResponse(responses[2]);
      assert.strictEqual(outcome.resolved, validGet.split(/\r?\n/, 1)[0]);
    });

    it('rejects Origins with a different scheme or effective port', async function () {
      const wrongScheme =
        'GET /?token=wrong-scheme HTTP/1.1\r\nOrigin: http://account.snowflakecomputing.com\r\n\r\n';
      const wrongPort =
        'GET /?token=wrong-port HTTP/1.1\r\nOrigin: https://account.snowflakecomputing.com:8443\r\n\r\n';
      const { responses, outcome } = await runServerRequests([wrongScheme, wrongPort, validGet], {
        allowedOrigin,
      });

      assert.deepStrictEqual(responses.slice(0, 2), ['', '']);
      assertHtmlOkResponse(responses[2]);
      assert.strictEqual(outcome.resolved, validGet.split(/\r?\n/, 1)[0]);
    });

    it('answers only matching POST preflight requests with Content-Type headers', async function () {
      const foreignPreflight =
        'OPTIONS / HTTP/1.1\r\nOrigin: https://other.snowflakecomputing.com\r\nAccess-Control-Request-Method: POST\r\nAccess-Control-Request-Headers: Content-Type\r\n\r\n';
      const getPreflight =
        'OPTIONS / HTTP/1.1\r\nOrigin: https://account.snowflakecomputing.com\r\nAccess-Control-Request-Method: GET\r\nAccess-Control-Request-Headers: Content-Type\r\n\r\n';
      const extraHeadersPreflight =
        'OPTIONS / HTTP/1.1\r\nOrigin: https://account.snowflakecomputing.com\r\nAccess-Control-Request-Method: POST\r\nAccess-Control-Request-Headers: Content-Type, X-Custom\r\n\r\n';
      const omittedHeadersPreflight =
        'OPTIONS / HTTP/1.1\r\nOrigin: https://account.snowflakecomputing.com\r\nAccess-Control-Request-Method: POST\r\n\r\n';
      const validPreflight =
        'OPTIONS / HTTP/1.1\nOrigin: https://account.snowflakecomputing.com\nAccess-Control-Request-Method: post\nAccess-Control-Request-Headers: Content-Type\n\n';
      const { responses, outcome } = await runServerRequests(
        [
          foreignPreflight,
          getPreflight,
          extraHeadersPreflight,
          omittedHeadersPreflight,
          validPreflight,
          validGet,
        ],
        { allowedOrigin },
      );

      assert.deepStrictEqual(responses.slice(0, 3), ['', '', '']);
      assert.match(
        responses[3],
        /Access-Control-Allow-Origin: https:\/\/account\.snowflakecomputing\.com/i,
      );
      assert.match(responses[3], /Access-Control-Allow-Headers: Content-Type(?:\r\n|$)/i);
      assert.match(responses[3], /Access-Control-Allow-Methods: POST/i);
      assert.match(
        responses[4],
        /Access-Control-Allow-Origin: https:\/\/account\.snowflakecomputing\.com/i,
      );
      assert.match(responses[4], /Access-Control-Allow-Headers: Content-Type(?:\r\n|$)/i);
      assert.doesNotMatch(responses[4], /X-Custom/i);
      assert.strictEqual(outcome.resolved, validGet.split(/\r?\n/, 1)[0]);
    });

    it('accepts a matching POST callback and returns its Origin', async function () {
      const post =
        'POST /?token=post-token HTTP/1.1\r\nOrigin: https://account.snowflakecomputing.com\r\nContent-Length: 0\r\n\r\n';
      const { responses, outcome } = await runServerRequests([post], { allowedOrigin });

      assertHtmlOkResponse(responses[0]);
      assert.match(
        responses[0],
        /Access-Control-Allow-Origin: https:\/\/account\.snowflakecomputing\.com/i,
      );
      assert.strictEqual(outcome.resolved, post.split(/\r?\n/, 1)[0]);
    });

    it('reads Origin only from CRLF and LF header sections', async function () {
      const crlfBodyOrigin =
        'POST /?token=body-origin-crlf HTTP/1.1\r\nContent-Type: text/plain\r\n\r\nOrigin: https://account.snowflakecomputing.com';
      const lfBodyOrigin =
        'POST /?token=body-origin-lf HTTP/1.1\nContent-Type: text/plain\n\nOrigin: https://account.snowflakecomputing.com';
      const headerOriginWithForeignBodyOrigin =
        'POST /?token=header-origin HTTP/1.1\nOrigin: https://account.snowflakecomputing.com\nContent-Type: text/plain\n\nOrigin: https://other.snowflakecomputing.com';
      const { responses, outcome } = await runServerRequests(
        [crlfBodyOrigin, lfBodyOrigin, headerOriginWithForeignBodyOrigin],
        { allowedOrigin },
      );

      assert.deepStrictEqual(responses.slice(0, 2), ['', '']);
      assertHtmlOkResponse(responses[2]);
      assert.match(
        responses[2],
        /Access-Control-Allow-Origin: https:\/\/account\.snowflakecomputing\.com/i,
      );
      assert.doesNotMatch(responses[2], /other\.snowflakecomputing\.com/i);
      assert.strictEqual(outcome.resolved, headerOriginWithForeignBodyOrigin.split(/\r?\n/, 1)[0]);
    });

    it('accepts originless GET and Origin null without CORS headers', async function () {
      for (const request of [
        'GET /?token=originless HTTP/1.1\r\n\r\n',
        'GET /?token=null-origin HTTP/1.1\r\nOrigin: null\r\n\r\n',
      ]) {
        const { responses, outcome } = await runServerRequests([request], { allowedOrigin });

        assertHtmlOkResponse(responses[0]);
        assert.doesNotMatch(responses[0], /Access-Control-Allow-Origin/i);
        assert.strictEqual(outcome.resolved, request.split(/\r?\n/, 1)[0]);
      }
    });

    it('preserves custom rendering and callback errors', async function () {
      const success = await runServerRequests([validGet], {
        allowedOrigin,
        renderer: ({ error }) => (error ? `ERROR: ${error}` : 'CUSTOM'),
      });
      assert.match(success.responses[0], /CUSTOM$/);
      assert.strictEqual(success.outcome.rejected, null);

      const errorRequest =
        'GET /?error=access_denied&error_description=user+declined HTTP/1.1\r\n\r\n';
      const failure = await runServerRequests([errorRequest], {
        allowedOrigin,
        renderer: ({ error }) => `ERROR: ${error}`,
      });
      assert.match(failure.responses[0], /ERROR: .*access_denied/);
      assert.match(String(failure.outcome.rejected), /access_denied/);
      assert.strictEqual(failure.outcome.resolved, null);
    });
  });
});
