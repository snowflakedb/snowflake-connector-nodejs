import assert from 'assert';
import sinon from 'sinon';
import { AxiosRequestConfig } from 'axios';
import axiosInstance from '../../lib/http/axios_instance';
import connParameters from './connectionParameters';
import AuthTest from './authTestsBaseClass';
import testUtil from '../integration/testUtil';

// This test is expected to work only on driverspreprod6.preprod6 where SESSION_TOKEN_VALIDITY
// is set to 60 seconds instead of the default 1 hour.
// It is important to cover this scenario using e2e instead of wiremock to ensure the server
// does not have a regression in session token renewal behavior.
describe('Session token renewal', function () {
  let authTest: InstanceType<typeof AuthTest>;
  let axiosRequestSpy: sinon.SinonSpy;

  beforeEach(async () => {
    authTest = new AuthTest();
    axiosRequestSpy = sinon.spy(axiosInstance, 'request');
  });

  afterEach(async () => {
    sinon.restore();
    await authTest.destroyConnection();
  });

  function getAxiosRequestsCount(matchingPath: string) {
    return axiosRequestSpy.getCalls().filter((c: sinon.SinonSpyCall) => {
      const reqOptions = c.args![0] as AxiosRequestConfig;
      return reqOptions.url?.includes(matchingPath);
    }).length;
  }

  it('renews session token after expiry', async function () {
    authTest.createConnection(connParameters.keypairPrivateKeyPath);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();

    // Wait for the session to expire
    await new Promise((resolve) => setTimeout(resolve, 61_000));

    // This query will fail once, trigger session token renewal, and succeed on retry
    const {
      rows: [sessionTokenValidity],
    } = await testUtil.executeCmdAsync(
      authTest.connection,
      "SHOW PARAMETERS LIKE 'SESSION_TOKEN_VALIDITY' IN ACCOUNT",
    );

    assert.strictEqual(parseInt(sessionTokenValidity['value']), 60);
    assert.strictEqual(getAxiosRequestsCount('query-request'), 2);
    assert.strictEqual(getAxiosRequestsCount('token-request'), 1);
  });
});
