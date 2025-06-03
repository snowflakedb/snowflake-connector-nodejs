const connParameters = require('./connectionParameters');
const AuthTest = require('./authTestsBaseClass');
const snowflake = require('../../lib/snowflake');
const testUtil = require('../integration/testUtil');
const { snowflakeAuthTestSnowflakeUser, snowflakeAuthTestSnowflakeInternalRole } = require('./connectionParameters');


describe('PAT authentication', function () {
  let authTest, patName;

  beforeEach(async () => {
    authTest = new AuthTest();
  });

  afterEach(async () => {
    await authTest.destroyConnection();
    await deletePAT();
  });

  it('Successful connection', async function () {
    const token = await getPAT();
    const connectionOption = { ...connParameters.PATCredentials, token: token };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

  it('Invalid PAT', async function () {
    const connectionOption = { ...connParameters.PATCredentials, token: 'invalidToken' };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Programmatic access token is invalid.');
    await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
  });

  it('Mismatched username', async function () {
    const token = await getPAT();
    const connectionOption = { ...connParameters.PATCredentials, username: 'differentUsername', token: token };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Programmatic access token is invalid.');
    await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
  });
  
  async function getPAT() {
    patName = 'PAT_NODEJS_' + generateTimestampSuffix();
    const command = `alter user ${snowflakeAuthTestSnowflakeUser} add programmatic access token ${patName} ROLE_RESTRICTION = '${snowflakeAuthTestSnowflakeInternalRole}'`;
    return await connectUsingDifferentAuthMethodAndExecuteCommand(command, true);
  }

  async function deletePAT() {
    try {
      const command = `alter user ${snowflakeAuthTestSnowflakeUser} remove programmatic access token ${patName}`;
      await connectUsingDifferentAuthMethodAndExecuteCommand(command, true);
    } catch (error) { 
      // ignore error
    }
  }

  async function connectUsingDifferentAuthMethodAndExecuteCommand(command, shouldReturnToken) {
    const connectionOption = connParameters.okta;
    const connection = snowflake.createConnection(connectionOption);
    await connection.connectAsync();
    const rows = await testUtil.executeCmdAsync(connection, command);
    if (shouldReturnToken) {
      return rows[0]['token_secret'];
    }
    return null;
  }

  function generateTimestampSuffix() {
    return Date.now();
  }
});

