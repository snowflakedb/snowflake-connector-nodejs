import { DetailedPeerCertificate } from 'tls';
import crypto from 'crypto';
import ASN1 from 'asn1.js-rfc5280';
import Logger from '../logger';

// TODO:
// Implement RSASSA-PSS signature verification
// https://snowflakecomputing.atlassian.net/browse/SNOW-2333028
export const CRL_SIGNATURE_OID_TO_CRYPTO_DIGEST_ALGORITHM: Record<string, string> = {
  '1.2.840.113549.1.1.11': 'sha256',
  '1.2.840.113549.1.1.12': 'sha384',
  '1.2.840.113549.1.1.13': 'sha512',
  '1.2.840.10045.4.3.2': 'sha256',
  '1.2.840.10045.4.3.3': 'sha384',
  '1.2.840.10045.4.3.4': 'sha512',
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
  const digestAlg = CRL_SIGNATURE_OID_TO_CRYPTO_DIGEST_ALGORITHM[signatureAlgOid];
  if (!digestAlg) {
    throw new Error(`Unsupported signature algorithm: ${signatureAlgOid}`);
  }

  const verify = crypto.createVerify(digestAlg);
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

export function isIssuingDistributionPointExtensionValid(
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
