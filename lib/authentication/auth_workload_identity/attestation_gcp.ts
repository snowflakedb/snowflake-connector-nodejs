import Logger from '../../logger';
let AuthLibrary: typeof import('google-auth-library') | null = null;
try {
  AuthLibrary = require('google-auth-library');
} catch (error) {
  Logger().info('oogle-auth-library is not installed, skipping google-auth-library.');
}

export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

export async function getGcpAttestationToken() {
  if (AuthLibrary != null) {
    const GoogleAuth = AuthLibrary.GoogleAuth;
    const auth = new GoogleAuth();

    try {
      Logger().debug('Getting GCP auth token');
      const client = await auth.getIdTokenClient(SNOWFLAKE_AUDIENCE);
      const idToken = await client.idTokenProvider.fetchIdToken(SNOWFLAKE_AUDIENCE);
      return idToken;
    } catch (error) {
      Logger().debug(`Error getting GCP token: ${error}`);
      return null;
    }
  } else {
    return null;
  }
}
