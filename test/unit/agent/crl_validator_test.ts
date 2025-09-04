import assert from 'assert';
import { WireMockRestClient } from 'wiremock-rest-client';
import { validateCrl, CRLValidatorConfig } from '../../../lib/agent/crl_validator';
import { createCertificateKeyPair, createTestCertificate, createTestCRL } from './test_utils';
import { getFreePort } from '../../../lib/util';
import { runWireMockAsync } from '../../wiremockRunner';
import ASN1 from 'asn1.js-rfc5280';
import { createCertificateChain } from './test_utils';

describe('validateCrl', () => {
  const validatorConfig: CRLValidatorConfig = {
    checkMode: 'ENABLED',
    allowCertificatesWithoutCrlURL: false,
    inMemoryCache: true,
    onDiskCache: false,
    downloadTimeoutMs: 5000,
  };
  let wireMock: WireMockRestClient;
  let wireMockCrlUrl: string;

  before(async () => {
    const port = await getFreePort();
    wireMock = await runWireMockAsync(port, { logLevel: 'warn' });
    wireMockCrlUrl = `http://127.0.0.1:${port}/crl/cert.crl`;
  });

  beforeEach(async () => {
    await wireMock.mappings.resetAllMappings();
  });

  after(async () => {
    await wireMock.global.shutdown();
  });

  async function addWireMockCrlMapping(crl: ASN1.CertificateListDecoded) {
    const encodedCrl = ASN1.CertificateList.encode(crl, 'der');
    return wireMock.mappings.createMapping({
      request: {
        urlPath: '/crl/cert.crl',
        method: 'GET',
      },
      response: {
        status: 200,
        base64Body: Buffer.from(new Uint8Array(encodedCrl)).toString('base64'),
      },
    });
  }

  it('passes for short-lived certificate', async () => {
    const certificate = createTestCertificate({
      notBefore: 'Mar 15 2024 00:00:00 GMT',
      notAfter: 'Mar 22 2024 00:00:00 GMT',
    });
    const chain = createCertificateChain(certificate, createTestCertificate());
    assert.doesNotThrow(() => validateCrl(chain, validatorConfig));
  });

  it('handles certificate without CRL URL', async () => {
    const certificate = createTestCertificate();
    const chain = createCertificateChain(certificate, createTestCertificate());
    assert.rejects(
      validateCrl(chain, validatorConfig),
      /Certificate CN=Test Certificate does not have CRL http URL/,
    );
    assert.doesNotReject(() =>
      validateCrl(chain, { ...validatorConfig, allowCertificatesWithoutCrlURL: true }),
    );
  });

  it('passes validation', async () => {
    const rootKeyPair = createCertificateKeyPair();
    const crl = createTestCRL({ issuerKeyPair: rootKeyPair });
    await addWireMockCrlMapping(crl);
    const chain = createCertificateChain(
      createTestCertificate({
        crlUrls: [wireMockCrlUrl],
      }),
      createTestCertificate({ keyPair: rootKeyPair }),
    );
    const result = await validateCrl(chain, validatorConfig);
    assert.strictEqual(result, true);
  });

  it('fails for crl with invalid signature', async () => {
    const crl = createTestCRL();
    await addWireMockCrlMapping(crl);
    const chain = createCertificateChain(
      createTestCertificate({
        crlUrls: [wireMockCrlUrl],
      }),
      createTestCertificate(),
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(
        `CRL ${wireMockCrlUrl} signature is invalid. Expected signature by O:CERT#2,CN:CERT#2,SN:CERT#2`,
      ),
    );
  });

  it('fails for revoked certificate in crl', async () => {
    const revokedSerialNumber = 666_666;
    const rootKeyPair = createCertificateKeyPair();
    const crl = createTestCRL({
      issuerKeyPair: rootKeyPair,
      revokedCertificates: [revokedSerialNumber],
    });
    await addWireMockCrlMapping(crl);
    const chain = createCertificateChain(
      createTestCertificate({
        serialNumber: revokedSerialNumber,
        crlUrls: [wireMockCrlUrl],
      }),
      createTestCertificate({ keyPair: rootKeyPair }),
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(`Certificate O:CERT#1,CN:CERT#1,SN:CERT#1 is revoked in ${wireMockCrlUrl}`),
    );
  });
});
