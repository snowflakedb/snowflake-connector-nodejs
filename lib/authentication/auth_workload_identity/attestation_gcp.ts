import { GoogleAuth } from 'google-auth-library';
import Logger from '../../logger';

export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

export async function getGcpAttestationToken() {
  const auth = new GoogleAuth();

  Logger().debug('Getting GCP auth token');
  const client = await auth.getIdTokenClient(SNOWFLAKE_AUDIENCE);
  const idToken = await client.idTokenProvider.fetchIdToken(SNOWFLAKE_AUDIENCE);
  return idToken;
}
