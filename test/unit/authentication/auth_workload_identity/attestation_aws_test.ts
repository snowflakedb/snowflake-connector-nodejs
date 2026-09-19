import sinon from 'sinon';
import assert from 'assert';
import rewiremock from 'rewiremock/node';
import * as OriginalAttestationAws from '../../../../lib/authentication/auth_workload_identity/attestation_aws';
import {
  assertAwsAttestationToken,
  AWS_CREDENTIALS,
  AWS_REGION,
  AWS_WEB_IDENTITY_TOKEN,
} from './test_utils';

class FakeAssumeRoleCommand {}
class FakeGetWebIdentityTokenCommand {}

describe('Attestation AWS', () => {
  const sinonSandbox = sinon.createSandbox();
  const awsSdkMock = {
    getDefaultCredentials: sinonSandbox.stub(),
    getMetadataRegion: sinonSandbox.stub(),
    sendAssumeRole: sinonSandbox.stub().returns({ Credentials: null }),
    sendGetWebIdentityToken: sinonSandbox.stub(),
  };
  const noCredentialsError = new Error('No credentials found');
  const noRegionError = new Error('No region found');

  let AttestationAws: typeof OriginalAttestationAws;
  let stsClientConfigs: Record<string, unknown>[] = [];

  before(() => {
    // NOTE:
    // Sinon can't stub frozen AWS SDK properties, so we need to mock entire require
    rewiremock('@aws-sdk/credential-provider-node').with({
      defaultProvider: () => awsSdkMock.getDefaultCredentials,
    });
    rewiremock('@aws-sdk/client-sts').with({
      AssumeRoleCommand: FakeAssumeRoleCommand,
      GetWebIdentityTokenCommand: FakeGetWebIdentityTokenCommand,
      STSClient: class {
        constructor(config: Record<string, unknown>) {
          stsClientConfigs.push(config);
        }
        send = (command: unknown) => {
          if (command instanceof FakeGetWebIdentityTokenCommand) {
            return awsSdkMock.sendGetWebIdentityToken();
          }
          return awsSdkMock.sendAssumeRole();
        };
      },
    });
    rewiremock('@aws-sdk/ec2-metadata-service').with({
      MetadataService: class {
        request = () => awsSdkMock.getMetadataRegion();
      },
    });
    rewiremock.enable();
    AttestationAws = require('../../../../lib/authentication/auth_workload_identity/attestation_aws');
  });

  beforeEach(() => {
    sinonSandbox.restore();
    stsClientConfigs = [];
    awsSdkMock.sendAssumeRole.resetHistory();
    awsSdkMock.sendGetWebIdentityToken.resetHistory();
    awsSdkMock.getDefaultCredentials.resetHistory();
    awsSdkMock.getMetadataRegion.resetHistory();
    awsSdkMock.getDefaultCredentials.throws(noCredentialsError);
    awsSdkMock.getMetadataRegion.throws(noRegionError);
    awsSdkMock.sendAssumeRole.returns({ Credentials: null });
    awsSdkMock.sendGetWebIdentityToken.returns({ WebIdentityToken: AWS_WEB_IDENTITY_TOKEN });
  });

  after(() => {
    rewiremock.disable();
  });

  describe('getAwsCredentials', () => {
    it('throws error when no credentials are found', async () => {
      await assert.rejects(AttestationAws.getAwsCredentials(AWS_REGION), noCredentialsError);
    });

    it('throws error when fails to fetch impersonation role credentials', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      await assert.rejects(
        AttestationAws.getAwsCredentials(AWS_REGION, ['impersonation-role']),
        /Failed to get credentials from impersonation role impersonation-role/,
      );
    });

    it('returns credentials from default provider', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      assert.strictEqual(await AttestationAws.getAwsCredentials(AWS_REGION), AWS_CREDENTIALS);
    });

    it('returns credentials from impersonation role', async () => {
      const impersonationCredentials = {
        AccessKeyId: 'impersonation-access-key-id',
        SecretAccessKey: 'impersonation-secret-access-key',
      };
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.sendAssumeRole.returns({ Credentials: impersonationCredentials });
      assert.deepEqual(await AttestationAws.getAwsCredentials(AWS_REGION, ['impersonation-role']), {
        accessKeyId: impersonationCredentials.AccessKeyId,
        secretAccessKey: impersonationCredentials.SecretAccessKey,
        sessionToken: undefined,
      });
    });
  });

  describe('getAwsRegion', () => {
    it('returns process.env.AWS_REGION when available', async () => {
      sinonSandbox.stub(process, 'env').value({ AWS_REGION: 'region-from-env' });
      assert.strictEqual(await AttestationAws.getAwsRegion(), 'region-from-env');
    });

    it('throws error when metadata service fails', async () => {
      await assert.rejects(AttestationAws.getAwsRegion(), noRegionError);
    });

    it('returns region when metadata service returns a region', async () => {
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
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
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      await assert.rejects(AttestationAws.getAwsAttestationToken(), noCredentialsError);
    });

    it('throws error when no region is found', async () => {
      await assert.rejects(AttestationAws.getAwsAttestationToken(), noRegionError);
    });

    it('returns a valid SigV4 attestation token by default', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      const token = await AttestationAws.getAwsAttestationToken();
      assertAwsAttestationToken(token, AWS_REGION);
    });

    it('throws error when STS returns no WebIdentityToken with outbound token', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      awsSdkMock.sendGetWebIdentityToken.returns({});
      await assert.rejects(
        AttestationAws.getAwsAttestationToken({ useOutboundToken: true }),
        /Failed to obtain AWS web identity token from STS/,
      );
    });

    it('returns the WebIdentityToken JWT from STS with outbound token', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      const token = await AttestationAws.getAwsAttestationToken({ useOutboundToken: true });
      assert.strictEqual(token, AWS_WEB_IDENTITY_TOKEN);
    });

    it('does not override the SDK endpoint without workloadIdentityHost', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      await AttestationAws.getAwsAttestationToken({ useOutboundToken: true });
      assert.strictEqual(stsClientConfigs.length, 1);
      assert.strictEqual(stsClientConfigs[0].endpoint, undefined);
    });

    it('signs the SigV4 token for the workloadIdentityHost', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      const token = await AttestationAws.getAwsAttestationToken({
        workloadIdentityHost: 'sts.wif.snowflake.com',
      });
      assertAwsAttestationToken(token, AWS_REGION, 'sts.wif.snowflake.com');
    });

    it('points the SDK at the workloadIdentityHost with outbound token', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      const token = await AttestationAws.getAwsAttestationToken({
        useOutboundToken: true,
        workloadIdentityHost: 'sts.wif.snowflake.com',
      });
      assert.strictEqual(token, AWS_WEB_IDENTITY_TOKEN);
      assert.strictEqual(stsClientConfigs.length, 1);
      const [config] = stsClientConfigs;
      assert.strictEqual(
        (config.endpoint as { url: URL }).url.href,
        'https://sts.wif.snowflake.com/',
      );
      assert.strictEqual(config.useFipsEndpoint, false);
      assert.strictEqual(config.useDualstackEndpoint, false);
    });

    it('points the impersonation client at the workloadIdentityHost', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      awsSdkMock.sendAssumeRole.returns({
        Credentials: { AccessKeyId: 'key', SecretAccessKey: 'secret' },
      });
      await AttestationAws.getAwsAttestationToken({
        impersonationPath: ['impersonation-role'],
        workloadIdentityHost: 'sts.wif.snowflake.com',
      });
      assert.strictEqual(stsClientConfigs.length, 1);
      assert.strictEqual(
        (stsClientConfigs[0].endpoint as { url: URL }).url.href,
        'https://sts.wif.snowflake.com/',
      );
    });

    it('rejects a malformed workloadIdentityHost before looking up region or credentials', async () => {
      await assert.rejects(
        AttestationAws.getAwsAttestationToken({
          workloadIdentityHost: 'ftp://sts.custom.snowflake.com',
        }),
        /must use https or http, got scheme "ftp"/,
      );
      sinon.assert.notCalled(awsSdkMock.getMetadataRegion);
      sinon.assert.notCalled(awsSdkMock.getDefaultCredentials);
    });
  });

  describe('parseWorkloadIdentityHost', () => {
    // [name, input, expected url.origin]
    const validCases: [string, string, string][] = [
      ['bare host', 'sts.wif.snowflake.com', 'https://sts.wif.snowflake.com'],
      ['host with port', 'sts.custom.snowflake.com:8443', 'https://sts.custom.snowflake.com:8443'],
      ['full URL', 'https://sts.custom.snowflake.com', 'https://sts.custom.snowflake.com'],
      [
        'trailing slashes',
        'https://sts.custom.snowflake.com///',
        'https://sts.custom.snowflake.com',
      ],
      ['http scheme', 'http://sts.custom.snowflake.com', 'http://sts.custom.snowflake.com'],
      [
        'surrounding whitespace',
        '  sts.custom.snowflake.com  ',
        'https://sts.custom.snowflake.com',
      ],
      ['uppercase host', 'STS.Custom.Snowflake.COM', 'https://sts.custom.snowflake.com'],
    ];

    for (const [name, host, expectedOrigin] of validCases) {
      it(`accepts ${name}`, () => {
        const endpoint = AttestationAws.parseWorkloadIdentityHost(host);
        assert.strictEqual(endpoint.url.origin, expectedOrigin);
        assert.strictEqual(endpoint.overridden, true);
      });
    }

    it('keeps a path prefix', () => {
      const endpoint = AttestationAws.parseWorkloadIdentityHost(
        'https://sts.custom.snowflake.com/custom/',
      );
      assert.strictEqual(endpoint.url.origin, 'https://sts.custom.snowflake.com');
      assert.strictEqual(endpoint.url.pathname, '/custom');
    });

    const invalidCases: [string, string, RegExp][] = [
      ['empty value', '   ', /workloadIdentityHost is empty/],
      [
        'unsupported scheme',
        'ftp://sts.custom.snowflake.com',
        /must use https or http, got scheme "ftp"/,
      ],
      [
        'query',
        'https://sts.custom.snowflake.com?Action=Foo',
        /must not contain user info, a query or a fragment/,
      ],
      [
        'fragment',
        'https://sts.custom.snowflake.com#frag',
        /must not contain user info, a query or a fragment/,
      ],
      // pragma: allowlist nextline secret
      [
        'user info',
        'https://user:pass@sts.custom.snowflake.com',
        /must not contain user info, a query or a fragment/,
      ],
    ];

    for (const [name, host, expectedError] of invalidCases) {
      it(`rejects ${name}`, () => {
        assert.throws(() => AttestationAws.parseWorkloadIdentityHost(host), expectedError);
      });
    }
  });
});
