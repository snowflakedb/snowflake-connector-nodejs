import assert from 'assert';
import rfc5280 from 'asn1.js-rfc5280';
import Errors from '../../../lib/errors';
import untypedCertUtil from '../../../lib/agent/cert_util';

const rfc2560 = require('asn1.js-rfc2560');
const ocsp = require('@techteamer/ocsp');
const OcspServer = require('@techteamer/ocsp/lib/ocsp/server');

const ErrorCodes = Errors.codes;

const CertUtil = untypedCertUtil as unknown as {
  computeCertIdComponents: (cert: unknown) => object;
  certIdMatches: (a: object, b: object) => boolean;
  verifyOCSPResponse: (
    issuer: unknown,
    response: Buffer,
    expectedCertId: object,
  ) => { err?: Error & { code: number } };
};

// Self-signed test issuer (CA) and two leaf certificates it signed. These are
// generated once and embedded so the test runs fully offline. leaf A is the
// certificate we query OCSP for; leaf B is an unrelated certificate signed by
// the same issuer, used to confirm a response about a different certificate is
// not accepted for leaf A.
const CA_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDHTCCAgWgAwIBAgIUBW811lwv/EucplQmGnkNuuZuFOAwDQYJKoZIhvcNAQEL
BQAwHjEcMBoGA1UEAwwTVGVzdCBPQ1NQIElzc3VlciBDQTAeFw0yNjA3MjMxNjAx
MDhaFw0zNjA3MjAxNjAxMDhaMB4xHDAaBgNVBAMME1Rlc3QgT0NTUCBJc3N1ZXIg
Q0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDqkqKeXxrODrV3VHon
s9bYLJLKNxpe5S+M6OVviqtCyr0UwEtRmtaG2TYEXB3GhZ5zqEUuKP/RhAysP5yF
xBe6IQE8Mn7Kv+SzIX3mXiDePYiOxtYrdbB0PdwmHh3B/b4v5ig/LtfXFBF7OjBb
RF7bO/F5ak1GjTbDYlnIkOepF/bq61hJ/D9JeCTb0qfcf0UJdB3uZjzv+VpZ15EK
uWQQAbjhorx3ecyWu8z7rlLMYVfqzn6CyhsC29clO2SEQoqtUNMsG0xCG34xAokF
2iFVx8LFgpDOhChq3CQuF8fthaYpGmpWMDrMNTQIYwNbB7RHwnf33a6OX0lHgz75
sXy9AgMBAAGjUzBRMB0GA1UdDgQWBBQpWjjHDJihd3qVG2y7rHa8+89RlzAfBgNV
HSMEGDAWgBQpWjjHDJihd3qVG2y7rHa8+89RlzAPBgNVHRMBAf8EBTADAQH/MA0G
CSqGSIb3DQEBCwUAA4IBAQAN8YgEgAA+sy1nVtvagJZDOeM5BYvDjt/+rIa2ti6q
N6mNH/uopyy8Ck/iMe3V0ZnS3Ve+ihPJ3i0VpzRTra3SQEUBt5VIRlOMulkYmbnw
10edDO4OdpTOgQiS7USpFK/l9Z41z8qfWe4WbnU/tMGQuAOROZE/sXMt2lNyG+qY
4qH7iIi9YvhAhhJSYlR0U+LxRhypl0u/YcAs7g3+lEIrv7JGgSG0koQg8VjDwSrN
U8uoJAkb0z1iIezWaoxzzGPV3j9c9dFfdiCVeeiwfnixYu/2Z0AcpGCIblmMpw73
o1gxLQwWUPGcljhrTAbVo80JdXytVs/yxVTyvSZNMvxD
-----END CERTIFICATE-----`;

const CA_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDqkqKeXxrODrV3
VHons9bYLJLKNxpe5S+M6OVviqtCyr0UwEtRmtaG2TYEXB3GhZ5zqEUuKP/RhAys
P5yFxBe6IQE8Mn7Kv+SzIX3mXiDePYiOxtYrdbB0PdwmHh3B/b4v5ig/LtfXFBF7
OjBbRF7bO/F5ak1GjTbDYlnIkOepF/bq61hJ/D9JeCTb0qfcf0UJdB3uZjzv+VpZ
15EKuWQQAbjhorx3ecyWu8z7rlLMYVfqzn6CyhsC29clO2SEQoqtUNMsG0xCG34x
AokF2iFVx8LFgpDOhChq3CQuF8fthaYpGmpWMDrMNTQIYwNbB7RHwnf33a6OX0lH
gz75sXy9AgMBAAECggEAbS7Ym3+oAd5tz7/V5fH63/8LSi1QzHe/5MYouPziD0I/
tU92H2NDVFv5HRllUJi0MqBRpxU1Uae1oF0xdT/bTWr8YLEePDAKeuhtahNJGDiq
/c4GNQ9gFRMQC/v7nOaHJlNqS1J566XvJxzkEi8mOcRSdtGoa1zibxoxsT3lXloh
j45LqMNtayUUnaIQAaIwxlK37sgdvgv1ULhncwp002hAjfrEYgdTqr4Nt0PtSuyQ
I02AXSM2ySV9SGjinKoIYopKUOSWyYyTAOl65UsAQItYx3HMRNZPfE6DPj3m85lg
H530+iiGBkNa/T3wOgY8N2AWOTX9JmDzmlYkctedjwKBgQD5Kl4k04qLbJxDUBXj
TuJl+5kFCiMzGW6qVG8j1VSspCLq2I0jrU0E4iLbaGG6OdEI0MpRH5DFGxw+MfTU
MDFcgBBJmFpEyhIsRyWn7Lvl+9PPRRgETvS2uZ9BIqjdJf6Uq9ykleH7doMQ5ycH
GbwPq0dkgC7QyFqFIvuAUuivSwKBgQDxAcxHe1YJQcq98b9QS1ilzFaE7KuibHq4
+nIjnzpyMfneuLBELVO6B5+1R2cx0L84jHfQ959m9q4Xh9//jul7C2elc0kOkUoq
hUhJ3TYRzAgSri/H1qMd7tYtsPFvbCErFeQAEVHd+oP7cCWWOzlauJ4GSPl3PRlU
2NjoVN4XFwKBgQCiKp8HXN8JC3FQpij4vni/Y1ceXpC2S1Epbra/HbN0gYdwTeze
UYaVLRD+uBsS91pDYJCs59xzTMe++wibqZoW2ArBu3TU3KejRdMOThelAZfDiPau
pyzCWGF8JTC+bmIZJRn/zMU9ws5fC/LsviUWFaXrlTnjDONNT41c4ZkrrQKBgAgL
01IfoAO3Gpm01HpNyavfYpQVgrVtgbtjQSRHUKA3Yuw4pkngaYcwcfiPZbaYDYpJ
xkZHvh6l5bILa0MQ9mKRQuiXLL07xIoe4Qb2R7PYZ/yXrCiz1cZODwB/g9AAgCr8
FBycd2s9zeI7IEYfvA53U29KSGnetFXM15EKJFAJAoGAA6TOSO70tKfN+YlXntGX
74il9yUmVP8E7sA4BbdLd7TYGByeHKcd/3js8642a4nYq1+sLxy6eipegwD9/eoc
8PiJZSorsGmOmWL9U5vVdTYsOkZAqPwgaz4SHkhVMp+RpEFijtmWrd2UX8v2rRMw
i7DwCqSjWtJBGp5HNENmtqw=
-----END PRIVATE KEY-----`;

