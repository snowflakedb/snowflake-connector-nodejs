import { DetailedPeerCertificate, TLSSocket } from 'tls';
import ASN1 from 'asn1.js-rfc5280';
import crypto from 'crypto';
import Logger from '../logger';
import {
  getCertificateCrlUrls,
  getCertificateName,
  getCrl,
  isCertificateRevoked,
  isCrlSignatureValid,
  isShortLivedCertificate,
} from './crl_utils';

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

export function isCrlValidationEnabled(config: CRLValidatorConfig) {
  return config.checkMode !== 'DISABLED';
}

export function corkSocketAndValidateCrl(socket: TLSSocket, config: CRLValidatorConfig) {
  socket.once('secureConnect', async () => {
    const certChain = socket.getPeerCertificate(true);
    try {
      await CRL_VALIDATOR_INTERNAL.validateCrl(certChain, config);
      socket.uncork();
    } catch (error: unknown) {
      socket.destroy(error as Error);
    }
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

export async function validateCrl(certChain: DetailedPeerCertificate, config: CRLValidatorConfig) {
  for (const certificate of iterateCertChain(certChain)) {
    const decodedCertificate = ASN1.Certificate.decode(certificate.raw, 'der');
    const name = getCertificateName(certificate);
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

    const crlIssuerPublicKey = crypto
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
      if (!isCrlSignatureValid(crl, crlIssuerPublicKey)) {
        throw new Error(
          `CRL ${crlUrl} signature is invalid. Expected signature by ${getCertificateName(certificate.issuerCertificate)}`,
        );
      }

      logDebug(`checking if certificate is revoked in ${crlUrl}`);
      if (isCertificateRevoked(decodedCertificate, crl)) {
        throw new Error(`Certificate ${name} is revoked in ${crlUrl}`);
      }
    }
  }
  return true;
}
