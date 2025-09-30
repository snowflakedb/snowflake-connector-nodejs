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
  const impersonationPath = process.env.SNOWFLAKE_TEST_WIF_IMPERSONATION_PATH;
  const expectedUsername = process.env.SNOWFLAKE_TEST_WIF_USERNAME;
  const expectedUsernameImpersonation = process.env.SNOWFLAKE_TEST_WIF_USERNAME_IMPERSONATION;

  // NOTE: TypeScript needs such if instead of loop for proper type checking
  if (
    !account ||
    !host ||
    !provider ||
    !impersonationPath ||
    !expectedUsername ||
    !expectedUsernameImpersonation
  ) {
    throw new Error(`Test can run only on cloud VM with env variables set.`);
  }

  const connectionOptions: WIP_ConnectionOptions = {
    authenticator: 'WORKLOAD_IDENTITY',
    account: account,
    host: host,
    workloadIdentityProvider: provider as WIP_ConnectionOptions['workloadIdentityProvider'],
  };

  it(`connects using ${provider}`, async () => {
    await connectAndVerify(connectionOptions, expectedUsername);
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
      await connectAndVerify(
        {
          ...connectionOptions,
          workloadIdentityProvider: 'OIDC',
          token,
        },
        expectedUsername,
      );
    });
  }
});

async function connectAndVerify(
  connectionOptions: WIP_ConnectionOptions,
  expectedUsername: string,
) {
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
      sqlText: 'select current_user();',
      complete: (err: Error | null, statement: any, rows: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({ statement, rows });
        }
      },
    });
  });
  assert.deepEqual(rows, [{ 'CURRENT_USER()': expectedUsername }]);
}
