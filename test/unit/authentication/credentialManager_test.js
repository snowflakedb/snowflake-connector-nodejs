/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const CredentialManager = require('../../../lib/authentication/SecureStorage/credentialManager');
const localStorage = require('../../../lib/authentication/SecureStorage/localStorage');
const SecureStorage = require('../../../lib/authentication/SecureStorage/secureStorage');
const { randomUUID } = require('crypto');
const host = 'mock_host';
const user = 'mock_user';
const credType = 'mock_cred';
const token = 'mock_token';

describe('Credential Manager Test', function () {
  const randomPassword = randomUUID();

  describe('checkForNull function Test', function () {
    const testCases = [
      {
        name: 'all the parameters are null or undefined',
        parameters: [null, undefined, null, null],
        result: true
      },
      {
        name: 'one parameter is null',
        parameters: ['a', 2, true, null],
        result: true
      },
      {
        name: 'all the parameter are existing',
        parameters: [host, user, credType, token],
        result: false
      },
    ];

    for (const { name, parameters, result } of testCases) {
      it(name, function () {
        assert.strictEqual(CredentialManager.checkForNull(...parameters), result);
      });
    }
  });

  it('test - write the mock credential with the credential manager', async function () {
    await CredentialManager.writeCredential(host, user, credType, randomPassword);
    const result = await CredentialManager.readCredential(host, user, credType);
    assert.strictEqual(randomPassword.toString(), result);
  });

  it('test - read the mock credential with the credential manager', async function () {
    const savedPassword = await CredentialManager.readCredential(host, user, credType);
    assert.strictEqual(savedPassword, randomPassword);
  });

  it('test - delete the mock credential with the credential manager', async function () {
    await CredentialManager.deleteCredential(host, user, credType);
    const result = await CredentialManager.readCredential(host, user, credType);
    assert.ok(result === null);
  });
});

describe('SecureStorage Util functions testing', function () {
 
  const mockCredential = {
    'mock_host': {
      'mock_user': {
        'mock_cred': 'mock_token',
      }
    }
  };

  describe('renewToken function testing in the local storage', function () {
    const testCases = [
      {
        name: 'Added new token to the empty JSON',
        credential: {},
        host,
        user,
        credType,
        token,
        result: mockCredential
      },
      {
        name: 'replaced the existing credential',
        credential: mockCredential,
        host,
        user,
        credType,
        token: 'replaced_token',
        result: {
          'mock_host': {
            'mock_user': {
              'mock_cred': 'replaced_token'
            }
          }
        }
      },
      {
        name: 'added a new type crednetial if the host and user is already exisitng',
        credential: mockCredential,
        host,
        user,
        credType: 'new_credType',
        token: 'new_token',
        result: {
          'mock_host': {
            'mock_user': {
              'mock_cred': 'replaced_token',
              'new_credType': 'new_token'
            }
          }
        }
      },
      {
        name: 'added a new type crednetial if a user and a host are new',
        credential: mockCredential,
        host: 'new_host',
        user: 'new_user',
        credType: 'new_credType',
        token: 'new_token',
        result: {
          'mock_host': {
            'mock_user': {
              'mock_cred': 'replaced_token',
              'new_credType': 'new_token'
            }
          },
          'new_host': {
            'new_user': {
              'new_credType': 'new_token'
            }
          }
        }
      },
    ];
    
    for (const { name, credential, host, user, credType, token, result } of testCases) {
      it(name, function () {
        const renewedCredential = localStorage.renewToken(credential, host, user, credType, token);
        assert.strictEqual(JSON.stringify(renewedCredential), JSON.stringify(result));
      });
    }
  });
   
  describe('findCredential function testing in the local storage', function (){
    const testCases = [
      {
        name: 'when the credential JSON is empty',
        credential: {},
        host,
        user,
        credType,
        result: null
      },
      {
        name: 'when the host is null',
        credential: mockCredential,
        host: null,
        user,
        credType,
        result: null
      },
      {
        name: 'when all the arguments are correct',
        credential: mockCredential,
        host,
        user,
        credType,
        result: 'replaced_token',
      },
    ];

    for (const { name, credential, host, user, credType, result } of testCases) {
      it(name, function () {
        const credentail = localStorage.findCredential(credential, host, user, credType);
        assert.strictEqual(credentail, result);
      });
    }
  });

  it('test build user name for the secure storage', function (){
    const userNameForStorage = SecureStorage.buildTemporaryCredentialName(host, user, credType);
    assert.strictEqual(userNameForStorage,
      '{MOCK_HOST}:{MOCK_USER}:{SF_NODE_JS_DRIVER}:{MOCK_CRED}}'
    ); 
  });
});