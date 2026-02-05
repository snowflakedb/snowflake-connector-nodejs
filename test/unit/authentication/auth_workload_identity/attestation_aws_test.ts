import { vi } from 'vitest';
import assert from 'assert';
import * as OriginalAttestationAws from '../../../../lib/authentication/auth_workload_identity/attestation_aws';
import { assertAwsAttestationToken, AWS_CREDENTIALS, AWS_REGION } from './test_utils';

// Create mock functions outside describe to use in vi.mock
const awsSdkMock = {
  getDefaultCredentials: vi.fn(),
  getMetadataRegion: vi.fn(),
  sendStsCommand: vi.fn().mockReturnValue({ Credentials: null }),
};
const noCredentialsError = new Error('No credentials found');
const noRegionError = new Error('No region found');

// Mock AWS SDK modules at module level
vi.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: () => awsSdkMock.getDefaultCredentials,
}));

vi.mock('@aws-sdk/client-sts', () => ({
  AssumeRoleCommand: class {},
  STSClient: class {
    send = () => awsSdkMock.sendStsCommand();
  },
}));

vi.mock('@aws-sdk/ec2-metadata-service', () => ({
  MetadataService: class {
    request = () => awsSdkMock.getMetadataRegion();
  },
}));

describe('Attestation AWS', () => {
  let AttestationAws: typeof OriginalAttestationAws;
  let originalAwsRegion: string | undefined;

  before(async () => {
    // Save and clear AWS_REGION to prevent it from affecting tests
    originalAwsRegion = process.env.AWS_REGION;
    delete process.env.AWS_REGION;
    // Import after mocks are set up
    AttestationAws =
      await import('../../../../lib/authentication/auth_workload_identity/attestation_aws');
  });

  after(() => {
    // Restore AWS_REGION
    if (originalAwsRegion !== undefined) {
      process.env.AWS_REGION = originalAwsRegion;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    awsSdkMock.getDefaultCredentials.mockImplementation(() => {
      throw noCredentialsError;
    });
    awsSdkMock.getMetadataRegion.mockImplementation(() => {
      throw noRegionError;
    });
    awsSdkMock.sendStsCommand.mockReturnValue({ Credentials: null });
  });

  describe('getAwsCredentials', () => {
    it('throws error when no credentials are found', async () => {
      await assert.rejects(AttestationAws.getAwsCredentials(AWS_REGION), noCredentialsError);
    });

    it('throws error when fails to fetch impersonation role credentials', async () => {
      awsSdkMock.getDefaultCredentials.mockReturnValue(AWS_CREDENTIALS);
      await assert.rejects(
        AttestationAws.getAwsCredentials(AWS_REGION, ['impersonation-role']),
        /Failed to get credentials from impersonation role impersonation-role/,
      );
    });

    it('returns credentials from default provider', async () => {
      awsSdkMock.getDefaultCredentials.mockReturnValue(AWS_CREDENTIALS);
      assert.strictEqual(await AttestationAws.getAwsCredentials(AWS_REGION), AWS_CREDENTIALS);
    });

    it('returns credentials from impersonation role', async () => {
      const impersonationCredentials = {
        AccessKeyId: 'impersonation-access-key-id',
        SecretAccessKey: 'impersonation-secret-access-key',
      };
      awsSdkMock.getDefaultCredentials.mockReturnValue(AWS_CREDENTIALS);
      awsSdkMock.sendStsCommand.mockReturnValue({ Credentials: impersonationCredentials });
      assert.deepEqual(await AttestationAws.getAwsCredentials(AWS_REGION, ['impersonation-role']), {
        accessKeyId: impersonationCredentials.AccessKeyId,
        secretAccessKey: impersonationCredentials.SecretAccessKey,
        sessionToken: undefined,
      });
    });
  });

  describe('getAwsRegion', () => {
    it('returns process.env.AWS_REGION when available', async () => {
      vi.stubEnv('AWS_REGION', 'region-from-env');
      assert.strictEqual(await AttestationAws.getAwsRegion(), 'region-from-env');
    });

    it('throws error when metadata service fails', async () => {
      await assert.rejects(AttestationAws.getAwsRegion(), noRegionError);
    });

    it('returns region when metadata service returns a region', async () => {
      awsSdkMock.getMetadataRegion.mockReturnValue(AWS_REGION);
      assert.strictEqual(await AttestationAws.getAwsRegion(), AWS_REGION);
    });
  });

  describe('getStsHostname', () => {
    it('returns valid name for china region', () => {
      assert.strictEqual(
        AttestationAws.getStsHostname('cn-northwest-1'),
        'sts.cn-northwest-1.amazonaws.com.cn',
      );
    });

    it('returns valid name for non-china region', () => {
      assert.strictEqual(AttestationAws.getStsHostname('us-east-1'), 'sts.us-east-1.amazonaws.com');
    });
  });

  describe('getAwsAttestationToken', () => {
    it('throws error when no credentials are found', async () => {
      awsSdkMock.getMetadataRegion.mockReturnValue(AWS_REGION);
      await assert.rejects(AttestationAws.getAwsAttestationToken(), noCredentialsError);
    });

    it('returns error when no region is found', async () => {
      await assert.rejects(AttestationAws.getAwsAttestationToken(), noRegionError);
    });

    it('returns a valid attestation token', async () => {
      awsSdkMock.getDefaultCredentials.mockReturnValue(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.mockReturnValue(AWS_REGION);
      const token = await AttestationAws.getAwsAttestationToken();
      assertAwsAttestationToken(token, AWS_REGION);
    });
  });
});
