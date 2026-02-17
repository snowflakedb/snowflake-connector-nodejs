import { GoogleAuth, Impersonated } from 'google-auth-library';
import Logger from '../../logger';

export const SNOWFLAKE_AUDIENCE = 'snowflakecomputing.com';

export async function getGcpAttestationToken(impersonationPath?: string[]) {
  const auth = new GoogleAuth();

  if (impersonationPath) {
    Logger().debug(
      `Getting GCP auth token from impersonation path: ${impersonationPath.join(', ')}`,
    );
    const impersonated = new Impersonated({
      sourceClient: await auth.getClient(),
      targetPrincipal: impersonationPath[impersonationPath.length - 1],
      delegates: impersonationPath.slice(0, -1),
    });
    return await impersonated.fetchIdToken(SNOWFLAKE_AUDIENCE);
  }

  Logger().debug('Getting GCP auth token from default credentials');
  const client = await auth.getIdTokenClient(SNOWFLAKE_AUDIENCE);
  return await client.idTokenProvider.fetchIdToken(SNOWFLAKE_AUDIENCE);
}
