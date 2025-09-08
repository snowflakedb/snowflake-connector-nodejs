import assert from 'assert';
import axios from 'axios';
import sinon from 'sinon';
import { validateCrl, CRLValidatorConfig } from '../../../lib/agent/crl_validator';
import { createCertificateKeyPair, createTestCertificate, createTestCRL } from './test_utils';
import ASN1 from 'asn1.js-rfc5280';
import { createCertificateChain } from './test_utils';

describe('validateCrl', () => {
  const validatorConfig: CRLValidatorConfig = {
    checkMode: 'ENABLED',
    allowCertificatesWithoutCrlURL: false,
    inMemoryCache: false,
    onDiskCache: false,
    downloadTimeoutMs: 5000,
  };
  const crlUrl = 'http://example.com/crl.crl';
  let axiosGetStub: sinon.SinonStub;

  beforeEach(() => {
    axiosGetStub = sinon.stub(axios, 'get');
  });

  afterEach(() => {
    sinon.restore();
  });

  function setCrlResponse(crl: ASN1.CertificateListDecoded) {
    axiosGetStub
      .withArgs(crlUrl)
      .resolves({ data: Buffer.from(ASN1.CertificateList.encode(crl, 'der')) });
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
    setCrlResponse(crl);
    const chain = createCertificateChain(
      createTestCertificate({
        crlUrls: [crlUrl],
      }),
      createTestCertificate({ keyPair: rootKeyPair }),
    );
    const result = await validateCrl(chain, validatorConfig);
    assert.strictEqual(result, true);
  });

  it('fails for crl with invalid signature', async () => {
    const crl = createTestCRL();
    setCrlResponse(crl);
    const chain = createCertificateChain(
      createTestCertificate({
        crlUrls: [crlUrl],
      }),
      createTestCertificate(),
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(
        `CRL ${crlUrl} signature is invalid. Expected signature by O:CERT#2,CN:CERT#2,SN:CERT#2`,
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
    setCrlResponse(crl);
    const chain = createCertificateChain(
      createTestCertificate({
        serialNumber: revokedSerialNumber,
        crlUrls: [crlUrl],
      }),
      createTestCertificate({ keyPair: rootKeyPair }),
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(`Certificate O:CERT#1,CN:CERT#1,SN:CERT#1 is revoked in ${crlUrl}`),
    );
  });
});
