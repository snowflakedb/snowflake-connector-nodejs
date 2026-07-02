/**
 * Layer-1 end-to-end test for the PrivateLink OCSP GET fix (SNOW-3725838).
 *
 * Starts a local HTTP server that acts as the Snowflake /retry proxy,
 * forces the driver into PrivateLink mode via env var, then makes a TLS
 * connection to a host whose cert uses oneocsp.microsoft.com/ocsp.
 * Asserts the proxy receives GET (not POST), the /ocsp/ path segment is
 * preserved, and the base64 is URL-encoded.
 */

import http from 'http';
import https from 'https';
import assert from 'assert';
import HttpsOcspAgentDefault from '../../../lib/agent/https_ocsp_agent';

// The module does not export TypeScript types, so cast to a constructor that
// satisfies the https.request `agent` option.
type OcspAgentConstructor = new (options: {
  protocol: string;
  hostname: string;
  keepAlive: boolean;
}) => https.Agent;
const HttpsOcspAgent = HttpsOcspAgentDefault as unknown as OcspAgentConstructor;

const log = (...args: unknown[]) => process.stdout.write(args.join(' ') + '\n');
const logError = (...args: unknown[]) => process.stderr.write(args.join(' ') + '\n');

const PROXY_PORT = 19999;
const TARGET_HOST = 'pvdmwqsfcb1stg.blob.core.windows.net'; // Microsoft TLS G2 RSA CA cert

interface ProxyEntry {
  method: string;
  path: string;
}

const received: ProxyEntry[] = [];

const proxy = http.createServer((req, res) => {
  if (req.url === '/ocsp_response_cache.json') {
    // Return empty cache so driver is forced to do live OCSP checks
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
    return;
  }

  if (req.url && req.url.startsWith('/retry/')) {
    const entry: ProxyEntry = { method: req.method ?? 'UNKNOWN', path: req.url };
    received.push(entry);
    log(`  → proxy received: ${req.method} ${req.url}`);

    // /retry/oneocsp.microsoft.com/ocsp/{b64} → forward to real responder
    const withoutRetry = req.url.slice('/retry/'.length);
    const slash = withoutRetry.indexOf('/');
    const responderHost = withoutRetry.slice(0, slash);
    const responderPath = withoutRetry.slice(slash);

    log(`  → forwarding to: GET http://${responderHost}${responderPath}`);

    const fwd = http.request(
      { hostname: responderHost, port: 80, path: responderPath, method: 'GET' },
      (upstream) => {
        log(`  → upstream response: ${upstream.statusCode}`);
        res.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(res);
      },
    );
    fwd.on('error', (e: Error) => {
      logError('  → forward error:', e.message);
      res.writeHead(502);
      res.end(e.message);
    });
    fwd.end();
    return;
  }

  res.writeHead(404);
  res.end();
});

proxy.listen(PROXY_PORT, () => {
  log(`Mock proxy listening on http://localhost:${PROXY_PORT}`);
  process.env['SF_OCSP_RESPONSE_CACHE_SERVER_URL'] =
    `http://localhost:${PROXY_PORT}/ocsp_response_cache.json`;

  const agent = new HttpsOcspAgent({
    protocol: 'https:',
    hostname: TARGET_HOST,
    keepAlive: false,
  });

  log(`Making TLS connection to ${TARGET_HOST} via HttpsOcspAgent...`);

  const req = https.request(
    { hostname: TARGET_HOST, path: '/', method: 'HEAD', agent, timeout: 10000 },
    (tlsRes) => {
      log(`  TLS+HTTP succeeded, HTTP status: ${tlsRes.statusCode}`);
      tlsRes.resume();
      check();
    },
  );
  req.on('timeout', () => {
    req.destroy();
  });
  req.on('error', (err: Error) => {
    // HTTP-level errors (403, reset) are fine – OCSP fires during TLS, before HTTP
    log(`  HTTP layer result: ${err.message} (expected for private storage)`);
    check();
  });
  req.end();
});

function check() {
  proxy.close();
  log('\n--- Assertions ---');

  const ocsp = received.filter((r) => r.path.startsWith('/retry/'));
  assert.ok(ocsp.length > 0, 'FAIL: no OCSP request reached the proxy');
  log(`PASS: proxy received ${ocsp.length} OCSP retry request(s)`);

  // Every request must be GET and must have URL-encoded b64
  for (const r of ocsp) {
    assert.strictEqual(r.method, 'GET', `FAIL: expected GET but got ${r.method} for ${r.path}`);

    const b64part = r.path.split('/').pop() ?? '';
    const hasEncoding =
      b64part.includes('%2F') || b64part.includes('%3D') || b64part.includes('%2B');
    assert.ok(
      hasEncoding,
      `FAIL: base64 must be URL-encoded (expected %2F/%3D/%2B) but got: ${b64part}`,
    );
  }
  log(`PASS: all ${ocsp.length} requests used GET with URL-encoded base64`);

  // At least one request must have gone through oneocsp.microsoft.com/ocsp/
  // (the cert chain for *.blob.core.windows.net — the customer's failing case)
  // The root cert in the chain is DigiCert-signed so ocsp.digicert.com also appears; that is expected.
  const msOcsp = ocsp.filter((r) => r.path.includes('/oneocsp.microsoft.com/ocsp/'));
  assert.ok(
    msOcsp.length > 0,
    `FAIL: expected at least one request to oneocsp.microsoft.com/ocsp/ but got only: ${ocsp.map((r) => r.path).join(', ')}`,
  );
  log(`PASS: ${msOcsp.length} request(s) routed through oneocsp.microsoft.com/ocsp/`);

  log('\n✓ All assertions passed – fix is working end-to-end.');
}
