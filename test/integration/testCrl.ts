import assert from 'assert';
import sinon from 'sinon';
import { WIP_ConnectionOptions } from '../../lib/connection/types';
import ErrorCode from '../../lib/error_code';
import { CertificateRevokedError, CRL_VALIDATOR_INTERNAL } from '../../lib/agent/crl_validator';
import { createConnection, connectAsync, destroyConnectionAsync } from './testUtil';
import { httpsAgentCache } from '../../lib/http/node';
import axiosInstance from '../../lib/http/axios_instance';
import { startProxyServer, ProxyServer } from '../proxy_server';

async function testCrlConnection(connectionOptions?: Partial<WIP_ConnectionOptions>) {
  const connection = createConnection({
    certRevocationCheckMode: 'ENABLED',
    ...connectionOptions,
  });
  await connectAsync(connection);
  await destroyConnectionAsync(connection);
}

describe('connection with CRL validation', () => {
  const certificateRevokedError = new CertificateRevokedError('Certificate is revoked');
  const regularError = new Error('CRL validation failed');

  afterEach(() => {
    httpsAgentCache.clear();
    sinon.restore();
  });

  it('allows connection for valid certificate and includes CRL value in the login request', async () => {
    const axiosRequestSpy = sinon.spy(axiosInstance, 'request');
    const validateCrlSpy = sinon.spy(CRL_VALIDATOR_INTERNAL, 'validateCrl');
    await assert.doesNotReject(testCrlConnection());
    assert.strictEqual(validateCrlSpy.callCount, 1);
    const loginRequestData = axiosRequestSpy.getCall(0).args[0].data as any;
    assert.strictEqual(
      loginRequestData.data.CLIENT_ENVIRONMENT.CERT_REVOCATION_CHECK_MODE,
      'ENABLED',
    );
  });

  describe('Proxy connection', () => {
    let proxyServer: ProxyServer;

    before(async () => {
      proxyServer = await startProxyServer();
    });

    after(async () => {
      await proxyServer.shutdown();
    });

    it('goes through crl validation', async () => {
      const validateCrlSpy = sinon.spy(CRL_VALIDATOR_INTERNAL, 'validateCrl');
      await assert.doesNotReject(
        testCrlConnection({
          proxyHost: '127.0.0.1',
          proxyPort: proxyServer.port,
        }),
      );
      assert.strictEqual(validateCrlSpy.callCount, 1);
    });
  });

  [
    {
      name: 'fails for CertificateRevokedError in ENABLED mode',
      isAdvisory: false,
      throwError: certificateRevokedError,
      expectsWrappedError: certificateRevokedError,
    },
    {
      name: 'fails for regular Error in ENABLED mode',
      isAdvisory: false,
      throwError: regularError,
      expectsWrappedError: regularError,
    },
    {
      name: 'fails for CertificateRevokedError in ADVISORY mode',
      isAdvisory: true,
      throwError: certificateRevokedError,
      expectsWrappedError: certificateRevokedError,
    },
    {
      name: 'passes for regular Error in ADVISORY mode',
      isAdvisory: true,
      throwError: regularError,
      expectsWrappedError: false,
    },
  ].forEach(({ name, isAdvisory, throwError, expectsWrappedError }) => {
    it(name, async () => {
      sinon.stub(CRL_VALIDATOR_INTERNAL, 'validateCrl').throws(throwError);
      const testConnectionPromise = testCrlConnection({
        certRevocationCheckMode: isAdvisory ? 'ADVISORY' : 'ENABLED',
      });
      if (expectsWrappedError) {
        await assert.rejects(testConnectionPromise, (err: any) => {
          assert.strictEqual(err.name, 'NetworkError');
          assert.strictEqual(err.message, throwError.message);
          assert.strictEqual(err['cause']?.['code'], ErrorCode.ERR_CRL_ERROR);
          return true;
        });
      } else {
        await assert.doesNotReject(testConnectionPromise);
      }
    });
  });
});