const LEAF_A_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIC9DCCAdygAwIBAgIBbzANBgkqhkiG9w0BAQsFADAeMRwwGgYDVQQDDBNUZXN0
IE9DU1AgSXNzdWVyIENBMB4XDTI2MDcyMzE2MDEwOFoXDTI3MDcyMzE2MDEwOFow
GTEXMBUGA1UEAwwObGVhZi1hLmV4YW1wbGUwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQCSJVmEQGRyuJ3FmE7nGQfXiUgKKki1Rvhsn6LId4chQDlW1yzb
CkC5gESjiJEIsw+86twXg19SKAfUF/zrFaR6tbJ8ONTMV3/N/CETIrZVnnvxfH4m
VsNXBMeireeGv/0J47alDZLy6yvlxXM1oZxTt+4f/+pHjc1twWf0cpM/KOYtYDue
6MClPiZSo4hCxlzzcz+S6bP1nsHyBwBWQ4aTDIBM4X0AYITCSgxwd49kssVg8gpr
pSUcRQ+9aJ/zdpIte7+ia4HnBrt2yD6qcNrh2pHoaHE/3ZyK1WR4hqR3YrCoXyoH
1FaRWa5SHF6pOXkofO20nEC+drsUxbwTz6AfAgMBAAGjQjBAMB0GA1UdDgQWBBTF
dqa1HW8r3caEoOwLTR/tNW0YzjAfBgNVHSMEGDAWgBQpWjjHDJihd3qVG2y7rHa8
+89RlzANBgkqhkiG9w0BAQsFAAOCAQEACaV6sXbN1RvK2UnX0RePTgS7w0zZwuw4
tcBlu9POD8tNoX8nUikAtchOqB0VZBctNaRX3ZEd+CpWYXYSW940K/uFLPybrmWY
Cpp3IveFYzk6xfEuRoTT+iypMNWQw11RgxzBoYm7a/giHgBreNGf0M428R1lmHKs
e2NfayfhoCeS/FA2oI8u3mqS1hdonj98Kvj/vo8M52/1M+pQ/eoiJlvRtKPSElrk
q8WpMJHl9Ny12HEFQ3Y79OpfED6sDL+WgdQrSaaD2wKwQdoRVgQYdzKVNifIFX7F
4s7hHfIxqW/puzG2DYHzR+vO9nT5ar/th+O2h/4sp/Tj3S3J+0Ps2Q==
-----END CERTIFICATE-----`;

const LEAF_B_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIC9TCCAd2gAwIBAgICAN4wDQYJKoZIhvcNAQELBQAwHjEcMBoGA1UEAwwTVGVz
dCBPQ1NQIElzc3VlciBDQTAeFw0yNjA3MjMxNjAxMDhaFw0yNzA3MjMxNjAxMDha
MBkxFzAVBgNVBAMMDmxlYWYtYi5leGFtcGxlMIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEAv9TtXGbj7JdhzzBQ0M7zUMfIcHRPTHrEFWoDjEpymIRFAyD2
PP3PkTV3DjJzDkp0hUI+rFkbq/jF8IxW1j5B6Z0HJ+Z9FevzdUDjhvAt+o5ivmth
YwDsHxkynsCs+JuUeRIcYx2GW4jt8ue9i7S6CsXcGcps6b3Q4bNf8+hN6TkLprx1
WnnPJRo8QET7QXyih2sQQp+lOYZJOS0Gdd2Qr7e/mDAoewpectbKcTLHO9aghclI
K/ZGtCPZ5gRUIP3zzI/ICUZraEfEvuvtkO+yiirjyDITQ4Mez3hnx7aDuXTXsDmI
ZP75VQzxkbtmkxm/Yps2GUiSzRj2cqTgNX9NhwIDAQABo0IwQDAdBgNVHQ4EFgQU
Rc64StiZv4EZHMDDBgXUvnga1bwwHwYDVR0jBBgwFoAUKVo4xwyYoXd6lRtsu6x2
vPvPUZcwDQYJKoZIhvcNAQELBQADggEBADL/2wRQV30VtYQVIWK9xOhlUqkLPgLu
qoeBOqsp957uu+Mn6ItTRnoAb//TIPkiUxtb6eugApLFWTUBKdJUTpDkxNYNOGF2
ho+P59BmfXjh2Kqx067UAKChWc/FPEXVwPf5+zbwi2m81XXjfdz1xm++CfInyLnD
+ZpALUTGomTggPRIrROAGJ4MuABp5oIGXKiv50YNTnqBqMJ4zraI/DTet8pB/YJK
d5ISra7T3on07IKVCtQPJhGoNV8r46Z28RF/A0D21pRXJKLqOk0fZgOdsoI4JSZ3
1kn7cpEZJzPXQGXYv1QXAPus8gqu29Q/a4JRkVL2OlB1K+E3MkIcMnw=
-----END CERTIFICATE-----`;

