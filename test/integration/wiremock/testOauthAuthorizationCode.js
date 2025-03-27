const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');
const authUtil = require('../../../lib/authentication/authentication_util');
const GlobalConfig = require('../../../lib/global_config');
const { get } = require('axios');
const JsonCredentialManager = require('../../../lib/authentication/secure_storage/json_credential_manager');
const Util = require('../../../lib/util');
const AuthenticationTypes = require('../../../lib/authentication/authentication_types');

describe('Oauth Authorization Code authentication', function () {
  let port, authTest, wireMock, accessTokenKey, refreshTokenKey, connectionOption;

  before(async () => {
    const defaultCredentialManager = new JsonCredentialManager();
    port = await getFreePort();
    wireMock = await runWireMockAsync(port);
    GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
    connectionOption = { ...connParameters.oauthAuthorizationCodeOnWiremock,
      ...{
        port: port,
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
      }
    };
    accessTokenKey = Util.buildCredentialCacheKey(connectionOption.host,
      connectionOption.username, AuthenticationTypes.OAUTH_AUTHORIZATION_CODE + 'access_token');
    refreshTokenKey = Util.buildCredentialCacheKey(connectionOption.host,
      connectionOption.username, AuthenticationTypes.OAUTH_AUTHORIZATION_CODE + 'refresh_token');
  });

  beforeEach(async () => {
    authTest = new AuthTest();
    await GlobalConfig.getCredentialManager().remove(accessTokenKey);
    await GlobalConfig.getCredentialManager().remove(refreshTokenKey);
  });

  afterEach(async () => {
    wireMock.scenarios.resetAllScenarios();
    wireMock.mappings.resetAllMappings();
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
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Error while getting access token. Message: Request failed with status code 400');
  });

  it('Experimental authentication flag is not enabled ', async function () {
    const connOption = { ...connParameters.oauthAuthorizationCodeOnWiremock, enableExperimentalAuthentication: false };
    await authTest.createConnection(connOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Wrong authorization type Failed to initialize authenticator: Error: Following authentication method not yet supported: OAUTH_AUTHORIZATION_CODE');
  });
});
