import { DetailedPeerCertificate } from 'tls';
import rfc5280 from 'asn1.js-rfc5280';
import Logger from '../../logger';

export function getCertificateDebugName(certificate: DetailedPeerCertificate) {
  return [
    `O:${certificate.subject.O}`,
    `CN:${certificate.subject.CN}`,
    `SN:${certificate.serialNumber}`,
  ].join(',');
}

export const getCertificateCrlUrls = (
  certificateName: string,
  decodedCertificate: rfc5280.CertificateDecoded,
) => {
  const logDebug = (msg: string, ...msgArgs: any[]) =>
    Logger().debug(`getCertificateCrlUrls[${certificateName}]: ${msg}`, ...msgArgs);

  const crlExtension = decodedCertificate.tbsCertificate.extensions?.find(
    (ext) => ext.extnID === 'cRLDistributionPoints',
  ) as rfc5280.CrlDistributionPointsExtension | undefined;
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
export function isShortLivedCertificate(decodedCertificate: rfc5280.CertificateDecoded) {
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

export function isCertificateRevoked(
  decodedCertificate: rfc5280.CertificateDecoded,
  crl: rfc5280.CertificateListDecoded,
) {
  for (const revokedCert of crl.tbsCertList.revokedCertificates) {
    if (revokedCert.userCertificate.eq(decodedCertificate.tbsCertificate.serialNumber)) {
      return true;
    }
  }
  return false;
}

export function isIssuingDistributionPointExtensionValid(
  crl: rfc5280.CertificateListDecoded,
  expectedCrlUrl: string,
) {
  const issuingDistributionPointExtension = crl.tbsCertList.crlExtensions?.find(
    (ext) => ext.extnID === 'issuingDistributionPoint',
  ) as rfc5280.IssuingDistributionPointExtension | undefined;

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
