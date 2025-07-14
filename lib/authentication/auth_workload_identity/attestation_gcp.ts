import Logger from '../../logger';
let mod: typeof import('google-auth-library') | null = null;
try {
  mod = require('google-auth-library');
} catch (error) {
  Logger().info('oogle-auth-library is not installed, skipping google-auth-library.');
}

export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

export async function getGcpAttestationToken() {
  if (mod != null) {
    const GoogleAuth = mod.GoogleAuth;
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
