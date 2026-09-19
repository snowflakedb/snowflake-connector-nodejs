/*
 * HTTPS mock servers with a pinned TLS version, plus a certificate generated at runtime.
 *
 * Used to verify that a process-wide TLS floor (`node --tls-min-v1.3`, i.e.
 * tls.DEFAULT_MIN_VERSION) is honored by every TLS stack the connector talks through:
 * axios for the Snowflake API and the AWS SDK for S3 stage transfers.
 *
 * The certificate is generated in-process so that no key material is committed and the
 * tests do not depend on openssl being available on the CI image.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { IncomingMessage, ServerResponse } from 'http';
import asn1 from 'asn1.js';
import rfc5280, { NameRDNSequence, TBSCertificate } from 'asn1.js-rfc5280';

const SHA256_WITH_RSA_OID = [1, 2, 840, 113549, 1, 1, 11];
const COMMON_NAME_OID = [2, 5, 4, 3];
const DER_PRINTABLE_STRING = 19;

export type PinnedTlsVersion = 'TLSv1.2' | 'TLSv1.3';

export interface GeneratedCertificate {
  cert: string;
  key: string;
}

/**
 * Creates a self-signed certificate for `commonName` that is also usable as its own
 * trust anchor (basicConstraints CA:TRUE), so a client can trust it by pointing
 * NODE_EXTRA_CA_CERTS at the PEM.
 */
