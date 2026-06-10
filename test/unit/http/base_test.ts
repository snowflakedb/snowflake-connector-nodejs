import assert from 'assert';
import sinon from 'sinon';
import axios from '../../../lib/http/axios_instance';

const { NodeHttpClient } = require('../../../lib/http/node');
const ConnectionConfig = require('../../../lib/connection/connection_config');

describe('HttpClient.request error handling', () => {
  let adapterStub: sinon.SinonStub;

  beforeEach(() => {
    adapterStub = sinon.stub();
    sinon.stub(axios.defaults, 'adapter').value(adapterStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  function createHttpClient() {
    const connectionConfig = new ConnectionConfig({
      username: 'username',
      password: 'password',
      account: 'account',
    });
    return new NodeHttpClient(connectionConfig);
  }

  it('invokes the error callback when a streaming response is interrupted (status but no data)', (done) => {
    // An interrupted streaming response: axios rejects after the status line was
    // received but before the body arrived, so err.response exists but its data
    // is undefined. The callback must surface this as an error, not a success.
    adapterStub.rejects({
      response: { status: 200, headers: {}, data: undefined },
      message: 'aborted',
      code: 'ECONNRESET',
    });

    createHttpClient().request({
      method: 'GET',
      url: 'https://s3.snowflake.com/chunk',
      callback: (err: unknown, _response: unknown, body: unknown) => {
        try {
          assert.ok(err, 'callback must receive an error for an interrupted stream');
          assert.strictEqual(body, null, 'body must be null when an error is reported');
          done();
        } catch (assertionError) {
          done(assertionError as Error);
        }
      },
    });
  });

  it('invokes the success callback with the error body when the response has data', (done) => {
    // A non-2xx response that still carries a body (e.g. S3 returning an XML
    // error) must keep being unwrapped and delivered as a successful callback.
    const errorBody = '<Error><Code>AccessDenied</Code></Error>';
    adapterStub.rejects({
      response: { status: 403, headers: {}, data: errorBody },
      message: 'Request failed with status code 403',
    });

    createHttpClient().request({
      method: 'GET',
      url: 'https://s3.snowflake.com/chunk',
      callback: (err: unknown, response: { statusCode?: number }, body: unknown) => {
        try {
          assert.strictEqual(err, null, 'error must be null when a response body is present');
          assert.strictEqual(body, errorBody, 'the error response body must be passed through');
          assert.strictEqual(response.statusCode, 403);
          done();
        } catch (assertionError) {
          done(assertionError as Error);
        }
      },
    });
  });
});
