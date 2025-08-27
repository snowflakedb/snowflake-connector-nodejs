import assert from 'assert';
import sinon from 'sinon';
import { WIP_ConnectionOptions } from '../../lib/connection/types';
import * as connectionOptions from './connectionOptions';
import ErrorCode from '../../lib/error_code';
import { CRL_VALIDATOR_INTERNAL } from '../../lib/agent/crl_validator';
import { createCrlError } from '../../lib/errors';
import { createTestCertificate } from '../unit/agent/test_utils';
const snowflake = require('../../lib/snowflake');

describe('connection with CRL validation', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('allows connection for valid certificate', async () => {
    const validateCrlSpy = sinon.spy(CRL_VALIDATOR_INTERNAL, 'validateCrl');
    await assert.doesNotReject(connect(connectionOptions.valid as WIP_ConnectionOptions));
    assert.strictEqual(validateCrlSpy.callCount, 1);
  });

  it('throws error for invalid certificate', async () => {
    const error = createCrlError(createTestCertificate(), 'CRL validation failed');
    sinon.stub(CRL_VALIDATOR_INTERNAL, 'validateCrl').throws(error);
    await assert.rejects(
      connect(connectionOptions.valid as WIP_ConnectionOptions),
      assertNetworkErrorCausedByCrl(new RegExp(error.message)),
    );
  });
});

async function connect(connectionOptions: WIP_ConnectionOptions) {
  const connection = snowflake.createConnection({
    certRevocationCheckMode: 'ENABLED',
    ...connectionOptions,
  });
  return new Promise((resolve, reject) => {
    connection.connect((err?: Error) => {
      if (err) {
        reject(err);
      } else {
        connection.destroy();
        resolve(null);
      }
    });
  });
}

function assertNetworkErrorCausedByCrl(msg: RegExp) {
  return (err: any) => {
    assert.strictEqual(err.name, 'NetworkError');
    assert.match(err.message, msg);
    assert.strictEqual(err['cause']?.['code'], ErrorCode.ERR_CRL_ERROR);
    return true;
  };
}
