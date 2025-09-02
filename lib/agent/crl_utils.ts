import { DetailedPeerCertificate } from 'tls';
import Logger from '../logger';
const ASN1 = require('asn1.js-rfc5280');

export interface CRLDistributionPoint {
  distributionPoint?: {
    type: 'fullName';
    value: {
      type: 'uniformResourceIdentifier' | 'dNSName';
      value: string;
    }[];
  };
  nameRelativeToCRLIssuer?: { type: string; value: string }[][];
}

export interface DecodedCertificateList {
  tbsCertList: {
    version?: number;
    signature: {
      algorithm: string;
      parameters?: any;
    };
    issuer: any;
    thisUpdate: Date;
    nextUpdate?: Date;
    revokedCertificates?: {
      userCertificate: Buffer;
      revocationDate: Date;
      crlEntryExtensions?: any;
    }[];
    crlExtensions?: any;
  };
  signatureAlgorithm: {
    algorithm: string;
    parameters?: any;
  };
  signature: Buffer;
}

export function getCertificateCrlUrls(certChain: DetailedPeerCertificate) {
  const parsedCert = ASN1.Certificate.decode(certChain.raw, 'der');
  const crlDistributionPoints = parsedCert.tbsCertificate.extensions.find(
    (ext: any) => ext.extnID === 'cRLDistributionPoints',
  )?.extnValue as CRLDistributionPoint[] | undefined;

  if (crlDistributionPoints) {
    const result: string[] = [];
    for (const entry of crlDistributionPoints) {
      if (!entry.distributionPoint) {
        Logger().debug('getCertificateCrlUrls: skipping entry without distributionPoint %j', entry);
        continue;
      }
      for (const fullNameEntry of entry.distributionPoint.value) {
        if (fullNameEntry.type !== 'uniformResourceIdentifier') {
          Logger().debug(
            'getCertificateCrlUrls: skipping non-uniformResourceIdentifier entry %j',
            fullNameEntry,
          );
          continue;
        }
        if (fullNameEntry.value.startsWith('http')) {
          // Even though the spec allows multiple http urls, we only pick first one and don't handle redundancy
          result.push(fullNameEntry.value);
          break;
        } else {
          Logger().debug('getCertificateCrlUrlss: skipping non-http value %j', fullNameEntry);
        }
      }
    }
    Logger().debug('getCertificateCrlUrls: found URLs %j', result);
    return result.length > 0 ? (result as [string, ...string[]]) : null;
  } else {
    Logger().debug(
      'getCertificateCrlUrls: certificate doesnt have cRLDistributionPoints extension',
    );
    return null;
  }
}

// https://cabforum.org/working-groups/server/baseline-requirements/requirements/
// See Short-lived Subscriber Certificate section
export function isShortLivedCertificate(cert: DetailedPeerCertificate) {
  const validFrom = new Date(cert.valid_from);
  const validTo = new Date(cert.valid_to);

  // Certificates issued before March 15, 2024 are not considered short-lived
  if (validFrom < new Date('2024-03-15T00:00:00.000Z')) {
    return false;
  }

  let maximumValidityPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  if (validFrom < new Date('2026-03-15T00:00:00.000Z')) {
    maximumValidityPeriod = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds
  }
  maximumValidityPeriod += 60 * 1000; // Fix inclusion start and end time (1 minute)

  const certValidityPeriod = validTo.getTime() - validFrom.getTime();
  return maximumValidityPeriod > certValidityPeriod;
}
