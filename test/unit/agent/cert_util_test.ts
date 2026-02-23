import assert from 'assert';
import { decimalToIntBuffer } from '../../../lib/agent/cert_util';
// @ts-ignore no types available for asn1.js-rfc2560
import rfc2560 from 'asn1.js-rfc2560';

describe('decimalToIntBuffer produces a buffer compatible with asn1.js', function () {
  const testCases = [
    { decimal: '0', description: 'zero' },
    { decimal: '127', description: 'max value without sign padding (0x7F)' },
    { decimal: '128', description: 'min value requiring sign padding (0x80)' },
    { decimal: '255', description: '0xFF' },
    { decimal: '256', description: '0x0100' },
    { decimal: '32768', description: '0x8000 - two byte value with high bit set' },
    { decimal: '123456789', description: 'medium integer' },
    { decimal: '340282366920938463463374607431768211456', description: '2^128 (large serial)' },
    {
      decimal: '170141183460469231731687303715884105728',
      description: '2^127 - large value with high bit set',
    },
  ];

  testCases.forEach(({ decimal, description }) => {
    it(description, function () {
      const buf = decimalToIntBuffer(decimal);

      const certID = {
        hashAlgorithm: { algorithm: [1, 3, 14, 3, 2, 26] },
        issuerNameHash: Buffer.alloc(20),
        issuerKeyHash: Buffer.alloc(20),
        serialNumber: buf,
      };

      const der = rfc2560.CertID.encode(certID, 'der');
      const decoded = rfc2560.CertID.decode(der, 'der');

      assert.strictEqual(decoded.serialNumber.toString(10), decimal);
    });
  });
});
