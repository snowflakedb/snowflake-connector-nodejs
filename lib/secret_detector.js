/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

/**
 * The secret detector detects sensitive information.
 * It masks secrets that might be leaked from two potential avenues
 *  1. Out of Band Telemetry
 *  2. Logging
 *  
 * @param {Object} mock
 * 
 * @returns {Object}
 * @constructor
 */
function secret_detector(mock)
{
  const AWS_KEY_PATTERN = new RegExp(String.raw`(aws_key_id|aws_secret_key|access_key_id|secret_access_key)\s*=\s*'([^']+)'`,
    'gi');
  const AWS_TOKEN_PATTERN = new RegExp(String.raw`(accessToken|tempToken|keySecret)\s*:\s*"([a-z0-9/+]{32,}={0,2})"`,
    'gi');
  const SAS_TOKEN_PATTERN = new RegExp(String.raw`(sig|signature|AWSAccessKeyId|password|passcode)=(\?P<secret>[a-z0-9%/+]{16,})`,
    'gi');
  const PRIVATE_KEY_PATTERN = new RegExp(String.raw`-----BEGIN PRIVATE KEY-----\\n([a-z0-9/+=\\n]{32,})\\n-----END PRIVATE KEY-----`,
    'gim');
  const PRIVATE_KEY_DATA_PATTERN = new RegExp(String.raw`"privateKeyData": "([a-z0-9/+=\\n]{10,})"`,
    'gim');
  const CONNECTION_TOKEN_PATTERN = new RegExp(String.raw`(token|assertion content)([\'\"\s:=]+)([a-z0-9=/_\-\+]{8,})`,
    'gi');
  const PASSWORD_PATTERN = new RegExp(
    String.raw`(password|pwd)([\'\"\s:=]+)([a-z0-9!\"#\$%&\\\'\(\)\*\+\,-\./:;<=>\?\@\[\]\^_` +
    '`' +
    String.raw`\{\|\}~]{8,})`,
    'gi');

  function maskAwsKeys(text)
  {
    return text.replace(AWS_KEY_PATTERN, String.raw`$1$2****`);
  }

  function maskAwsToken(text)
  {
    return text.replace(AWS_TOKEN_PATTERN, String.raw`$1":"XXXX"`);
  }

  function maskSasToken(text)
  {
    return text.replace(SAS_TOKEN_PATTERN, String.raw`$1=****`);
  }

  function maskPrivateKey(text)
  {
    return text.replace(PRIVATE_KEY_PATTERN, String.raw`-----BEGIN PRIVATE KEY-----\\\\nXXXX\\\\n-----END PRIVATE KEY-----`);
  }

  function maskPrivateKeyData(text)
  {
    return text.replace(PRIVATE_KEY_DATA_PATTERN, String.raw`"privateKeyData": "XXXX"`);
  }

  function maskConnectionToken(text)
  {
    return text.replace(CONNECTION_TOKEN_PATTERN, String.raw`$1$2****`);
  }

  function maskPassword(text)
  {
    return text.replace(PASSWORD_PATTERN, String.raw`$1$2****`);
  }

  /**
   * Masks any secrets.
   *
   * @param {String} text may contain a secret.
   *
   * @returns {Object} the masked string.
   */
  this.maskSecrets = function (text)
  {
    var result;
    if (!text)
    {
      result =
      {
        masked: false,
        maskedtxt: text,
        errstr: null
      };
      return result;
    }

    var masked = false;
    var errstr = null;
    try
    {
      if (mock)
      {
        mock.execute();
      }

      maskedtxt =
        maskConnectionToken(
          maskPassword(
            maskPrivateKeyData(
              maskPrivateKey(
                maskAwsToken(
                  maskSasToken(
                    maskAwsKeys(text)
                  )
                )
              )
            )
          )
        )
      if (maskedtxt != text)
      {
        masked = true;
      }
    }
    catch (err)
    {
      masked = true;
      maskedtxt = err.toString();
      errstr = err.toString();
    }

    result =
    {
      masked: masked,
      maskedtxt: maskedtxt,
      errstr: errstr
    };
    return result;
  }
}

module.exports = secret_detector;
