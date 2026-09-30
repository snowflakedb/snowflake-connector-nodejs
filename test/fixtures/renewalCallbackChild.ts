import assert from 'assert';
import { setTimeout as delay } from 'timers/promises';

const snowflake = require('../../index');
const accessUrl = process.argv[2];
const watchdog = setTimeout(() => process.exit(2), 8000);
const report = (message: string) => process.send!(message);
const callbackError = new Error('Synthetic callback failure');

// Only this disposable process survives the deliberate user exception. Without a
// handler Node terminates; callback delivery after process termination is not promised.
const caught = new Promise<void>((resolve) => {
  process.once('uncaughtException', (error) => {
    if (error !== callbackError) {
      process.stderr.write(String(error));
      process.exit(1);
    }
    report('caught');
    resolve();
  });
});

(async () => {
  const connection = snowflake.createConnection({
    account: 'synthetic',
    username: 'synthetic',
    password: 'synthetic',
    accessUrl,
    timeout: 5000,
  });
  await new Promise<void>((resolve, reject) =>
    connection.connect((error?: Error) => (error ? reject(error) : resolve())),
  );
  connection.execute({
    sqlText: 'SELECT 1',
    streamResult: true,
    complete: (error?: Error & { code?: string }) => {
      report(`throwing:${error?.code}`);
      throw callbackError;
    },
  });
  const deadline = Date.now() + 5000;
  while (true) {
    const response = await fetch(`${accessUrl}/__admin/requests/count`, {
      method: 'POST',
      signal: AbortSignal.timeout(1000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlPath: '/session/token-request' }),
    });
    assert.strictEqual(response.status, 200);
    if (((await response.json()) as { count: number }).count > 0) break;
    assert.ok(Date.now() < deadline, 'Renewal did not reach WireMock');
    await delay(10);
  }
  const queued = new Promise<void>((resolve) =>
    connection.execute({
      sqlText: 'SELECT 1',
      streamResult: true,
      complete: (error?: Error & { code?: string }) => {
        report(`queued:${error?.code}`);
        resolve();
      },
    }),
  );
  const destroyed = new Promise<void>((resolve) =>
    connection.destroy((error?: Error & { code?: number }) => {
      report(`destroy:${error?.code}`);
      resolve();
    }),
  );
  await Promise.all([caught, queued, destroyed]);
  assert.strictEqual(await connection.isValidAsync(), false);
  clearTimeout(watchdog);
  process.disconnect!();
})().catch((error) => {
  process.stderr.write(String(error));
  process.exit(1);
});
