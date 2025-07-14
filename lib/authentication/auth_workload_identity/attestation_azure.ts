import Logger from '../../logger';
let AzureIdentity: typeof import('@azure/identity') | null = null;

try {
  AzureIdentity = require('@azure/identity');
} catch (error) {
  Logger().info('@azure/identity is not installed, skipping azure/identity.');
}

export const DEFAULT_AZURE_ENTRA_ID_RESOURCE = 'api://fd3f753b-eed3-462c-b6a7-a4b5bb650aad';

export async function getAzureAttestationToken(entraIdResource = DEFAULT_AZURE_ENTRA_ID_RESOURCE) {
  if (AzureIdentity != null) {
    const DefaultAzureCredential = AzureIdentity.DefaultAzureCredential;
    const credential = new DefaultAzureCredential({
      // NOTE:
      // We don't want retries because it makes auto-detect mode slow
      retryOptions: {
        maxRetries: 0,
      },
    });

    try {
      Logger().debug('Getting Azure auth token');
      const token = await credential.getToken(entraIdResource);
      return token.token;
    } catch (error) {
      Logger().debug(`Error getting Azure auth token: ${error}`);
      return null;
    }
  } else {
    return null;
  }
}
