import { TLSSocket } from 'tls';

export type CRLConfig = {
  checkMode: boolean | 'ADVISORY';
  allowCertificatesWithoutCrlURL: boolean;
  inMemoryCache: boolean;
  onDiskCache: boolean;
  downloadTimeoutMs: number;
};

export function isCrlValidationEnabled(config: CRLConfig) {
  return config.checkMode === true || config.checkMode === 'ADVISORY';
}

export function validateCrl(socket: TLSSocket, config: CRLConfig) {
  socket.once('secureConnect', () => {
    throw new Error('Validation not implemented');
  });
  socket.cork();
}
