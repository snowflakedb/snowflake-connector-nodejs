const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const LIFETIME = 120; // seconds
const ALGORITHM = 'RS256'
const ISSUER = 'iss'
const SUBJECT = 'sub'
const EXPIRE_TIME = 'exp'
const ISSUE_TIME = 'iat'

exports.generateToken = function ({ account, username, privateKey }) {
  account = account.toUpperCase();
  username = username.toUpperCase();

  const privateKeyObj = crypto.createPrivateKey({
    key: privateKey,
    format: 'der',
    type: 'pkcs8'
  });

  const publicKeyFp = calculatePublicKeyFingerprint(privateKeyObj);

  const now = new Date();
  const jwtExpiration = new Date(now.getTime());
  jwtExpiration.setSeconds(jwtExpiration.getSeconds() + LIFETIME);

  const payload = {
    [ISSUER]: `${account}.${username}.${publicKeyFp}`,
    [SUBJECT]: `${account}.${username}`,
    [ISSUE_TIME]: Math.floor(now.getTime() / 1000),
    [EXPIRE_TIME]: Math.floor(jwtExpiration.getTime() / 1000),
  }

  return jwt.sign(payload, privateKeyObj, { algorithm: ALGORITHM });
}

function calculatePublicKeyFingerprint(privateKeyObj)
{
  const publicKeyObj = crypto.createPublicKey(privateKeyObj);
  const publicKeyBytes = publicKeyObj.export({type: 'spki', format: 'der'});

  const sha256Hash = crypto.createHash('sha256').update(publicKeyBytes).digest('base64');
  const publicKeyFp = `SHA256:${sha256Hash}`;

  return publicKeyFp;
}