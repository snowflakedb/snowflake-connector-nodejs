import { GoogleAuth } from 'google-auth-library';
import Logger from '../../logger';

export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

export async function getGcpAttestationToken() {
  const auth = new GoogleAuth();

  try {
    const client = await auth.getIdTokenClient(SNOWFLAKE_AUDIENCE);
    const idToken = await client.idTokenProvider.fetchIdToken(SNOWFLAKE_AUDIENCE);
    return idToken;
  } catch (error) {
    Logger().debug(`Error getting Azure managed identity token: ${error}`);
    return null;
  }
}
