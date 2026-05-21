/* oxlint-disable no-console */
// NOTE:
// Smoke test executed by Bun against the packed `snowflake-sdk` tarball.
//
// We do not run the full mocha test suite on Bun because our unit tests rely on
// import-mocking libraries (`rewiremock`, `mock-require`) that are not compatible
// with Bun's module loader. Instead, this single smoke test exercises the most
// important end-to-end path on Bun:
//   - import the published package shape (`snowflake-sdk`)
//   - establish a real connection using the same credentials mocha uses
//   - run `select 1` and verify the result
//
// Connection options are re-derived from `SNOWFLAKE_TEST_*` env vars (the same
// ones consumed by `test/integration/connectionOptions.js`) rather than imported
// from that file, so this script has no dependency on the repo source tree and
// runs against the installed package.

import snowflake from 'snowflake-sdk';
import assert from 'node:assert/strict';

const protocol = process.env.SNOWFLAKE_TEST_PROTOCOL ?? 'https';
const account = process.env.SNOWFLAKE_TEST_ACCOUNT;
if (!account) {
  throw new Error('SNOWFLAKE_TEST_ACCOUNT is not set');
}
const host = process.env.SNOWFLAKE_TEST_HOST ?? `${account}.snowflakecomputing.com`;
const port = process.env.SNOWFLAKE_TEST_PORT ?? '443';
const accessUrl = `${protocol}://${host}:${port}`;

const privateKeyPath = process.env.SNOWFLAKE_TEST_PRIVATE_KEY_FILE;
const keypairOptions = privateKeyPath
  ? {
      privateKeyPath,
      authenticator: process.env.SNOWFLAKE_TEST_AUTHENTICATOR ?? 'SNOWFLAKE_JWT',
    }
  : {};

const connection = snowflake.createConnection({
  accessUrl,
  username: process.env.SNOWFLAKE_TEST_USER,
  password: process.env.SNOWFLAKE_TEST_PASSWORD,
  account,
  warehouse: process.env.SNOWFLAKE_TEST_WAREHOUSE,
  database: process.env.SNOWFLAKE_TEST_DATABASE,
  schema: process.env.SNOWFLAKE_TEST_SCHEMA,
  role: process.env.SNOWFLAKE_TEST_ROLE,
  host,
  ...keypairOptions,
});

const setupConnection = (): Promise<void> =>
  new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

const executeQuery = (sqlText: string): Promise<unknown[]> =>
  new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, _stmt, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows ?? []);
        }
      },
    });
  });

const destroyConnection = (): Promise<void> =>
  new Promise((resolve, reject) => {
    connection.destroy((err) => (err ? reject(err) : resolve()));
  });

(async () => {
  console.time('[bun-smoke] connect');
  await setupConnection();
  console.timeEnd('[bun-smoke] connect');
  assert.equal(connection.isUp(), true, 'connection should be up after connect()');

  console.time('[bun-smoke] select 1');
  const rows = await executeQuery('select 1');
  console.timeEnd('[bun-smoke] select 1');
  assert.deepStrictEqual(rows, [{ '1': 1 }]);

  console.time('[bun-smoke] destroy');
  await destroyConnection();
  console.timeEnd('[bun-smoke] destroy');

  console.log('[bun-smoke] passed');
})();
