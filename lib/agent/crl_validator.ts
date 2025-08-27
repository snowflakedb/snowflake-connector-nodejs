import { DetailedPeerCertificate, TLSSocket } from 'tls';
import { createCrlError } from '../errors';
import { getCertificateCrlUrls, isShortLivedCertificate } from './crl_utils';

// Allows to mock/spy internal calls in integration tests
export const CRL_VALIDATOR_INTERNAL = {
  validateCrl: (...args: Parameters<typeof validateCrl>) => validateCrl(...args),
};

// TODO: consider naming it CRLValidatorConfig
export type CRLConfig = {
  checkMode: 'DISABLED' | 'ENABLED' | 'ADVISORY';
  allowCertificatesWithoutCrlURL: boolean;
  inMemoryCache: boolean;
  onDiskCache: boolean;
  downloadTimeoutMs: number;
};

export function isCrlValidationEnabled(config: CRLConfig) {
  return config.checkMode !== 'DISABLED';
}

export function corkSocketAndValidateCrl(socket: TLSSocket, config: CRLConfig) {
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

export function validateCrl(certChain: DetailedPeerCertificate, config: CRLConfig) {
  for (
    let currentCertificate = certChain;
    currentCertificate && currentCertificate !== currentCertificate.issuerCertificate;
    currentCertificate = currentCertificate.issuerCertificate
  ) {
    if (isShortLivedCertificate(currentCertificate)) {
      continue;
    }
    const crlUrls = getCertificateCrlUrls(currentCertificate);
    if (!crlUrls && config.allowCertificatesWithoutCrlURL) {
      continue;
    }
    if (1 > 2) {
      throw createCrlError('TODO');
    }
  }
}
