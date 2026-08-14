import { DetailedPeerCertificate, TLSSocket } from 'tls';
import rfc5280 from 'asn1.js-rfc5280';
import crypto from 'crypto';
import Logger from '../../logger';
import {
  getCertificateCrlUrls,
  getCertificateDebugName,
  isCertificateRevoked,
  isIssuingDistributionPointExtensionValid,
  isShortLivedCertificate,
} from './certificate_utils';
import { getCrl } from './crl_fetcher';
// PROTOTYPE(crl-result-cache): additive import; remove with the block below to revert.
import {
  getCrlResultCacheKey,
  getValidCrlResult,
  setCrlResult,
} from './crl_result_cache';
import { createCrlError } from '../../errors';

// Allows to mock/spy internal calls in tests
export const CRL_VALIDATOR_INTERNAL = {
  validateCrl: (...args: Parameters<typeof validateCrl>) => validateCrl(...args),
};

export type CRLValidatorConfig = {
  checkMode: 'DISABLED' | 'ENABLED' | 'ADVISORY';
  allowCertificatesWithoutCrlURL: boolean;
  inMemoryCache: boolean;
  onDiskCache: boolean;
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
        Logger().warn(
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
    if (current === current.issuerCertificate) {
      break; // Root is self-signed, ignoring
    }
    yield current;
    current = current.issuerCertificate;
  }
}

// oxlint-disable no-console
// NOTE:
// Sticking with asn1.js-rfc5280 + custom signature validation, because popular libraries have issues:
// - jsrsasign: has outdated crypto library with CEV issues
// - pkijs: takes 4 seconds to parse 9Mb CRL
// - @peculiar/x509: takes 2.5 seconds to parse 9Mb CRL
export async function validateCrl(certChain: DetailedPeerCertificate, config: CRLValidatorConfig) {
  console.time('validateCrl');
  for (const certificate of iterateCertChain(certChain)) {
    // PROTOTYPE(crl-result-cache): skip the whole per-certificate path when this
    // exact certificate was recently validated against a still-fresh CRL.
    const resultCacheKey = getCrlResultCacheKey(
      certificate,
      config.allowCertificatesWithoutCrlURL,
    );
    // if (getValidCrlResult(resultCacheKey)) {
    //   Logger().debug(
    //     `validateCrl[${getCertificateDebugName(certificate)}]: using cached valid result`,
    //   );
    //   continue;
    // }

    console.time('decoding certificate');
    const decodedCertificate = rfc5280.Certificate.decode(certificate.raw, 'der');
    console.timeEnd('decoding certificate');
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

    console.time('decoding issuer certificate');
    const decodedIssuerCertificate = rfc5280.Certificate.decode(
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
    console.timeEnd('decoding issuer certificate');

    // PROTOTYPE(crl-result-cache): the cached result must expire no later than
    // the freshest snapshot it is based on, i.e. the earliest nextUpdate across
    // all CRLs consulted for this certificate.
    let earliestNextUpdate = Infinity;

    for (const crlUrl of crlUrls) {
      logDebug(`fetching ${crlUrl}`);
      console.time('fetching CRL');
      // POC: signature validation now happens inside getCrl, before the CRL is
      // committed to the in-memory (or disk) cache.
      const crl = await getCrl(crlUrl, {
        inMemoryCache: config.inMemoryCache,
        onDiskCache: config.onDiskCache,
        issuerPublicKey,
      });
      console.timeEnd('fetching CRL');

      // PROTOTYPE(crl-result-cache): track freshness for the result cache expiry.
      earliestNextUpdate = Math.min(earliestNextUpdate, crl.tbsCertList.nextUpdate.value);

      console.time('validating issuingDistributionPoint extension');
      logDebug(`validating ${crlUrl} issuingDistributionPoint extension`);
      if (!isIssuingDistributionPointExtensionValid(crl, crlUrl)) {
        throw new Error(`CRL ${crlUrl} issuingDistributionPoint extension is invalid`);
      }
      console.timeEnd('validating issuingDistributionPoint extension');

      console.time('validating issuer');
      logDebug(`validating ${crlUrl} issuer`);
      const crlIssuer = JSON.stringify(crl.tbsCertList.issuer);
      if (issuerSubject !== crlIssuer) {
        throw new Error(
          `CRL ${crlUrl} issuer is invalid. Expected ${issuerSubject} but got ${crlIssuer}`,
        );
      }
      console.timeEnd('validating issuer');

      console.time('validating nextUpdate');
      console.time('validating nextUpdate');
      logDebug(`validating ${crlUrl} nextUpdate`);
      if (crl.tbsCertList.nextUpdate.value < Date.now()) {
        throw new Error(`CRL ${crlUrl} nextUpdate is expired`);
      }
      console.timeEnd('validating nextUpdate');

      console.time('checking if certificate is revoked');
      logDebug(`checking if certificate is revoked in ${crlUrl}`);
      if (isCertificateRevoked(decodedCertificate, crl)) {
        throw new CertificateRevokedError(`Certificate ${name} is revoked in ${crlUrl}`);
      }
      console.timeEnd('checking if certificate is revoked');
    }

    // PROTOTYPE(crl-result-cache): every CRL passed for this certificate; record
    // the positive result (bounded by CRL freshness) so future connections can
    // skip the whole path above. Reached only when nothing threw.
    setCrlResult(resultCacheKey, earliestNextUpdate);
  }
  console.timeEnd('validateCrl');
  return true;
}
