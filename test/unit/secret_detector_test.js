/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

var assert = require('assert');
var SnowflakeSecretDetector = require('./../../lib/secret_detector');


describe('Secret Detector', function () {
  var SecretDetector;

  const errstr = new Error('Test exception');
  var mock =
  {
    execute: function () {
      throw errstr;
    }
  };

  this.beforeEach(function () {
    SecretDetector = new SnowflakeSecretDetector();
  });

  it('basic masking - null', async function () {
    var txt = null;
    var result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, false);
    assert.strictEqual(result.maskedtxt, null);
    assert.strictEqual(result.errstr, null);
  });

  it('basic masking - empty', async function () {
    var txt = '';
    var result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, false);
    assert.strictEqual(result.maskedtxt, txt);
    assert.strictEqual(result.errstr, null);
  });

  it('basic masking - no masking', async function () {
    var txt = 'This string is innocuous';
    var result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, false);
    assert.strictEqual(result.maskedtxt, txt);
    assert.strictEqual(result.errstr, null);
  });

  it('exception - masking', async function () {
    SecretDetector = new SnowflakeSecretDetector(null, mock);
    var result = SecretDetector.maskSecrets('test');
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, errstr.toString());
    assert.strictEqual(result.errstr, errstr.toString());
  });

  it('test - mask token', async function () {
    var longToken = '_Y1ZNETTn5/qfUWj3Jedby7gipDzQs=U' +
      'KyJH9DS=nFzzWnfZKGV+C7GopWCGD4Lj' +
      'OLLFZKOE26LXHDt3pTi4iI1qwKuSpf/F' +
      'mClCMBSissVsU3Ei590FP0lPQQhcSGcD' +
      'u69ZL_1X6e9h5z62t/iY7ZkII28n2qU=' +
      'nrBJUgPRCIbtJQkVJXIuOHjX4G5yUEKj' +
      'ZBAx4w6=_lqtt67bIA=o7D=oUSjfywsR' +
      'FoloNIkBPXCwFTv+1RVUHgVA2g8A9Lw5' +
      'XdJYuI8vhg=f0bKSq7AhQ2Bh';

    var tokenWithPrefix = 'Token =' + longToken;
    var result = SecretDetector.maskSecrets(tokenWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'Token =****');
    assert.strictEqual(result.errstr, null);

    var idTokenWithPrefix = 'idToken : ' + longToken;
    result = SecretDetector.maskSecrets(idTokenWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'idToken : ****');
    assert.strictEqual(result.errstr, null);

    var sessionTokenWithPrefix = 'sessionToken : ' + longToken;
    result = SecretDetector.maskSecrets(sessionTokenWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'sessionToken : ****');
    assert.strictEqual(result.errstr, null);

    var masterTokenWithPrefix = 'masterToken : ' + longToken;
    result = SecretDetector.maskSecrets(masterTokenWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'masterToken : ****');
    assert.strictEqual(result.errstr, null);

    var assertionWithPrefix = 'assertion content : ' + longToken;
    result = SecretDetector.maskSecrets(assertionWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'assertion content : ****');
    assert.strictEqual(result.errstr, null);
  });


  it('test - false positive', async function () {
    var falsePositiveToken = '2020-04-30 23:06:04,069 - MainThread auth.py:397' +
      ' - write_temporary_credential() - DEBUG - no ID ' +
      'token is given when try to store temporary credential';

    var result = SecretDetector.maskSecrets(falsePositiveToken);
    assert.strictEqual(result.masked, false);
    assert.strictEqual(result.maskedtxt, falsePositiveToken);
    assert.strictEqual(result.errstr, null);
  });

  it('test - password', async function () {
    var randomPassword = 'Fh[+2J~AcqeqW%?';

    var randomPasswordWithPrefix = 'password:' + randomPassword;
    var result = SecretDetector.maskSecrets(randomPasswordWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'password:****');
    assert.strictEqual(result.errstr, null);

    var randomPasswordCaps = 'PASSWORD:' + randomPassword;
    result = SecretDetector.maskSecrets(randomPasswordCaps);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'PASSWORD:****');
    assert.strictEqual(result.errstr, null);

    var randomPasswordMixedCase = 'PassWorD:' + randomPassword;
    result = SecretDetector.maskSecrets(randomPasswordMixedCase);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'PassWorD:****');
    assert.strictEqual(result.errstr, null);

    var randomPasswordEqualSign = 'password =' + randomPassword;
    result = SecretDetector.maskSecrets(randomPasswordEqualSign);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'password =****');
    assert.strictEqual(result.errstr, null);

    randomPasswordWithPrefix = 'pwd:' + randomPassword;
    result = SecretDetector.maskSecrets(randomPasswordWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'pwd:****');
    assert.strictEqual(result.errstr, null);
  });


  it('test - token password', async function () {
    var longToken = '_Y1ZNETTn5/qfUWj3Jedby7gipDzQs=U' +
      'KyJH9DS=nFzzWnfZKGV+C7GopWCGD4Lj' +
      'OLLFZKOE26LXHDt3pTi4iI1qwKuSpf/F' +
      'mClCMBSissVsU3Ei590FP0lPQQhcSGcD' +
      'u69ZL_1X6e9h5z62t/iY7ZkII28n2qU=' +
      'nrBJUgPRCIbtJQkVJXIuOHjX4G5yUEKj' +
      'ZBAx4w6=_lqtt67bIA=o7D=oUSjfywsR' +
      'FoloNIkBPXCwFTv+1RVUHgVA2g8A9Lw5' +
      'XdJYuI8vhg=f0bKSq7AhQ2Bh';

    var longToken2 = 'ktL57KJemuq4-M+Q0pdRjCIMcf1mzcr' +
      'MwKteDS5DRE/Pb+5MzvWjDH7LFPV5b_' +
      '/tX/yoLG3b4TuC6Q5qNzsARPPn_zs/j' +
      'BbDOEg1-IfPpdsbwX6ETeEnhxkHIL4H' +
      'sP-V';

    var randomPwd = 'Fh[+2J~AcqeqW%?';
    var randomPwd2 = randomPwd + 'vdkav13';

    var testStringWithPrefix = 'token=' + longToken +
      ' random giberish ' +
      'password:' + randomPwd;
    var result = SecretDetector.maskSecrets(testStringWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt,
      'token=****' +
      ' random giberish ' +
      'password:****'
    );
    assert.strictEqual(result.errstr, null);

    var testStringWithPrefixReversed = 'password:' + randomPwd +
      ' random giberish ' +
      'token=' + longToken;
    result = SecretDetector.maskSecrets(testStringWithPrefixReversed);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt,
      'password:****' +
      ' random giberish ' +
      'token=****'
    );
    assert.strictEqual(result.errstr, null);

    var testStringWithPrefixMultiToken = 'token=' + longToken +
      ' random giberish ' +
      'password:' + randomPwd +
      ' random giberish ' +
      'idToken:' + longToken2;
    result = SecretDetector.maskSecrets(testStringWithPrefixMultiToken);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt,
      'token=****' +
      ' random giberish ' +
      'password:****' +
      ' random giberish ' +
      'idToken:****'
    );
    assert.strictEqual(result.errstr, null);

    var testStringWithPrefixMultiPass = 'password=' + randomPwd +
      ' random giberish ' +
      'password=' + randomPwd2 +
      ' random giberish ' +
      'password=' + randomPwd;
    result = SecretDetector.maskSecrets(testStringWithPrefixMultiPass);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt,
      'password=' + '****' +
      ' random giberish ' +
      'password=' + '****' +
      ' random giberish ' +
      'password=' + '****'
    );
    assert.strictEqual(result.errstr, null);
  });

  it('custom pattern - success', async function () {
    var customPatterns = {
      regex: [
        String.raw`(testCustomPattern\s*:\s*"([a-z]{8,})")`,
        String.raw`(testCustomPattern\s*:\s*"([0-9]{8,})")`
      ],
      mask: [
        'maskCustomPattern1',
        'maskCustomPattern2'
      ]
    };

    SecretDetector = new SnowflakeSecretDetector(customPatterns);

    var txt = 'testCustomPattern: "abcdefghijklmnop"';
    var result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, customPatterns.mask[0]);
    assert.strictEqual(result.errstr, null);

    txt = 'testCustomPattern: "01123456978"';
    result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, customPatterns.mask[1]);
    assert.strictEqual(result.errstr, null);

    txt = 'password=asdfasdfasdfasdfasdf ' +
      'testCustomPattern: "abcdefghijklmnop"';
    var result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt,
      'password=**** ' +
      customPatterns.mask[0]);
    assert.strictEqual(result.errstr, null);

    txt = 'password=asdfasdfasdfasdfasdf ' +
      'testCustomPattern: "01123456978"';
    result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt,
      'password=**** ' +
      customPatterns.mask[1]);
    assert.strictEqual(result.errstr, null);
  });

  it('custom pattern - regex error', async function () {
    var customPatterns = {
      mask: ['maskCustomPattern1', 'maskCustomPattern2']
    };
    try {
      SecretDetector = new SnowflakeSecretDetector(customPatterns);
    } catch (err) {
      assert.strictEqual(err.toString(), 'Error: The customPatterns object must contain the \'regex\' key');
    }
  });

  it('custom pattern - mask error', async function () {
    var customPatterns = {
      regex: ['regexCustomPattern1', 'regexCustomPattern2']
    };
    try {
      SecretDetector = new SnowflakeSecretDetector(customPatterns);
    } catch (err) {
      assert.strictEqual(err.toString(), 'Error: The customPatterns object must contain the \'mask\' key');
    }
  });

  it('custom pattern - unequal length error', async function () {
    var customPatterns = {
      regex: ['regexCustomPattern1', 'regexCustomPattern2'],
      mask: ['maskCustomPattern1']
    };
    try {
      SecretDetector = new SnowflakeSecretDetector(customPatterns);
    } catch (err) {
      assert.strictEqual(err.toString(), 'Error: The customPatterns object must have equal length for both \'regex\' and \'mask\'');
    }
  });
});
