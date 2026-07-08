const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const util = require('../util');

/**
 * Creates a key-pair authenticator.
 *
 * @param {Object} connectionConfig
 *
 * @returns {Object}
 * @constructor
 */
function AuthKeypair(connectionConfig) {
  let privateKey = connectionConfig.getPrivateKey();
  const privateKeyPath = connectionConfig.getPrivateKeyPath();
  const privateKeyPass = connectionConfig.getPrivateKeyPass();

  let jwtToken;

  const LIFETIME = 120; // seconds
  const ALGORITHM = 'RS256';
  const ISSUER = 'iss';
  const SUBJECT = 'sub';
  const EXPIRE_TIME = 'exp';
  const ISSUE_TIME = 'iat';

  /**
   * Update JSON body with token.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body) {
    body['data']['TOKEN'] = jwtToken;
  };

  /**
   * Parse the private key material, decrypting it with the passphrase when provided,
   * and normalize it to an unencrypted PKCS#8 PEM string.
   *
   * @param {String|Buffer} keyMaterial
   * @param {String} privateKeyPass
   *
   * @returns {String} the normalized PKCS#8 PEM private key.
   */
  function parsePrivateKey(keyMaterial, privateKeyPass) {
    return crypto
      .createPrivateKey({
        key: keyMaterial,
        format: 'pem',
        passphrase: privateKeyPass,
      })
      .export({
        format: 'pem',
        type: 'pkcs8',
      });
  }

  /**
   * Load private key from specified file location.
   *
   * @param {String} privateKeyPath
   * @param {String} privateKeyPass
   *
   * @returns {String} the private key.
   */
  function loadPrivateKey(privateKeyPath, privateKeyPass) {
    // Load private key file
    const privateKeyFile = fs.readFileSync(privateKeyPath);
    return parsePrivateKey(privateKeyFile, privateKeyPass);
  }

  /**
   * Get public key fingerprint from private key.
   *
   * @param {String} privateKey
   *
   * @returns {String} the public key fingerprint.
   */
  function calculatePublicKeyFingerprint(privateKey) {
    // Extract public key object from private key
    const pubKeyObject = crypto.createPublicKey({
      key: privateKey,
      format: 'pem',
    });

    // Obtain public key string
    const publicKey = pubKeyObject.export({
      format: 'der',
      type: 'spki',
    });

    // Generate SHA256 hash of public key and encode in base64
    const publicKeyFingerprint =
      'SHA256:' + crypto.createHash('sha256').update(publicKey, 'utf8').digest('base64');

    return publicKeyFingerprint;
  }

  /**
   * Generate JWT token using RS256 algorithm.
   *
   * @param {String} authenticator
   * @param {String} serviceName
   * @param {String} account
   * @param {String} username
   *
   * @returns {null}
   */
  this.authenticate = async function (authenticator, serviceName, account, username) {
    let publicKeyFingerprint;

    if (privateKey) {
      privateKey = parsePrivateKey(privateKey, privateKeyPass);
      publicKeyFingerprint = calculatePublicKeyFingerprint(privateKey);
    } else if (privateKeyPath) {
      privateKey = loadPrivateKey(privateKeyPath, privateKeyPass);
      publicKeyFingerprint = calculatePublicKeyFingerprint(privateKey);
    }

    // Current time + 120 seconds
    const currentTime = Date.now();
    const jwtTokenExp = currentTime + LIFETIME * 1000;

    // Create payload containing jwt token and lifetime span
    const payload = {
      [ISSUER]: util.format(
        '%s.%s.%s',
        account.toUpperCase(),
        username.toUpperCase(),
        publicKeyFingerprint,
      ),
      [SUBJECT]: util.format('%s.%s', account.toUpperCase(), username.toUpperCase()),
      [ISSUE_TIME]: currentTime,
      [EXPIRE_TIME]: jwtTokenExp,
    };

    // Sign payload with RS256 algorithm
    jwtToken = jwt.sign(payload, privateKey, { algorithm: ALGORITHM });
  };

  this.reauthenticate = async function (body) {
    this.authenticate(
      connectionConfig.getAuthenticator(),
      connectionConfig.getServiceName(),
      connectionConfig.account,
      connectionConfig.username,
    );

    this.updateBody(body);
  };
}

module.exports = AuthKeypair;
