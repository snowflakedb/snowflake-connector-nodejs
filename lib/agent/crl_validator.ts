import { DetailedPeerCertificate, TLSSocket } from 'tls';
import { createCrlError } from '../errors';
import { getCertificateCrlUrls, isShortLivedCertificate } from './crl_utils';

// Allows to mock/spy internal calls in integration tests
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
  socket.once('secureConnect', () => {
    const certChain = socket.getPeerCertificate(true);
    try {
      CRL_VALIDATOR_INTERNAL.validateCrl(certChain, config);
      socket.uncork();
    } catch (error: unknown) {
      socket.destroy(error as Error);
    }
  });
  socket.cork();
}

export function validateCrl(certChain: DetailedPeerCertificate, config: CRLValidatorConfig) {
  for (const certificate of iterateCertChain(certChain)) {
    if (isShortLivedCertificate(certificate)) {
      continue;
    }

    const crlUrls = getCertificateCrlUrls(certificate);
    if (!crlUrls) {
      if (config.allowCertificatesWithoutCrlURL) {
        continue;
      }
      throw createCrlError(
        certificate,
        'Certificate does not have CRL http URL. This could be disabled with allowCertificatesWithoutCrlURL',
      );
    }
  }
}

function* iterateCertChain(cert: DetailedPeerCertificate) {
  let current = cert;
  while (current) {
    yield current;
    if (current === current.issuerCertificate) break;
    current = current.issuerCertificate;
  }
}
