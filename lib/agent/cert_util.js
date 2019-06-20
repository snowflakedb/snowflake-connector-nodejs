/*
 * This software is licensed under the MIT License.
 *
 * Copyright Fedor Indutny, 2015.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

var rfc5280 = require('asn1.js-rfc5280');
var crypto = require('crypto');

/**
 * Builds the certificate id for a given certificate.
 *
 * @param cert
 * @returns {*}
 */
exports.buildCertId = function (cert)
{
  var issuer = cert.issuerCertificate;
  cert = cert.raw;

  try
  {
    cert = rfc5280.Certificate.decode(cert, 'der');
    if (issuer)
    {
      issuer = issuer.raw;
      issuer = rfc5280.Certificate.decode(issuer, 'der');
    }
  }
  catch (e)
  {
    return null; // if we encountered an error during decoding, return null
  }

  var tbsCert = cert.tbsCertificate;
  var tbsIssuer = issuer.tbsCertificate;

  // build the certificate id object and stringify it
  return JSON.stringify(
    {
      hashAlgorithm:
        {
          // algorithm: [ 2, 16, 840, 1, 101, 3, 4, 2, 1 ]  // sha256
          algorithm: [1, 3, 14, 3, 2, 26]  // sha1
        },
      issuerNameHash: sha1(rfc5280.Name.encode(tbsCert.issuer, 'der')),
      issuerKeyHash: sha1(
        tbsIssuer.subjectPublicKeyInfo.subjectPublicKey.data),
      serialNumber: tbsCert.serialNumber
    });
};

function sha1(data)
{
  return crypto.createHash('sha1').update(data).digest();
}

/**
 * Parses a certificate and returns an object that contains decoded versions
 * of the certificate and its issuer.
 *
 * Note: this method might throw an error, so use a try-catch when calling it.
 *
 * @param cert
 * @returns {{cert: *, issuer: *}}
 */
exports.decode = function (cert)
{
  var issuer = cert.issuerCertificate;
  cert = cert.raw;

  // note: this block might throw an error
  cert = rfc5280.Certificate.decode(cert, 'der');
  if (issuer)
  {
    issuer = issuer.raw;
    issuer = rfc5280.Certificate.decode(issuer, 'der');
  }

  return {
    cert: cert,
    issuer: issuer
  };
};