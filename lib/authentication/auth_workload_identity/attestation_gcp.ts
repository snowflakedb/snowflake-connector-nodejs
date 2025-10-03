import { GoogleAuth, Impersonated } from 'google-auth-library';
import Logger from '../../logger';

export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

process.env.GOOGLE_SDK_NODE_LOGGING = '*';

export async function getGcpAttestationToken(impersonationPath: string[] = []) {
  let auth = new GoogleAuth();

  let currentClient = await auth.getClient();
  for (const serviceAccount of impersonationPath) {
    Logger().debug(`Getting GCP auth token from service account: ${serviceAccount}`);
    currentClient = new Impersonated({
      sourceClient: currentClient,
      targetPrincipal: serviceAccount,
      // targetScopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  if (impersonationPath.length > 0) {
    const idToken = await (currentClient as Impersonated).fetchIdToken(SNOWFLAKE_AUDIENCE);
    return idToken;
  }

  Logger().debug('Getting GCP auth token');
  const client = await auth.getIdTokenClient(SNOWFLAKE_AUDIENCE);
  const idToken = await client.idTokenProvider.fetchIdToken(SNOWFLAKE_AUDIENCE);
  return idToken;
}

// import { GoogleAuth, Impersonated } from 'google-auth-library';

// export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

// export async function getGcpAttestationToken() {
//   const auth = new GoogleAuth();

//   Logger().debug('Getting GCP auth token');

//   // Obtain the default credentials
//   const { credential } = await auth.getApplicationDefault();

//   // Define the impersonated service account and scopes
//   const impersonatedServiceAccount = 'name@project.service.gserviceaccount.com'; // Replace with your service account
//   const targetScopes = ['https://www.googleapis.com/auth/cloud-platform'];

//   // Create the impersonated credentials
//   const impersonatedCredentials = new Impersonated({
//     sourceClient: credential,
//     targetPrincipal: impersonatedServiceAccount,
//     targetScopes,
//     lifetime: 300, // Token lifetime in seconds
//   });

//   // Fetch the ID token for the target audience
//   const idToken = await impersonatedCredentials.fetchIdToken(SNOWFLAKE_AUDIENCE, {
//     includeEmail: true,
//   });

//   return idToken;
// }

// for (const serviceAccount of impersonationPath) {
//   Logger().debug(`Getting GCP auth token from service account: ${serviceAccount}`);
//   const authClient = await auth.getClient();
//   const accessTokenResponse = await authClient.getAccessToken();
//   if (!accessTokenResponse.token) {
//     throw new Error(`Failed to get access token from service account: ${serviceAccount}`);
//   }

//   const credentialsResponse = await fetch(
//     `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
//     {
//       method: 'POST',
//       headers: {
//         Authorization: `Bearer ${accessTokenResponse.token}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         scope: ['https://www.googleapis.com/auth/cloud-platform'],
//         lifetime: '3600s',
//       }),
//     },
//   );

//   if (!credentialsResponse.ok) {
//     const errorText = await credentialsResponse.text();
//     throw new Error(`HTTP ${credentialsResponse.status}: ${errorText}`);
//   }

//   const responseData = (await credentialsResponse.json()) as { accessToken?: string };

//   if (responseData.accessToken) {
//     throw new Error(
//       `Failed to get credentials from impersonation service account ${serviceAccount}`,
//     );
//   }

//   auth = new GoogleAuth({
//     credentials: {
//       type: 'service_account',
//       refresh_token: responseData.accessToken,
//     },
//   });
// }
