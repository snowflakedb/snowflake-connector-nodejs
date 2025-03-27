const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');
const authUtil = require('../../../lib/authentication/authentication_util');
const GlobalConfig = require('../../../lib/global_config');
const { get } = require('axios');

describe('Oauth Authorization Code authentication', function () {
  let port;
  let authTest;
  let wireMock;
  before(async () => {
    port = await getFreePort();
    wireMock = await runWireMockAsync(port);
  });
  beforeEach(async () => {
    authTest = new AuthTest();
  });
  afterEach(async () => {
    wireMock.scenarios.resetAllScenarios();
    // console.log(await wireMock.requests.getUnmatchedRequests());
  });
  after(async () => {
    await wireMock.global.shutdown();
  });

  it('Successful flow scenario Authorization Code flow', async function () {
    GlobalConfig.setCustomRedirectingClient((redirectUri) =>  {
      const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
      return authUtil.withBrowserActionTimeout(3000, get(url));
    }
    );
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/authorization_code/successful_flow.json');
    const connectionOption = { ...connParameters.oauthAuthorizationCodeOnWiremock,
      ...{
        port: port,
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
      }
    };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

  it('Successful flow scenario Authorization Code flow - error', async function () {
    GlobalConfig.setCustomRedirectingClient((redirectUri) =>  {
      const url = `${redirectUri.searchParams.get('redirect_uri')}?error=invalid_scope&error_description=One+or+more+scopes+are+not+configured+for+the+authorization+server+resource.`;
      return authUtil.withBrowserActionTimeout(3000, get(url));
    }
    );
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/authorization_code/successful_flow.json');
    const connectionOption = { ...connParameters.oauthAuthorizationCodeOnWiremock,
      ...{
        port: port,
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
      }
    };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Error while getting oauth authorization code. ErrorCode invalid_scope. Message: One or more scopes are not configured for the authorization server resource.');
    await authTest.verifyConnectionIsNotUp();
  });

  //invalid state
  it('Authorization Code flow - invalid state', async function () {
    GlobalConfig.setCustomRedirectingClient((redirectUri) =>  {
      const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=invalidState}`;
      return authUtil.withBrowserActionTimeout(3000, get(url));
    }
    );
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/authorization_code/successful_flow.json');
    const connectionOption = { ...connParameters.oauthAuthorizationCodeOnWiremock,
      ...{
        port: port,
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
      }
    };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('unexpected "state" response parameter value');
  });

  //invalidCode
  it('Successful flow scenario Authorization Code flow - invalid code', async function () {
    GlobalConfig.setCustomRedirectingClient((redirectUri) =>  {
      const url = `${redirectUri.searchParams.get('redirect_uri')}?code=invalidCode&state=${redirectUri.searchParams.get('state')}`;
      return authUtil.withBrowserActionTimeout(3000, get(url));
    }
    );
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/authorization_code/token_request_error.json');
    const connectionOption = { ...connParameters.oauthAuthorizationCodeOnWiremock,
      ...{
        port: port,
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
      }
    };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Error while getting access token. Message: Request failed with status code 400');
  });


  //invalidCode
  it('Successful flow scenario Authorization Code flow - no token', async function () {
    GlobalConfig.setCustomRedirectingClient((redirectUri) =>  {
      const url = `${redirectUri.searchParams.get('redirect_uri')}?code=invalidCode&state=${redirectUri.searchParams.get('state')}`;
      return authUtil.withBrowserActionTimeout(3000, get(url));
    }
    );
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/authorization_code/token_request_error.json');
    const connectionOption = { ...connParameters.oauthAuthorizationCodeOnWiremock,
      ...{
        port: port,
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
      }
    };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Error while getting access token. Message: Request failed with status code 400');
  });

});
