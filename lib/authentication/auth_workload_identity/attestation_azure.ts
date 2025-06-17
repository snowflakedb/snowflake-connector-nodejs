import { DefaultAzureCredential } from '@azure/identity';
import Logger from '../../logger';

export const DEFAULT_AZURE_ENTRA_ID_RESOURCE = 'api://fd3f753b-eed3-462c-b6a7-a4b5bb650aad';

export async function getAzureAttestationToken(entraIdResource = DEFAULT_AZURE_ENTRA_ID_RESOURCE) {
  const credential = new DefaultAzureCredential();

  try {
    Logger().debug("Getting Azure auth token");
    const token = await credential.getToken(entraIdResource);
    return token.token;
  } catch (error) {
    Logger().debug(`Error getting Azure auth token: ${error}`);
    return null;
  }
}