// TODO: This overlaps with the certificate generation in the CRL tests
// (test/unit/agent/crl_validator/test_utils.ts) - the signature-algorithm OID, RSA keypair,
// and name-field building are duplicated. They could share a common buildCertificate(...)
// helper. Revisit during the new-driver migration, and only if these tests stay in Node
// rather than running solely in sf_core.
export function generateSelfSignedCertificate(commonName = 'localhost'): GeneratedCertificate {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const signatureAlgorithm = {
    algorithm: SHA256_WITH_RSA_OID,
    parameters: Buffer.from([0x05, 0x00]),
  };
  const name: NameRDNSequence = {
    type: 'rdnSequence',
    value: [
      [
        {
          type: COMMON_NAME_OID,
          value: [
            DER_PRINTABLE_STRING,
            commonName.length,
            ...Array.from(Buffer.from(commonName, 'utf8')),
          ],
        },
      ],
    ],
  };
  const now = Date.now();

  const tbsCertificate: TBSCertificate = {
    version: 'v3',
    serialNumber: new asn1.bignum(Math.floor(now / 1000)),
    signature: signatureAlgorithm,
    issuer: name,
    validity: {
      notBefore: { type: 'utcTime', value: now - 60 * 60 * 1000 },
      notAfter: { type: 'utcTime', value: now + 24 * 60 * 60 * 1000 },
    },
    subject: name,
    subjectPublicKeyInfo: rfc5280.SubjectPublicKeyInfo.decode(
      publicKey.export({ type: 'spki', format: 'der' }),
      'der',
    ),
    extensions: [
      // CA:TRUE so the certificate can also serve as its own trust anchor.
      { extnID: 'basicConstraints', extnValue: { cA: true } },
      {
        extnID: 'subjectAlternativeName',
        extnValue: [
          { type: 'dNSName', value: commonName },
          { type: 'iPAddress', value: Buffer.from([127, 0, 0, 1]) },
        ],
      },
    ],
  };

  const tbsDer = rfc5280.TBSCertificate.encode(tbsCertificate, 'der');
  const signature = crypto.createSign('sha256').update(tbsDer).sign(privateKey);
  const certDer = rfc5280.Certificate.encode(
    { tbsCertificate, signatureAlgorithm, signature: { unused: 0, data: signature } },
    'der',
  );

  return {
    cert: [
      '-----BEGIN CERTIFICATE-----',
      ...(certDer.toString('base64').match(/.{1,64}/g) ?? []),
      '-----END CERTIFICATE-----',
      '',
    ].join('\n'),
    key: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

export interface MockTlsServer {
  readonly port: number;
  /** Protocol negotiated by each handshake the server completed. */
  readonly acceptedProtocols: string[];
  /** Error code of each handshake the server refused, e.g. ERR_SSL_UNSUPPORTED_PROTOCOL. */
  readonly rejectedHandshakes: string[];
  /** "METHOD path" of each request that made it past the handshake. */
  readonly requests: string[];
  shutdown(): Promise<void>;
}

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

async function startPinnedTlsServer(
  certificate: GeneratedCertificate,
  tlsVersion: PinnedTlsVersion,
  handler: RequestHandler,
): Promise<MockTlsServer> {
  const acceptedProtocols: string[] = [];
  const rejectedHandshakes: string[] = [];
  const requests: string[] = [];

  const server = https.createServer(
    {
      key: certificate.key,
      cert: certificate.cert,
      // Pinned explicitly on both ends so the server is unaffected by the
      // process-wide floor that the tests manipulate.
      minVersion: tlsVersion,
      maxVersion: tlsVersion,
    },
    (req, res) => {
      requests.push(`${req.method} ${req.url}`);
      handler(req, res);
    },
  );

  server.on('secureConnection', (socket) => {
    acceptedProtocols.push(socket.getProtocol() ?? 'unknown');
  });
  server.on('tlsClientError', (err: NodeJS.ErrnoException) => {
    rejectedHandshakes.push(err.code ?? err.message);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Mock TLS server did not bind to a TCP port');
  }

  return {
    port: address.port,
    acceptedProtocols,
    rejectedHandshakes,
    requests,
    async shutdown() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}

function respondJson(res: ServerResponse, body: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const LOGIN_REQUEST_OK_RESPONSE = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'wiremock', 'mappings', 'login_request_ok.json'),
    'utf8',
  ),
).mappings[0].response.jsonBody;

export interface MockSnowflakeServerOptions {
  certificate: GeneratedCertificate;
  tlsVersion: PinnedTlsVersion;
  /** "host:port" of the mock storage endpoint returned in stageInfo, for PUT commands. */
  storageEndpoint?: string;
  /** Local file the PUT command is expected to upload. */
  putFilePath?: string;
}

/**
 * Minimal stand-in for the Snowflake API: enough of login-request and query-request
 * for the connector to log in and start a single-file S3 PUT.
 */
export async function startMockSnowflakeServer(
  options: MockSnowflakeServerOptions,
): Promise<MockTlsServer> {
  // A real 16-byte key, unlike the placeholder used in the WireMock fixtures, so the
  // connector's client-side encryption of the staged file actually runs.
  const queryStageMasterKey = crypto.randomBytes(16).toString('base64');

  const buildPutResponse = () => {
    const stageInfo = {
      locationType: 'S3',
      location: 'test.bucket/stages/tls-min-version/',
      path: 'stages/tls-min-version/',
      region: 'us-west-2',
      storageAccount: null,
      isClientSideEncrypted: true,
      ciphers: 'AES_CBC',
      creds: {
        AWS_KEY_ID: 'TEST_AWS_KEY_ID',
        AWS_SECRET_KEY: 'TEST_AWS_SECRET_KEY',
        AWS_TOKEN: 'TEST_AWS_TOKEN',
      },
      presignedUrl: null,
      useS3RegionalUrl: false,
      useVirtualUrl: false,
      // Pointing stageInfo at the mock storage server is what puts the AWS SDK's TLS
      // stack, rather than the connector's axios stack, on the path under test.
      endPoint: options.storageEndpoint ?? null,
    };

    return {
      data: {
        uploadInfo: stageInfo,
        stageInfo,
        src_locations: [options.putFilePath],
        parallel: 1,
        threshold: 209715200,
        autoCompress: false,
        overwrite: false,
        sourceCompression: 'auto_detect',
        clientShowEncryptionParameter: true,
        queryId: '01c0e577-000b-aba8-0000-4c390147020a',
        encryptionMaterial: {
          queryStageMasterKey,
          queryId: '01c0e577-000b-aba8-0000-4c390147020a',
          smkId: 1234,
        },
        kind: null,
        command: 'UPLOAD',
        operation: 'Node',
      },
      code: null,
      message: null,
      success: true,
    };
  };

  return startPinnedTlsServer(options.certificate, options.tlsVersion, (req, res) => {
    // The body is irrelevant to these tests, but it has to be drained.
    req.resume();
    const url = req.url ?? '';

    if (url.includes('/session/v1/login-request')) {
      respondJson(res, LOGIN_REQUEST_OK_RESPONSE);
    } else if (url.includes('/queries/v1/query-request')) {
      // TODO: when migrating to the new driver, read this from wiremock stub
      respondJson(res, buildPutResponse());
    } else {
      respondJson(res, { data: null, code: null, message: null, success: true });
    }
  });
}

/**
 * Stand-in for a cloud storage endpoint: reports the object as missing so the connector
 * proceeds to upload, then accepts the upload.
 */
export async function startMockStorageServer(
  certificate: GeneratedCertificate,
  tlsVersion: PinnedTlsVersion,
): Promise<MockTlsServer> {
  const uploadedObjects = new Map<string, number>();

  return startPinnedTlsServer(certificate, tlsVersion, (req, res) => {
    const objectPath = (req.url ?? '').split('?')[0];

    if (req.method === 'PUT') {
      let size = 0;
      req.on('data', (chunk: Buffer) => (size += chunk.length));
      req.on('end', () => {
        uploadedObjects.set(objectPath, size);
        res.writeHead(200, { ETag: '"d41d8cd98f00b204e9800998ecf8427e"' });
        res.end();
      });
      return;
    }

    req.resume();

    // HeadObject on an object that was uploaded confirms the transfer, which ends the
    // connector's post-upload verification loop immediately. Anything else is reported
    // missing: the AWS SDK raises NotFound, which the connector reads as "not staged yet"
    // and proceeds to upload.
    if (req.method === 'HEAD' && uploadedObjects.has(objectPath)) {
      res.writeHead(200, { 'Content-Length': String(uploadedObjects.get(objectPath)) });
      res.end();
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/xml' });
    res.end('<Error><Code>NoSuchKey</Code></Error>');
  });
}
