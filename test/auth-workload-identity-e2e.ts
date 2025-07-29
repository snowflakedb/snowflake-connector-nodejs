// import assert from 'assert';
import { WIP_ConnectionOptions } from '../lib/connection/types';
// import { WorkloadIdentityProviderKey } from '../lib/authentication/auth_workload_identity/types';
// NOTE:
// Using require() as we can't pull types from index.d.ts
const snowflake = require('../lib/snowflake');

// Running this test locally:
// * Push branch to repository
// * Set environment variable PARAMETERS_SECRET
// * Run ci/test_wif.sh
describe('Workload Identity Authentication E2E', () => {
  const account = process.env.SNOWFLAKE_TEST_WIF_ACCOUNT;
  const host = process.env.SNOWFLAKE_TEST_WIF_HOST;
  const provider = process.env.SNOWFLAKE_TEST_WIF_PROVIDER;

  if (!account || !host || !provider) {
    throw new Error('Test can run only on cloud VM with env variables set');
  }

  const baseConnectionOptions: WIP_ConnectionOptions = {
    authenticator: 'WORKLOAD_IDENTITY',
    account,
    host,
  };

  it('connects in auto-detect mode', async () => {
    await connectAndVerify(baseConnectionOptions);
  });

  it.skip('connects with explicit provider', () => {});

  if (provider === 'GCP') {
    it.skip('connects using OIDC', () => {});
  }
});

async function connectAndVerify(connectionOption: WIP_ConnectionOptions) {
  const connection = snowflake.createConnection(connectionOption);
  await new Promise((resolve, reject) => {
    connection.connect((err?: Error) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
  const { statement, rows } = await new Promise<{ statement: object; rows: object[] }>(
    (resolve, reject) => {
      connection.execute({
        sqlText: 'select 1',
        complete: (err: Error | null, statement: any, rows: any) => {
          if (err) {
            reject(err);
          } else {
            resolve({ statement, rows });
          }
        },
      });
    },
  );
  console.log('statement', statement);
  console.log('rows', rows);
}
