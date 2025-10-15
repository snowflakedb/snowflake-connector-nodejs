import Logger from '../../logger';

export const DEFAULT_AZURE_ENTRA_ID_RESOURCE = 'api://fd3f753b-eed3-462c-b6a7-a4b5bb650aad';

export async function getAzureAttestationToken(
  options: {
    managedIdentityClientId?: string;
    entraIdResource?: string;
  } = {},
) {
  // @ts-ignore
  const DefaultAzureCredential = await import('@azure/identity').then(
    (e) => e.DefaultAzureCredential,
  );
  const credential = new DefaultAzureCredential({
    managedIdentityClientId: options.managedIdentityClientId,
  });

  Logger().debug('Getting Azure auth token');
  const token = await credential.getToken(
    options.entraIdResource ?? DEFAULT_AZURE_ENTRA_ID_RESOURCE,
  );
  return token.token;
}
