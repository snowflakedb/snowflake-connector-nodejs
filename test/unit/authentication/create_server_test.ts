import assert from 'assert';
import net from 'net';
import authUtil from '../../../lib/authentication/authentication_util';

type RendererResult = { error: string | null };
type Renderer = (result: RendererResult) => string;

interface ServerResult {
  resolved: string | null;
  rejected: unknown | null;
}

// Spin up the callback server, send it a single HTTP request line over a raw
// TCP socket (mimicking the browser redirect), and collect both the raw HTTP
// response and the resolve/reject outcome of the surrounding promise. When
// `renderer` is omitted, createServer falls back to its built-in default.
function runServer(
  requestLine: string,
  renderer?: Renderer,
): Promise<{ response: string; outcome: ServerResult }> {
  return new Promise((resolveOuter, rejectOuter) => {
    const outcome: ServerResult = { resolved: null, rejected: null };

    const server = authUtil.createServer(
      (value: string) => {
        outcome.resolved = value;
      },
      (err: unknown) => {
        outcome.rejected = err;
      },
      renderer ? { renderer } : {},
    );

    server.on('error', rejectOuter);

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
        client.write(`${requestLine}\r\n\r\n`);
      });

      let response = '';
      client.setEncoding('utf8');
      client.on('data', (chunk) => {
        response += chunk;
      });
      // The server writes the response then destroys the socket, so we resolve
      // once the connection closes.
      client.on('close', () => {
        // Give the server's resolve/reject a tick to settle.
        setImmediate(() => resolveOuter({ response, outcome }));
      });
      client.on('error', () => {
        setImmediate(() => resolveOuter({ response, outcome }));
      });
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
});
