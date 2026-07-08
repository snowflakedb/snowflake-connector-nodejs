import assert from 'assert';
import sinon from 'sinon';
import http from 'http';
import { EventEmitter } from 'events';
import untypedCheckModule from '../../../lib/agent/check';

const checkModule = untypedCheckModule as unknown as {
  (options: unknown, cb: (...args: unknown[]) => void): void;
  buildOcspRetryUrl: (cacheServerUrl: string, ocspResponderUri: string, b64data: string) => string;
  _testInternals: {
    ocsp: {
      request: { generate: (...args: unknown[]) => unknown };
      utils: { getAuthorityInfo: (...args: unknown[]) => void };
    };
    CertUtil: {
      verifyOCSPResponse: (...args: unknown[]) => unknown;
    };
  };
};

const PRIVATELINK_CACHE_SERVER_URL =
  'http://ocsp.account.west-europe.privatelink.snowflakecomputing.com/ocsp_response_cache.json';

describe('buildOcspRetryUrl', () => {
  it('preserves AIA path, URL-encodes base64 special characters, and uses the full responder URI', () => {
    const url = checkModule.buildOcspRetryUrl(
      'http://ocsp.testaccount.west-europe.privatelink.snowflakecomputing.com/ocsp_response_cache.json',
      'http://oneocsp.microsoft.com/ocsp',
      'MHcwdTBOMEwwSjAHBgUrDgMCGgQUYcFEmNMfy7ixyYCnS34JagPL6fsEFNBMg9GOcS49NLH/m3ksjnTU4ng+GAxNJ==',
    );
    assert.strictEqual(
      url,
      'http://ocsp.testaccount.west-europe.privatelink.snowflakecomputing.com/retry/oneocsp.microsoft.com/ocsp/MHcwdTBOMEwwSjAHBgUrDgMCGgQUYcFEmNMfy7ixyYCnS34JagPL6fsEFNBMg9GOcS49NLH%2Fm3ksjnTU4ng%2BGAxNJ%3D%3D',
    );
  });

  it('omits the bare root slash so there is no double slash in the retry URL', () => {
    const url = checkModule.buildOcspRetryUrl(
      PRIVATELINK_CACHE_SERVER_URL,
      'http://ocsp.snowflake.com/',
      'abc123',
    );
    assert.strictEqual(
      url,
      'http://ocsp.account.west-europe.privatelink.snowflakecomputing.com/retry/ocsp.snowflake.com/abc123',
    );
  });

  it('preserves non-standard port and path from the AIA OCSP URI', () => {
    const url = checkModule.buildOcspRetryUrl(
      PRIVATELINK_CACHE_SERVER_URL,
      'http://ocsp.snowflake.com:8080/ocsp',
      'abc123',
    );
    assert.strictEqual(
      url,
      'http://ocsp.account.west-europe.privatelink.snowflakecomputing.com/retry/ocsp.snowflake.com:8080/ocsp/abc123',
    );
  });
});

describe('Check HTTP method selection', () => {
  let capturedOptions: http.RequestOptions;
  let capturedEndArg: unknown;

  beforeEach(() => {
    const { ocsp, CertUtil } = checkModule._testInternals;

    sinon.stub(ocsp.request, 'generate').returns({
      data: Buffer.from('mock-ocsp-request'),
      cert: {},
      issuer: {},
    });

    sinon.stub(ocsp.utils, 'getAuthorityInfo').callsFake((...args: unknown[]) => {
      const cb = args[2] as (err: Error | null, uri: string) => void;
      cb(null, 'http://oneocsp.snowflake.com/ocsp');
    });

    sinon.stub(CertUtil, 'verifyOCSPResponse').returns({ err: null });

    sinon.stub(http, 'request').callsFake((...args: unknown[]) => {
      capturedOptions = args[0] as http.RequestOptions;
      const onResponse = args[1] as (res: unknown) => void;

      const fakeReq = new EventEmitter() as any;
      fakeReq.end = sinon.stub().callsFake((...endArgs: unknown[]) => {
        capturedEndArg = endArgs[0];
      });
      fakeReq.abort = sinon.stub();

      const fakeRes = new EventEmitter() as any;
      fakeRes.statusCode = 200;
      fakeRes.read = () => Buffer.from('mock-ocsp-response');

      setTimeout(() => {
        onResponse(fakeRes);
        fakeRes.emit('readable');
        fakeRes.emit('end');
      }, 0);

      return fakeReq;
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('PrivateLink mode: uses GET with no body and routes through the proxy preserving the AIA path', function (done) {
    sinon.stub(process, 'env').value({
      ...process.env,
      SF_OCSP_RESPONSE_CACHE_SERVER_URL: PRIVATELINK_CACHE_SERVER_URL,
    });

    checkModule({ cert: {}, issuer: {} }, () => {
      assert.strictEqual(capturedOptions.method, 'GET');
      assert.ok(
        capturedEndArg == null,
        `expected end() with no body but got: ${String(capturedEndArg)}`,
      );
      const fullPath = String(capturedOptions.hostname) + String(capturedOptions.path ?? '');
      assert.ok(
        fullPath.includes('privatelink.snowflakecomputing.com'),
        `expected privatelink hostname but got: ${fullPath}`,
      );
      assert.ok(
        fullPath.includes('/retry/oneocsp.snowflake.com/ocsp/'),
        `expected AIA /ocsp path to be preserved but got: ${fullPath}`,
      );
      done();
    });
  });

  it('standard (non-PrivateLink) mode: uses POST with binary OCSP request body', function (done) {
    sinon.stub(process, 'env').value({
      ...process.env,
      SF_OCSP_RESPONSE_CACHE_SERVER_URL: undefined,
    });

    checkModule({ cert: {}, issuer: {} }, () => {
      assert.strictEqual(capturedOptions.method, 'POST');
      assert.ok(
        Buffer.isBuffer(capturedEndArg),
        'expected end() to be called with a Buffer for POST',
      );
      done();
    });
  });
});
