const connParameters = require('./connectionParameters');
const AuthTest = require('./authTestsBaseClass');

describe('Okta authentication', function () {
  let authTest;

  beforeEach(async () => {
    authTest = new AuthTest();
  });
  
  afterEach(async () => {
    await authTest.destroyConnection();
  });

  it('Successful connection', async function () {
    const connectionOption = connParameters.okta;
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

  it('Wrong credentials', async function () {
    const connectionOption = { ...connParameters.okta, username: 'itsnotanaccount.com', password: 'fakepassword' };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Request failed with status code 401');
    await authTest.verifyConnectionIsNotUp();
  });

  it.skip('Wrong okta url', async function () {
    const connectionOption = { ...connParameters.okta, authenticator: 'https://testinvalidaccoount.com' };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('');
    await authTest.verifyConnectionIsNotUp();
  });
});
