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
            'getCertificateCrlUrlss: skipping non-uniformResourceIdentifier entry %j',
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
    return result.length > 0 ? result : null;
  } else {
    Logger().debug(
      'getCertificateCrlUrls: certificate doesnt have cRLDistributionPoints extension',
    );
    return null;
  }
}
