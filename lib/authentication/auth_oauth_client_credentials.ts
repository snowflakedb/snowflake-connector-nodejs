import Logger from '../logger';
import * as authUtil from '../authentication/authentication_util';
import { dynamicImportESMInTypescriptWithCommonJS, format } from '../util';
import AuthenticationTypes from './authentication_types';
import { AuthClass, AuthRequestBody } from './types';
import { WIP_ConnectionConfig } from '../connection/types';
import type * as OauthType from 'oauth4webapi';

class AuthOauthClientCredentials implements AuthClass {
  _oauthImport!: typeof OauthType;
  token!: string;

  constructor(
    private connectionConfig: WIP_ConnectionConfig,
    private httpClient: any
  ) { }

  async getOauth4webapi() {
    if (!this._oauthImport) {
      this._oauthImport = await dynamicImportESMInTypescriptWithCommonJS('oauth4webapi');
    }
    return this._oauthImport;
  };

  updateBody(body: AuthRequestBody) {
    if (this.token) {
      body['data']['TOKEN'] = this.token;
    }
    body['data']['AUTHENTICATOR'] = AuthenticationTypes.OAUTH_AUTHENTICATOR;
    body['data']['OAUTH_TYPE'] = AuthenticationTypes.OAUTH_CLIENT_CREDENTIALS;
  };

  async authenticate() {
    const clientId = this.connectionConfig.getOauthClientId();
    const clientSecret = this.connectionConfig.getOauthClientSecret();
    const scope = await authUtil.prepareScope(this.connectionConfig);

    const parameters = new URLSearchParams();
    parameters.set('scope', scope);
    if (this.connectionConfig.oauthEnableSingleUseRefreshTokens) {
      parameters.set('enable_single_use_refresh_tokens', 'true');
    }

    this.token = await this.requestToken(clientId, clientSecret, parameters);
  }

  async reauthenticate(body: AuthRequestBody) {
    await this.authenticate();
    this.updateBody(body);
  }

  async requestToken(clientId: string, clientSecret: string, parameters: URLSearchParams) {
    const oauth = await this.getOauth4webapi();
    const tokenUrl = authUtil.getTokenUrl(this.connectionConfig);
    const as = {
      // An issuer is an obligatory parameter in validation processed by oauth4webapi library, even when it isn't used
      issuer: 'UNKNOWN',
      // eslint-disable-next-line camelcase
      token_endpoint: tokenUrl.href
    };
    const client = {
      // eslint-disable-next-line camelcase
      client_id: clientId
    };

    try {
      Logger().debug(`Executing token request: ${tokenUrl.href}`);
      const clientAuth = oauth.ClientSecretPost(clientSecret);
      const response = await oauth.clientCredentialsGrantRequest(as, client, clientAuth, parameters, {
        [oauth.allowInsecureRequests]: this.connectionConfig.getOauthHttpAllowed(),
        [oauth.customFetch]: async (url, options) => {
          const response = await this.httpClient.requestAsync({ url, ...options });
          return new Response(response.json, {
            status: response.statusCode,
            statusText: response.statusText,
            headers: response.headers
          });
        }
      });
      const result = await oauth.processClientCredentialsResponse(as, client, response);

      if (result.access_token) {
        Logger().debug(`Received new OAuth access token from: ${tokenUrl.href}`);
      } else {
        throw Error(`Response doesn't contain OAuth access token. Requested URI: ${tokenUrl.href}`);
      }
      return result.access_token;
    } catch (error: any) {
      throw new Error(format('Error while getting access token. Message: %s', error.message));
    }
  }
}

export default AuthOauthClientCredentials;
