import assert from 'assert';
import { WIP_ConnectionOptions } from '../../lib/connection/types';
import * as connectionOptions from './connectionOptions';
import ErrorCode from '../../lib/error_code';
const snowflake = require('../../lib/snowflake');

describe('CRL validation', () => {
  it('throws error that validation is not implemented', async () => {
    await assert.rejects(
      connect({
        ...(connectionOptions.valid as WIP_ConnectionOptions),
        certRevocationCheckMode: 'ENABLED',
      }),
      assertNetworkErrorCausedByCrl(/CRL validation not implemented/),
    );
  });
});

async function connect(connectionOptions: WIP_ConnectionOptions) {
  const connection = snowflake.createConnection(connectionOptions);
  return new Promise((resolve, reject) => {
    connection.connect((err?: Error) => {
      if (err) {
        reject(err);
      } else {
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
