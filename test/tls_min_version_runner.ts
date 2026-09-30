/*
 * Child-process harness for the minimum-TLS-version tests (testMinTlsVersion.ts).
 *
 * This runs out of process for two reasons: the TLS floor under test is process-wide
 * (the parent sets it through NODE_OPTIONS, the way an operator would), and
 * NODE_EXTRA_CA_CERTS - which makes the mock servers' certificate trusted - is only
 * read at startup.
 *
 * Emits exactly one RESULT_MARKER line so the parent can find it in stdout.
 */
// core.js is untyped, so follow the require idiom the other TypeScript tests use.
const snowflake = require('../lib/snowflake').default;
import { connectAsync, executeCmdAsync } from './integration/testUtil';

export const RESULT_MARKER = '##TLS_MIN_VERSION_RESULT##';

export interface RunnerResult {
  /** 'ok', or a description of the error that failed the connection. */
  connect: string;
  /** 'ok', or a description of the error that failed the PUT. Absent if no PUT was requested. */
  put?: string;
}

/**
 * Flattens an error and its `cause` chain: the AWS SDK and axios both wrap the
 * underlying TLS error, and the cause is where the protocol-version detail lives.
 */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current = error as (Error & { code?: string; cause?: unknown }) | undefined;

  for (let depth = 0; current && depth < 5; depth++) {
    parts.push(`${current.code ?? current.name ?? 'Error'}: ${current.message}`);
    current = current.cause as typeof current;
  }

  return parts.join(' <- ');
}

async function main() {
  const accessUrl = process.env.TLS_TEST_ACCESS_URL;
  const putFilePath = process.env.TLS_TEST_PUT_FILE;
  if (!accessUrl) {
    throw new Error('TLS_TEST_ACCESS_URL is required');
  }

  // Revocation checking is orthogonal to version negotiation, and the mock certificate
  // carries no OCSP responder - leaving OCSP on would reach for the public OCSP cache.
  snowflake.configure({ logLevel: 'OFF', disableOCSPChecks: true });

  const connection = snowflake.createConnection({
    accessUrl,
    account: 'tlsminversiontest',
    username: 'testuser',
    password: 'testpassword',
    // A TLS floor violation is retried like any other network error (7 attempts with
    // backoff by default, which takes minutes). One retry is enough to show the failure.
    sfRetryMaxLoginRetries: 1,
  });

  const result: RunnerResult = { connect: 'ok' };
  try {
    await connectAsync(connection);
  } catch (err) {
    result.connect = describeError(err);
    process.stdout.write(`${RESULT_MARKER}${JSON.stringify(result)}\n`);
    process.exit(0);
  }

  if (putFilePath) {
    try {
      await executeCmdAsync(connection, `PUT file://${putFilePath} @~ AUTO_COMPRESS=FALSE`);
      result.put = 'ok';
    } catch (err) {
      result.put = describeError(err);
    }
  }

  process.stdout.write(`${RESULT_MARKER}${JSON.stringify(result)}\n`);
  // Exit rather than close the connection: keep-alive agents and the mock servers would
  // otherwise hold the event loop open, and the session teardown adds nothing here.
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`runner failed: ${describeError(err)}\n`);
    process.exit(1);
  });
}
