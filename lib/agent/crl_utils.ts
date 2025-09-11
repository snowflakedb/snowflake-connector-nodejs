import { DetailedPeerCertificate } from 'tls';
import crypto from 'crypto';
import ASN1 from 'asn1.js-rfc5280';
import axios, { AxiosRequestConfig } from 'axios';
import Logger from '../logger';

export const SUPPORTED_CRL_VERIFICATION_ALGORITHMS: Record<string, string> = {
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.10045.4.3.2': 'SHA256',
  '1.2.840.10045.4.3.3': 'SHA384',
  '1.2.840.10045.4.3.4': 'SHA512',
};

export function getCertificateDebugName(certificate: DetailedPeerCertificate) {
  return [
    `O:${certificate.subject.O}`,
    `CN:${certificate.subject.CN}`,
    `SN:${certificate.serialNumber}`,
  ].join(',');
}

export const getCertificateCrlUrls = (
  certificateName: string,
  decodedCertificate: ASN1.CertificateDecoded,
) => {
  const logDebug = (msg: string, ...msgArgs: any[]) =>
    Logger().debug(`getCertificateCrlUrls[${certificateName}]: ${msg}`, ...msgArgs);

  const crlExtension = decodedCertificate.tbsCertificate.extensions?.find(
    (ext) => ext.extnID === 'cRLDistributionPoints',
  ) as ASN1.CrlDistributionPointsExtension | undefined;
  if (!crlExtension) {
    logDebug('certificate doesnt have cRLDistributionPoints extension');
    return null;
  }

  const result: string[] = [];
  for (const entry of crlExtension.extnValue) {
    if (!entry.distributionPoint) {
      logDebug('skipping entry without distributionPoint %j', entry);
      continue;
    }
    for (const fullNameEntry of entry.distributionPoint.value) {
      if (fullNameEntry.type !== 'uniformResourceIdentifier') {
        logDebug('skipping non-uniformResourceIdentifier entry %j', fullNameEntry);
        continue;
      }
      if (fullNameEntry.value.startsWith('http')) {
        // Even though the spec allows multiple http urls, we only pick first one and don't handle redundancy
        result.push(fullNameEntry.value);
        break;
      } else {
        logDebug('skipping non-http value %j', fullNameEntry);
      }
    }
  }

  logDebug(`found URLs: ${result.join(',')}`);
  return result.length > 0 ? (result as [string, ...string[]]) : null;
};

/**
 * See Short-lived Subscriber Certificate section\
 * https://cabforum.org/working-groups/server/baseline-requirements/requirements/
 */
export function isShortLivedCertificate(decodedCertificate: ASN1.CertificateDecoded) {
  const notBefore = new Date(decodedCertificate.tbsCertificate.validity.notBefore.value);
  const notAfter = new Date(decodedCertificate.tbsCertificate.validity.notAfter.value);

  let maximumValidityPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  if (notBefore < new Date('2026-03-15T00:00:00.000Z')) {
    maximumValidityPeriod = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds
  }
  maximumValidityPeriod += 60 * 1000; // Fix inclusion start and end time (1 minute)

  const certValidityPeriod = notAfter.getTime() - notBefore.getTime();
  return maximumValidityPeriod > certValidityPeriod;
}

export function isCrlSignatureValid(crl: ASN1.CertificateListDecoded, issuerPublicKey: string) {
  const signatureAlgOid = crl.signatureAlgorithm.algorithm.join('.');
  const signatureAlg = SUPPORTED_CRL_VERIFICATION_ALGORITHMS[signatureAlgOid];
  if (!signatureAlg) {
    throw new Error(`Unsupported signature algorithm: ${signatureAlgOid}`);
  }

  const verify = crypto.createVerify(signatureAlg);
  const tbsEncoded = ASN1.TBSCertList.encode(crl.tbsCertList, 'der');
  verify.update(tbsEncoded);
  return verify.verify(issuerPublicKey, crl.signature.data);
}

export function isCertificateRevoked(
  decodedCertificate: ASN1.CertificateDecoded,
  crl: ASN1.CertificateListDecoded,
) {
  for (const revokedCert of crl.tbsCertList.revokedCertificates) {
    if (revokedCert.userCertificate.eq(decodedCertificate.tbsCertificate.serialNumber)) {
      return true;
    }
  }
  return false;
}

export function isCrlDistributionPointExtensionValid(
  crl: ASN1.CertificateListDecoded,
  expectedCrlUrl: string,
) {
  const issuingDistributionPointExtension = crl.tbsCertList.crlExtensions?.find(
    (ext) => ext.extnID === 'issuingDistributionPoint',
  ) as ASN1.IssuingDistributionPointExtension | undefined;

  if (!issuingDistributionPointExtension) {
    Logger().debug(
      `CRL ${expectedCrlUrl} doesnt have issuingDistributionPoint extension, ignoring`,
    );
    return true;
  }

  for (const fullNameEntry of issuingDistributionPointExtension.extnValue.distributionPoint.value) {
    if (
      fullNameEntry.type === 'uniformResourceIdentifier' &&
      fullNameEntry.value === expectedCrlUrl
    ) {
      return true;
    }
  }
  return false;
}

// TODO: in next PRs
// - prevent multiple http requests for the same CRL
// - in-memory caching for parsed certificate lists
// - on-disk caching
export async function getCrl(url: string, axiosOptions: AxiosRequestConfig = {}) {
  const logDebug = (msg: string) => Logger().debug(`getCrl[${url}]: ${msg}`);

  logDebug(`Download Started`);
  const downloadStartedAt = Date.now();
  const { data } = await axios.get(url, {
    ...axiosOptions,
    responseType: 'arraybuffer',
  });
  logDebug(`Download Completed in ${Date.now() - downloadStartedAt}ms`);

  logDebug(`CRL Parsing Started`);
  const crlParsingStartedAt = Date.now();
  const parsedCrl = ASN1.CertificateList.decode(data, 'der');
  logDebug(`CRL Parsing Completed in ${Date.now() - crlParsingStartedAt}ms`);

  return parsedCrl;
}
