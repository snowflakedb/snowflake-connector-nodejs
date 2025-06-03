const connParameters = require('./connectionParameters');
const AuthTest = require('./authTestsBaseClass');

describe('Okta Client Credentials authentication', function () {
  let authTest;

  beforeEach(async () => {
    authTest = new AuthTest();
  });

  afterEach(async () => {
    await authTest.destroyConnection();
  });

  it('Successful connection', async function () {
    const connectionOption = connParameters.oauthOktaClientCredentials;
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

  it('Unauthorized client credentials', async function () {
    const connectionOption = { ...connParameters.oauthOktaClientCredentials, oauthClientId: 'invalidClientId' };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Error while getting access token. Message: Request failed with status code 400');
    await authTest.verifyConnectionIsNotUp();
  });

  it('Mismatched username', async function () {
    const connectionOption = { ...connParameters.oauthOktaClientCredentials, username: 'invalidUser@snowflake.com' };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('The user you were trying to authenticate as differs from the user tied to the access token.');
    await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
  });
});
