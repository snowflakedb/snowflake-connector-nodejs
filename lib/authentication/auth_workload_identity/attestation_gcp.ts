import { GoogleAuth } from 'google-auth-library';
import Logger from '../../logger';

export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

export async function getGcpAttestationToken(impersonationPath: string[] = []) {
  let auth = new GoogleAuth();

  for (const serviceAccount of impersonationPath) {
    Logger().debug(`Getting GCP auth token from service account: ${serviceAccount}`);
    const authClient = await auth.getClient();
    const accessTokenResponse = await authClient.getAccessToken();
    if (!accessTokenResponse.token) {
      throw new Error(`Failed to get access token from service account: ${serviceAccount}`);
    }

    const credentialsResponse = await fetch(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessTokenResponse.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: ['https://www.googleapis.com/auth/cloud-platform'],
          lifetime: '3600s',
        }),
      },
    );

    if (!credentialsResponse.ok) {
      const errorText = await credentialsResponse.text();
      throw new Error(`HTTP ${credentialsResponse.status}: ${errorText}`);
    }

    const responseData = (await credentialsResponse.json()) as { accessToken?: string };

    if (responseData.accessToken) {
      throw new Error(
        `Failed to get credentials from impersonation service account ${serviceAccount}`,
      );
    }

    auth = new GoogleAuth({
      credentials: {
        type: 'service_account',
        refresh_token: responseData.accessToken,
      },
    });
  }

  Logger().debug('Getting GCP auth token');
  const client = await auth.getIdTokenClient(SNOWFLAKE_AUDIENCE);
  const idToken = await client.idTokenProvider.fetchIdToken(SNOWFLAKE_AUDIENCE);
  return idToken;
}
