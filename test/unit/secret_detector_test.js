const assert = require('assert');
const SnowflakeSecretDetector = require('./../../lib/secret_detector');


describe('Secret Detector', function () {
  let SecretDetector;

  const errstr = new Error('Test exception');
  const mock =
  {
    execute: function () {
      throw errstr;
    }
  };

  this.beforeEach(function () {
    SecretDetector = new SnowflakeSecretDetector();
  });

  it('basic masking - null', async function () {
    const txt = null;
    const result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, false);
    assert.strictEqual(result.maskedtxt, null);
    assert.strictEqual(result.errstr, null);
  });

  it('basic masking - empty', async function () {
    const txt = '';
    const result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, false);
    assert.strictEqual(result.maskedtxt, txt);
    assert.strictEqual(result.errstr, null);
  });

  it('basic masking - no masking', async function () {
    const txt = 'This string is innocuous';
    const result = SecretDetector.maskSecrets(txt);
    assert.strictEqual(result.masked, false);
    assert.strictEqual(result.maskedtxt, txt);
    assert.strictEqual(result.errstr, null);
  });

  it('exception - masking', async function () {
    SecretDetector = new SnowflakeSecretDetector(null, mock);
    const result = SecretDetector.maskSecrets('test');
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, errstr.toString());
    assert.strictEqual(result.errstr, errstr.toString());
  });

  it('test - mask token', async function () {
    const longToken = '_Y1ZNETTn5/qfUWj3Jedby7gipDzQs=U' +
      'KyJH9DS=nFzzWnfZKGV+C7GopWCGD4Lj' +
      'OLLFZKOE26LXHDt3pTi4iI1qwKuSpf/F' +
      'mClCMBSissVsU3Ei590FP0lPQQhcSGcD' +
      'u69ZL_1X6e9h5z62t/iY7ZkII28n2qU=' +
      'nrBJUgPRCIbtJQkVJXIuOHjX4G5yUEKj' +
      'ZBAx4w6=_lqtt67bIA=o7D=oUSjfywsR' +
      'FoloNIkBPXCwFTv+1RVUHgVA2g8A9Lw5' +
      'XdJYuI8vhg=f0bKSq7AhQ2Bh';

    const tokenWithPrefix = 'Token =' + longToken;
    let result = SecretDetector.maskSecrets(tokenWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'Token =****');
    assert.strictEqual(result.errstr, null);

    const idTokenWithPrefix = 'idToken : ' + longToken;
    result = SecretDetector.maskSecrets(idTokenWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'idToken : ****');
    assert.strictEqual(result.errstr, null);

    const sessionTokenWithPrefix = 'sessionToken : ' + longToken;
    result = SecretDetector.maskSecrets(sessionTokenWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'sessionToken : ****');
    assert.strictEqual(result.errstr, null);

    const masterTokenWithPrefix = 'masterToken : ' + longToken;
    result = SecretDetector.maskSecrets(masterTokenWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'masterToken : ****');
    assert.strictEqual(result.errstr, null);

    const assertionWithPrefix = 'assertion content : ' + longToken;
    result = SecretDetector.maskSecrets(assertionWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'assertion content : ****');
    assert.strictEqual(result.errstr, null);
  });


  it('test - false positive', async function () {
    const falsePositiveToken = '2020-04-30 23:06:04,069 - MainThread auth.py:397' +
      ' - write_temporary_credential() - DEBUG - no ID ' +
      'token is given when try to store temporary credential';

    const result = SecretDetector.maskSecrets(falsePositiveToken);
    assert.strictEqual(result.masked, false);
    assert.strictEqual(result.maskedtxt, falsePositiveToken);
    assert.strictEqual(result.errstr, null);
  });

  it('test - password', async function () {
    const randomPassword = 'Fh[+2J~AcqeqW%?';

    let randomPasswordWithPrefix = 'password:' + randomPassword;
    let result = SecretDetector.maskSecrets(randomPasswordWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'password:****');
    assert.strictEqual(result.errstr, null);

    const randomPasswordCaps = 'PASSWORD:' + randomPassword;
    result = SecretDetector.maskSecrets(randomPasswordCaps);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'PASSWORD:****');
    assert.strictEqual(result.errstr, null);

    const randomPasswordMixedCase = 'PassWorD:' + randomPassword;
    result = SecretDetector.maskSecrets(randomPasswordMixedCase);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'PassWorD:****');
    assert.strictEqual(result.errstr, null);

    const randomPasswordEqualSign = 'password =' + randomPassword;
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
    const longToken = '_Y1ZNETTn5/qfUWj3Jedby7gipDzQs=U' +
      'KyJH9DS=nFzzWnfZKGV+C7GopWCGD4Lj' +
      'OLLFZKOE26LXHDt3pTi4iI1qwKuSpf/F' +
      'mClCMBSissVsU3Ei590FP0lPQQhcSGcD' +
      'u69ZL_1X6e9h5z62t/iY7ZkII28n2qU=' +
      'nrBJUgPRCIbtJQkVJXIuOHjX4G5yUEKj' +
      'ZBAx4w6=_lqtt67bIA=o7D=oUSjfywsR' +
      'FoloNIkBPXCwFTv+1RVUHgVA2g8A9Lw5' +
      'XdJYuI8vhg=f0bKSq7AhQ2Bh';

    const longToken2 = 'ktL57KJemuq4-M+Q0pdRjCIMcf1mzcr' +
      'MwKteDS5DRE/Pb+5MzvWjDH7LFPV5b_' +
      '/tX/yoLG3b4TuC6Q5qNzsARPPn_zs/j' +
      'BbDOEg1-IfPpdsbwX6ETeEnhxkHIL4H' +
      'sP-V';

    const randomPwd = 'Fh[+2J~AcqeqW%?';
    const randomPwd2 = randomPwd + 'vdkav13';

    const testStringWithPrefix = 'token=' + longToken +
      ' random giberish ' +
      'password:' + randomPwd;
    let result = SecretDetector.maskSecrets(testStringWithPrefix);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt,
      'token=****' +
      ' random giberish ' +
      'password:****'
    );
    assert.strictEqual(result.errstr, null);

    const testStringWithPrefixReversed = 'password:' + randomPwd +
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

    const testStringWithPrefixMultiToken = 'token=' + longToken +
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

    const testStringWithPrefixMultiPass = 'password=' + randomPwd +
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
    const customPatterns = {
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

    let txt = 'testCustomPattern: "abcdefghijklmnop"';
    let result = SecretDetector.maskSecrets(txt);
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
    result = SecretDetector.maskSecrets(txt);
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
    const customPatterns = {
      mask: ['maskCustomPattern1', 'maskCustomPattern2']
    };
    try {
      SecretDetector = new SnowflakeSecretDetector(customPatterns);
    } catch (err) {
      assert.strictEqual(err.toString(), 'Error: The customPatterns object must contain the \'regex\' key');
    }
  });

  it('custom pattern - mask error', async function () {
    const customPatterns = {
      regex: ['regexCustomPattern1', 'regexCustomPattern2']
    };
    try {
      SecretDetector = new SnowflakeSecretDetector(customPatterns);
    } catch (err) {
      assert.strictEqual(err.toString(), 'Error: The customPatterns object must contain the \'mask\' key');
    }
  });

  it('custom pattern - unequal length error', async function () {
    const customPatterns = {
      regex: ['regexCustomPattern1', 'regexCustomPattern2'],
      mask: ['maskCustomPattern1']
    };
    try {
      SecretDetector = new SnowflakeSecretDetector(customPatterns);
    } catch (err) {
      assert.strictEqual(err.toString(), 'Error: The customPatterns object must have equal length for both \'regex\' and \'mask\'');
    }
  });

  it('test - passcode masking', async function () {
    const fourDigitPasscode = 'passcode=1234';
    let result = SecretDetector.maskSecrets(fourDigitPasscode);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'passcode=****');
    assert.strictEqual(result.errstr, null);

    const sixDigitPasscode = 'passcode=654321';
    result = SecretDetector.maskSecrets(sixDigitPasscode);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'passcode=****');
    assert.strictEqual(result.errstr, null);

    const passcodeWithColon = 'otp: 987654';
    result = SecretDetector.maskSecrets(passcodeWithColon);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'otp:****');
    assert.strictEqual(result.errstr, null);

    const pinWithSpaces = 'pin =    4321';
    result = SecretDetector.maskSecrets(pinWithSpaces);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'pin=****');
    assert.strictEqual(result.errstr, null);

    const otacWithSpaces = 'otac=  4321';
    result = SecretDetector.maskSecrets(otacWithSpaces);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'otac=****');
    assert.strictEqual(result.errstr, null);
  });

  it('test - url token masking', async function () {
    const TEST_TOKEN_VALUE = 'ETMsDgAAAZNi6aPlABRBRVMvQ0JDL1BLQ1M1UGFkZGluZwEAABAAEExQLlI3h9PIi9TcCRVdwlEAAABQLsgIQdJ0%2B8eQhDMjViFuY5v03Daxt235tNHYVLNoIqM70yLw4zyVdPlkEi208dS88lSqRvPdgQ/RACU7u%2Bn9gWLiTZ79dkZwl4zQactAKJgAFCUrvbxA2tnUP%2BsX6nPBNBzVWnK5';
    const TEST_TOKEN_VERSION_PREFIX = 'ver:1';
    const TEST_TOKEN_HINT_PREFIX = 'hint:1036';
    const TEST_TOKEN_PREFIX = TEST_TOKEN_VERSION_PREFIX + '-' + TEST_TOKEN_HINT_PREFIX + '-';

    const tokenWithVersionAndHint = 'token=' + TEST_TOKEN_PREFIX + TEST_TOKEN_VALUE;
    let result = SecretDetector.maskSecrets(tokenWithVersionAndHint);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'token=' + '****');
    assert.strictEqual(result.errstr, null);

    const tokenWithVersionAndHintAndManyEqualsSigns = 'token=====' + TEST_TOKEN_PREFIX + TEST_TOKEN_VALUE;
    result = SecretDetector.maskSecrets(tokenWithVersionAndHintAndManyEqualsSigns);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'token=====' + '****');
    assert.strictEqual(result.errstr, null);

    const tokenWithVersionAndHintAndColon = 'token:' + TEST_TOKEN_PREFIX + TEST_TOKEN_VALUE;
    result = SecretDetector.maskSecrets(tokenWithVersionAndHintAndColon);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'token:' + '****');
    assert.strictEqual(result.errstr, null);


    const TEST_NEXT_PARAMETER_NOT_TO_BE_MASKED = 'jobID=123fdas4-2133212-12';
    const tokenWithVersionAndHintAndAnotherParameterToIgnore = 'token=' + TEST_TOKEN_PREFIX + TEST_TOKEN_VALUE + '&' + TEST_NEXT_PARAMETER_NOT_TO_BE_MASKED;
    result = SecretDetector.maskSecrets(tokenWithVersionAndHintAndAnotherParameterToIgnore);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'token=' + '****' + '&' + TEST_NEXT_PARAMETER_NOT_TO_BE_MASKED);
    assert.strictEqual(result.errstr, null);


    const tokenWithVersionAndHintAndManySpaces = 'token    =    ' + TEST_TOKEN_PREFIX + TEST_TOKEN_VALUE;
    result = SecretDetector.maskSecrets(tokenWithVersionAndHintAndManySpaces);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'token    =    ' + '****');
    assert.strictEqual(result.errstr, null);


    const tokenWithVersion = 'token=' + TEST_TOKEN_VERSION_PREFIX + '-' + TEST_TOKEN_VALUE;
    result = SecretDetector.maskSecrets(tokenWithVersion);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'token=' + '****');
    assert.strictEqual(result.errstr, null);

    const tokenWithHint = 'token=' + TEST_TOKEN_HINT_PREFIX + '-' + TEST_TOKEN_VALUE;
    result = SecretDetector.maskSecrets(tokenWithHint);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'token=' + '****');
    assert.strictEqual(result.errstr, null);

    const longToken = 'token=' + TEST_TOKEN_VALUE;
    result = SecretDetector.maskSecrets(longToken);
    assert.strictEqual(result.masked, true);
    assert.strictEqual(result.maskedtxt, 'token=****');
    assert.strictEqual(result.errstr, null);
  });
});
