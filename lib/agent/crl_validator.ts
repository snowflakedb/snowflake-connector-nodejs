import { DetailedPeerCertificate, TLSSocket } from 'tls';
import ASN1 from 'asn1.js-rfc5280';
import crypto from 'crypto';
import Logger from '../logger';
import {
  getCertificateCrlUrls,
  getCertificateDebugName,
  getCrl,
  isCertificateRevoked,
  isCrlDistributionPointExtensionValid,
  isCrlSignatureValid,
  isShortLivedCertificate,
} from './crl_utils';
import { createCrlError } from '../errors';

// Allows to mock/spy internal calls in tests
export const CRL_VALIDATOR_INTERNAL = {
  validateCrl: (...args: Parameters<typeof validateCrl>) => validateCrl(...args),
};

export type CRLValidatorConfig = {
  checkMode: 'DISABLED' | 'ENABLED' | 'ADVISORY';
  allowCertificatesWithoutCrlURL: boolean;
  inMemoryCache: boolean;
  onDiskCache: boolean;
  downloadTimeoutMs: number;
};

export class CertificateRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CertificateRevokedError';
  }
}

export function isCrlValidationEnabled(config: CRLValidatorConfig) {
  return config.checkMode !== 'DISABLED';
}

export function corkSocketAndValidateCrl(socket: TLSSocket, config: CRLValidatorConfig) {
  socket.once('secureConnect', async () => {
    const certChain = socket.getPeerCertificate(true);
    try {
      await CRL_VALIDATOR_INTERNAL.validateCrl(certChain, config);
    } catch (error: unknown) {
      if (!(error instanceof CertificateRevokedError) && config.checkMode === 'ADVISORY') {
        Logger().debug(
          'Failed to check CRL revocation, but checkMode=ADVISORY. Allowing connection. Error: %j',
          error,
        );
      } else {
        // NOTE: Wrap error into CrlError to prevent retries
        socket.destroy(createCrlError(error as Error));
      }
    }
    socket.uncork();
  });
  socket.cork();
}

function* iterateCertChain(cert: DetailedPeerCertificate) {
  let current = cert;
  while (current) {
    if (current === current.issuerCertificate) break; // Root is self-signed, ignoring
    yield current;
    current = current.issuerCertificate;
  }
}

// NOTE:
// Sticking with asn1.js-rfc5280 + custom signature validation, because popular libraries have issues:
// - jsrsasign: has outdated crypto library with CEV issues
// - pkijs: takes 4 seconds to parse 9Mb CRL
// - @peculiar/x509: takes 2.5 seconds to parse 9Mb CRL
export async function validateCrl(certChain: DetailedPeerCertificate, config: CRLValidatorConfig) {
  for (const certificate of iterateCertChain(certChain)) {
    const decodedCertificate = ASN1.Certificate.decode(certificate.raw, 'der');
    const name = getCertificateDebugName(certificate);
    const logDebug = (msg: string) => Logger().debug(`validateCrl[${name}]: ${msg}`);

    logDebug('starting validation');
    if (isShortLivedCertificate(decodedCertificate)) {
      logDebug('certificate is short-lived, skipping');
      continue;
    }

    logDebug('getting CRL distribution points');
    const crlUrls = getCertificateCrlUrls(name, decodedCertificate);
    if (!crlUrls) {
      if (config.allowCertificatesWithoutCrlURL) {
        logDebug('certificate has no CRL distribution points, skipping');
        continue;
      }
      throw new Error(
        `Certificate ${name} does not have CRL http URL. This could be disabled with allowCertificatesWithoutCrlURL`,
      );
    }

    const decodedIssuerCertificate = ASN1.Certificate.decode(
      certificate.issuerCertificate.raw,
      'der',
    );
    const issuerSubject = JSON.stringify(decodedIssuerCertificate.tbsCertificate.subject);
    const issuerPublicKey = crypto
      .createPublicKey({
        key: certificate.issuerCertificate.pubkey as Buffer,
        format: 'der',
        type: 'spki',
      })
      .export({ format: 'pem', type: 'spki' }) as string;

    for (const crlUrl of crlUrls) {
      logDebug(`fetching ${crlUrl}`);
      const crl = await getCrl(crlUrl);

      logDebug(`validating ${crlUrl} signature`);
      if (!isCrlSignatureValid(crl, issuerPublicKey)) {
        throw new Error(
          `CRL ${crlUrl} signature is invalid. Expected signature by ${getCertificateDebugName(certificate.issuerCertificate)}`,
        );
      }

      logDebug(`validating ${crlUrl} issuingDistributionPoint extension`);
      if (!isCrlDistributionPointExtensionValid(crl, crlUrl)) {
        throw new Error(`CRL ${crlUrl} issuingDistributionPoint extension is invalid`);
      }

      logDebug(`validating ${crlUrl} issuer`);
      const crlIssuer = JSON.stringify(crl.tbsCertList.issuer);
      if (issuerSubject !== crlIssuer) {
        throw new Error(
          `CRL ${crlUrl} issuer is invalid. Expected ${issuerSubject} but got ${crlIssuer}`,
        );
      }

      logDebug(`validating ${crlUrl} nextUpdate`);
      if (crl.tbsCertList.nextUpdate.value < Date.now()) {
        throw new Error(`CRL ${crlUrl} nextUpdate is expired`);
      }

      logDebug(`checking if certificate is revoked in ${crlUrl}`);
      if (isCertificateRevoked(decodedCertificate, crl)) {
        throw new CertificateRevokedError(`Certificate ${name} is revoked in ${crlUrl}`);
      }
    }
  }
  return true;
}
