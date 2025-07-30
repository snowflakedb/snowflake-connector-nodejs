import assert from 'assert';
import { execSync } from 'child_process';
import { WIP_ConnectionOptions } from '../lib/connection/types';
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

  it('connects with explicit provider', async () => {
    await connectAndVerify({
      ...baseConnectionOptions,
      workloadIdentityProvider: provider as WIP_ConnectionOptions['workloadIdentityProvider'],
    });
  });

  if (provider === 'GCP') {
    it('connects using OIDC', async () => {
      const token = execSync(
        'wget -O - --header="Metadata-Flavor: Google" "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/identity?audience=snowflakecomputing.com"',
      )
        .toString()
        .trim();
      if (!token) {
        throw new Error('Failed to retrieve GCP access token: empty response');
      }
      await connectAndVerify({
        ...baseConnectionOptions,
        workloadIdentityProvider: 'OIDC',
        token,
      });
    });
  }
});

async function connectAndVerify(connectionOptions: WIP_ConnectionOptions) {
  const connection = snowflake.createConnection(connectionOptions);
  await new Promise((resolve, reject) => {
    connection.connect((err?: Error) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
  const { rows } = await new Promise<{ statement: object; rows: object[] }>((resolve, reject) => {
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
  });
  assert.deepEqual(rows, [{ 1: 1 }]);
}
