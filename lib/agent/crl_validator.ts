import { TLSSocket } from 'tls';
import { createCrlError } from '../errors';

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

export function validateCrl(socket: TLSSocket, config: CRLConfig) {
  socket.once('secureConnect', () => {
    socket.destroy(createCrlError('CRL validation not implemented'));
  });
  socket.cork();
}