const toDER = (pem: string): Buffer => ocsp.utils.toDER(pem, 'CERTIFICATE');

// Builds a certificate object in the shape the driver passes around, i.e. with
// a raw DER buffer and an issuerCertificate carrying its own raw DER buffer.
const certObject = (leafPem: string) => ({
  raw: toDER(leafPem),
  issuerCertificate: { raw: toDER(CA_CERT_PEM) },
});

const issuerDecoded = () => rfc5280.Certificate.decode(toDER(CA_CERT_PEM), 'der');

// Produces a validly-signed OCSP response for leaf A with the given status,
// reusing the reference OCSP responder response builder.
const buildSignedResponseForLeafA = (status: string): Promise<Buffer> => {
  const server = OcspServer.create({ cert: CA_CERT_PEM, key: CA_KEY_PEM });
  const serialA = rfc5280.Certificate.decode(toDER(LEAF_A_CERT_PEM), 'der').tbsCertificate
    .serialNumber;
  server.addCert(serialA, status);
  const req = ocsp.request.generate(toDER(LEAF_A_CERT_PEM), toDER(CA_CERT_PEM));
  const decodedReq = rfc2560.OCSPRequest.decode(req.data, 'der');
  return new Promise((resolve, reject) => {
    server.getResponses(decodedReq, (err: Error | null, out: Buffer) =>
      err ? reject(err) : resolve(out),
    );
  });
};

