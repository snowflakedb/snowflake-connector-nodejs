import assert from 'assert';
import sinon from 'sinon';
import os from 'os';
import { WIP_ConnectionOptions } from '../../lib/connection/types';
import * as connectionOptions from './connectionOptions';
import ErrorCode from '../../lib/error_code';
import { CRL_VALIDATOR_INTERNAL } from '../../lib/agent/crl_validator';
import { createCrlError } from '../../lib/errors';
import { createTestCertificate } from '../unit/agent/test_utils';
import { createConnection, connectAsync, destroyConnectionAsync } from './testUtil';
import { httpsAgentCache } from '../../lib/http/node';

async function testCrlConnection(connectionOptions?: WIP_ConnectionOptions) {
  const connection = createConnection({
    certRevocationCheckMode: 'ENABLED',
    ...connectionOptions,
  });
  await connectAsync(connection);
  await destroyConnectionAsync(connection);
}

describe('connection with CRL validation', () => {
  afterEach(() => {
    httpsAgentCache.clear();
    sinon.restore();
  });

  it('allows connection for valid certificate', async () => {
    const validateCrlSpy = sinon.spy(CRL_VALIDATOR_INTERNAL, 'validateCrl');
    await assert.doesNotReject(testCrlConnection());
    assert.strictEqual(validateCrlSpy.callCount, 1);
  });

  if (os.platform() === 'linux' && !process.env.SHOULD_SKIP_PROXY_TESTS) {
    it.skip('allows proxy connection for valid certificate', async () => {
      const validateCrlSpy = sinon.spy(CRL_VALIDATOR_INTERNAL, 'validateCrl');
      await assert.doesNotReject(
        testCrlConnection(connectionOptions.connectionWithProxy as WIP_ConnectionOptions),
      );
      assert.strictEqual(validateCrlSpy.callCount, 1);
    });
  }

  it('throws error for invalid certificate', async () => {
    const certificate = createTestCertificate();
    const error = createCrlError(certificate, 'CRL validation failed');
    sinon.stub(CRL_VALIDATOR_INTERNAL, 'validateCrl').throws(error);
    await assert.rejects(
      testCrlConnection(connectionOptions.valid as WIP_ConnectionOptions),
      (err: any) => {
        assert.strictEqual(err.name, 'NetworkError');
        assert.strictEqual(err.message, error.message);
        assert.strictEqual(err['cause']?.['certificate'], certificate);
        assert.strictEqual(err['cause']?.['code'], ErrorCode.ERR_CRL_ERROR);
        return true;
      },
    );
  });
});
