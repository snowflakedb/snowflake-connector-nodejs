const assert = require('assert');
const connParameters = require('./connectionParameters');
const axios = require('axios');
const { snowflakeAuthTestOktaUser, snowflakeAuthTestOktaPass, snowflakeAuthTestRole, snowflakeAuthTestOauthClientId,
  snowflakeAuthTestOauthClientSecret, snowflakeAuthTestOauthUrl
} = require('./connectionParameters');
const AuthTest = require('./authTestsBaseClass');


describe('Oauth authentication', function () {
  let authTest;

  beforeEach(async () => {
    authTest = new AuthTest();
  });

  afterEach(async () => {
    await authTest.destroyConnection();
  });

  it('Successful connection', async function () {
    const token = await getToken();
    const connectionOption = { ...connParameters.oauth, token: token };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

  it('Invalid token', async function () {
    const connectionOption = { ...connParameters.oauth, token: 'invalidToken' };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Invalid OAuth access token. ');
    await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
  });

  it('Mismatched username', async function () {
    const token = await getToken();
    const connectionOption = { ...connParameters.oauth, username: 'itsnotanaccount.com', token: token };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('The user you were trying to authenticate as differs from the user tied to the access token.');
    await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
  });
});

async function getToken() {
  const response =  await axios.post(snowflakeAuthTestOauthUrl, data, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    auth: {
      username: snowflakeAuthTestOauthClientId,
      password: snowflakeAuthTestOauthClientSecret
    }
  });
  assert.strictEqual(response.status, 200, 'Failed to get access token');
  return response.data.access_token;
}

const data = [
  `username=${snowflakeAuthTestOktaUser}`,
  `password=${snowflakeAuthTestOktaPass}`,
  'grant_type=password',
  `scope=session:role:${snowflakeAuthTestRole.toLowerCase()}`
].join('&');