describe('OCSP response certificate correspondence', () => {
  let signedResponseForLeafA: Buffer;

  before(async () => {
    signedResponseForLeafA = await buildSignedResponseForLeafA('good');
  });

  it('accepts a validly-signed response whose CertID matches the queried certificate', () => {
    const expectedCertId = CertUtil.computeCertIdComponents(certObject(LEAF_A_CERT_PEM));
    const status = CertUtil.verifyOCSPResponse(
      issuerDecoded(),
      signedResponseForLeafA,
      expectedCertId,
    );
    assert.ok(!status.err, 'expected a matching response to be accepted');
  });

  it('rejects a validly-signed response whose CertID does not match the queried certificate', () => {
    // Ask about leaf B while presenting a response issued for leaf A.
    const expectedCertId = CertUtil.computeCertIdComponents(certObject(LEAF_B_CERT_PEM));
    const status = CertUtil.verifyOCSPResponse(
      issuerDecoded(),
      signedResponseForLeafA,
      expectedCertId,
    );
    assert.ok(status.err, 'expected a non-matching response to be rejected');
    assert.strictEqual(status.err!.code, ErrorCodes.ERR_OCSP_RESPONSE_CERT_MISMATCH);
  });

  it('computeCertIdComponents and certIdMatches agree for the same certificate', () => {
    const a = CertUtil.computeCertIdComponents(certObject(LEAF_A_CERT_PEM));
    const b = CertUtil.computeCertIdComponents(certObject(LEAF_A_CERT_PEM));
    assert.ok(CertUtil.certIdMatches(a, b));
    const other = CertUtil.computeCertIdComponents(certObject(LEAF_B_CERT_PEM));
    assert.ok(!CertUtil.certIdMatches(a, other));
  });
});
