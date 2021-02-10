/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var util = require('../util');

/**
 * Creates a key-pair authenticator.
 *
 * @param {String} privateKey
 * @param {String} privateKeyPath
 * @param {String} privateKeyPass
 * @param {module} cryptomod
 * @param {module} jwtmod
 * @param {module} filesystem
 *
 * @returns {Object}
 * @constructor
 */
function auth_keypair(privateKey, privateKeyPath, privateKeyPass, cryptomod, jwtmod, filesystem)
{
  var crypto = typeof cryptomod !== "undefined" ? cryptomod : require('crypto');
  var jwt = typeof jwtmod !== "undefined" ? jwtmod : require('jsonwebtoken');
  var fs = typeof filesystem !== "undefined" ? filesystem : require('fs');

  var privateKey = privateKey;
  var privateKeyPath = privateKeyPath;
  var privateKeyPass = privateKeyPass;

  var jwtToken;

  var LIFETIME = 120; // seconds
  var ALGORITHM = 'RS256';
  var ISSUER = 'iss';
  var SUBJECT = 'sub';
  var EXPIRE_TIME = 'exp';
  var ISSUE_TIME = 'iat';

  /**
   * Update JSON body with token.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body)
  {
    body['data']['TOKEN'] = jwtToken;
  };

  /**
   * Load private key from specified file location.
   *
   * @param {String} privateKeyPath
   * @param {String} privateKeyPass
   *
   * @returns {String} the private key.
   */
  function loadPrivateKey(privateKeyPath, privateKeyPass)
  {
    // Load private key file
    var privateKeyFile;
    try
    {
      privateKeyFile = fs.readFileSync(privateKeyPath);
    }
    catch (loadErr)
    {
      throw loadErr;
    }

    var privateKeyObject;

    // For encrypted private key
    if (privateKeyPass)
    {
      // Get private key with passphrase
      try
      {
        privateKeyObject = crypto.createPrivateKey({
          key: privateKeyFile,
          format: 'pem',
          passphrase: privateKeyPass
        });
      }
      catch (decryptErr)
      {
        throw decryptErr;
      }

    }
    else
    { // For unencrypted private key
      privateKeyObject = crypto.createPrivateKey({
        key: privateKeyFile,
        format: 'pem'
      });
    }

    var privateKey = privateKeyObject.export({
      format: 'pem',
      type: 'pkcs8'
    });

    return privateKey;
  }

  /**
   * Get public key fingerprint from private key.
   *
   * @param {String} privateKey
   *
   * @returns {String} the public key fingerprint.
   */
  function calculatePublicKeyFingerprint(privateKey)
  {
    var pubKeyObject;
    try
    {
      // Extract public key object from private key
      pubKeyObject = crypto.createPublicKey({
        key: privateKey,
        format: 'pem'
      });
    }
    catch (err)
    {
      throw err;
    }

    // Obtain public key string
    var publicKey = pubKeyObject.export({
      format: 'der',
      type: 'spki'
    });

    // Generate SHA256 hash of public key and encode in base64
    var publicKeyFingerprint = 'SHA256:' +
      crypto.createHash('sha256')
        .update(publicKey, 'utf8')
        .digest('base64');

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
  this.authenticate = function (authenticator, serviceName, account, username)
  {
    var publicKeyFingerprint;

    // Use private key if already set in connection string, otherwise use private key file location
    if (privateKey)
    {
      // Get public key fingerprint
      publicKeyFingerprint = calculatePublicKeyFingerprint(privateKey);
    }
    else if (privateKeyPath)
    {
      // Extract private key and get fingerprint
      privateKey = loadPrivateKey(privateKeyPath, privateKeyPass);
      publicKeyFingerprint = calculatePublicKeyFingerprint(privateKey);
    }

    // Current time + 120 seconds
    var currentTime = Date.now();
    var jwtTokenExp = currentTime + LIFETIME;

    // Create payload containing jwt token and lifetime span
    var payload = {
      [ISSUER]: util.format('%s.%s.%s', account.toUpperCase(), username.toUpperCase(), publicKeyFingerprint),
      [SUBJECT]: util.format('%s.%s', account.toUpperCase(), username.toUpperCase()),
      [ISSUE_TIME]: currentTime,
      [EXPIRE_TIME]: jwtTokenExp
    };

    // Sign payload with RS256 algorithm
    try
    {
      jwtToken = jwt.sign(payload, privateKey, {algorithm: ALGORITHM});
    }
    catch (jwtErr)
    {
      throw jwtErr;
    }
  }
}

module.exports = auth_keypair;
