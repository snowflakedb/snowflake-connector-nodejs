import assert from 'assert';
import axios from 'axios';
import sinon from 'sinon';
import { validateCrl, CRLValidatorConfig } from '../../../lib/agent/crl_validator';
import {
  createCertificateKeyPair,
  createCertificateNameField,
  createTestCertificate,
  createTestCRL,
} from './test_utils';
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
  const rootKeyPair = createCertificateKeyPair();
  const rootCertificate = createTestCertificate({ keyPair: rootKeyPair });
  let axiosGetStub: sinon.SinonStub;

  beforeEach(() => {
    axiosGetStub = sinon.stub(axios, 'get');
  });

  afterEach(() => {
    sinon.restore();
  });

  function setCrlResponse(crl: ASN1.CertificateListDecoded) {
    axiosGetStub.resolves({ data: Buffer.from(ASN1.CertificateList.encode(crl, 'der')) });
  }

  it('passes for short-lived certificate', async () => {
    const certificate = createTestCertificate({
      notBefore: 'Mar 15 2024 00:00:00 GMT',
      notAfter: 'Mar 22 2024 00:00:00 GMT',
    });
    const chain = createCertificateChain(certificate, rootCertificate);
    assert.doesNotThrow(() => validateCrl(chain, validatorConfig));
  });

  it('handles certificate without CRL URL', async () => {
    const chain = createCertificateChain(createTestCertificate(), rootCertificate);
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      /Certificate O:CERT#1,CN:CERT#1,SN:CERT#1 does not have CRL http URL/,
    );
    assert.doesNotReject(() =>
      validateCrl(chain, { ...validatorConfig, allowCertificatesWithoutCrlURL: true }),
    );
  });

  it('passes validation', async () => {
    setCrlResponse(createTestCRL({ issuerKeyPair: rootKeyPair }));
    const chain = createCertificateChain(
      createTestCertificate({
        crlDistributionPoints: [crlUrl],
      }),
      rootCertificate,
    );
    const result = await validateCrl(chain, validatorConfig);
    assert.strictEqual(result, true);
  });

  it('fails for crl with invalid signature', async () => {
    setCrlResponse(createTestCRL());
    const chain = createCertificateChain(
      createTestCertificate({
        crlDistributionPoints: [crlUrl],
      }),
      rootCertificate,
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(
        `CRL ${crlUrl} signature is invalid. Expected signature by O:CERT#2,CN:CERT#2,SN:CERT#2`,
      ),
    );
  });

  it('fails for crl with invalid issuingDistributionPoint extension', async () => {
    const crl = createTestCRL({
      issuerKeyPair: rootKeyPair,
      issuingDistributionPointUrls: ['http://crl.example.com/cert-miss.crl'],
    });
    setCrlResponse(crl);
    const chain = createCertificateChain(
      createTestCertificate({ crlDistributionPoints: [crlUrl] }),
      rootCertificate,
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(`CRL ${crlUrl} issuingDistributionPoint extension is invalid`),
    );
  });

  it('fails for crl with invalid issuer', async () => {
    const issuerCertificate = createTestCertificate({
      subject: createCertificateNameField({ commonName: 'Wont match' }),
    });
    const crl = createTestCRL({ issuerKeyPair: rootKeyPair, issuerCertificate });
    setCrlResponse(crl);
    const chain = createCertificateChain(
      createTestCertificate({ crlDistributionPoints: [crlUrl] }),
      rootCertificate,
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(`CRL ${crlUrl} issuer is invalid`),
    );
  });

  it('fails for crl with expired nextUpdate', async () => {
    const crl = createTestCRL({ issuerKeyPair: rootKeyPair, nextUpdate: Date.now() - 1000 });
    setCrlResponse(crl);
    const chain = createCertificateChain(
      createTestCertificate({ crlDistributionPoints: [crlUrl] }),
      rootCertificate,
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(`CRL ${crlUrl} nextUpdate is expired`),
    );
  });

  it('fails for revoked certificate in crl', async () => {
    const revokedSerialNumber = 666_666;
    const crl = createTestCRL({
      issuerKeyPair: rootKeyPair,
      revokedCertificates: [revokedSerialNumber],
    });
    setCrlResponse(crl);
    const chain = createCertificateChain(
      createTestCertificate({
        serialNumber: revokedSerialNumber,
        crlDistributionPoints: [crlUrl],
      }),
      rootCertificate,
    );
    await assert.rejects(
      validateCrl(chain, validatorConfig),
      new RegExp(`Certificate O:CERT#1,CN:CERT#1,SN:CERT#1 is revoked in ${crlUrl}`),
    );
  });
});
