import { GoogleAuth } from 'google-auth-library';

export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

export async function getGcpAttestationToken() {
  const auth = new GoogleAuth();

  try {
    const client = await auth.getIdTokenClient(SNOWFLAKE_AUDIENCE);
    const idToken = await client.idTokenProvider.fetchIdToken(SNOWFLAKE_AUDIENCE);
    return idToken;
  } catch (e) {
    return null;
  }
}
