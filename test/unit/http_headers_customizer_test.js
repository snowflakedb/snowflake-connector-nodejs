// import {getHttpRequestHeaders} from '../../lib/http/base';
// import ConnectionConfig from '../../lib/connection/connection_config';
// import assert from 'assert';
// import * as Snowflake from '../../index';

const { getHttpRequestHeaders } = require('../../lib/http/base');
const ConnectionConfig = require('../../lib/connection/connection_config');
const assert = require('assert');

describe('customizer header tests', () => {
  const customHeaders = [{
    applies: () => true,
    newHeaders: function () {
      return {
        'X-Custom-Header': 'CustomValue',
        'X-Another-Header': 'AnotherValue',
        'X-Array-Header': ['Value1', 'Value2'],
        'X-Object-Header': { key: 'value' },
      };
    }
  }];

  const result = {
    'X-Custom-Header': 'CustomValue', 
    'X-Another-Header': 'AnotherValue',  
    'X-Array-Header': JSON.stringify(['Value1', 'Value2']), 
    'X-Object-Header': JSON.stringify({ key: 'value' })
  };

  const testingHeaders = {
    application: 'testing', 
    AppID: 'typescriptTest',
    accept: 'application/json',
    'content-type': 'type',
  };

  //     const mockConnectionOptions : Snowflake.ConnectionOptions  = {
  //   accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  //   username: 'fakeusername',
  //   password: 'fakepassword',
  //   account: 'fakeaccount',
  //   authenticator: 'DEFAULT_AUTHENTICATOR',
  // }

  const mockConnectionOptions = {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeusername',
    password: 'fakepassword',
    account: 'fakeaccount',
    authenticator: 'DEFAULT_AUTHENTICATOR',
  };
    
  it('verify custom headers includes in the first attempt', () => {
    mockConnectionOptions.httpHeadersCustomizer = customHeaders;
    const connectionConfig = new ConnectionConfig(mockConnectionOptions);
    const firstHeaders = getHttpRequestHeaders(connectionConfig, { isRetry: false, url: 'http://fakeaccount.snowflakecomputing.com', headers: testingHeaders });
    delete firstHeaders['user-agent'];
    verifyHeaders(firstHeaders, { ...testingHeaders, ...result });

    const retryHeader = getHttpRequestHeaders(connectionConfig, { isRetry: true, url: 'http://fakeaccount.snowflakecomputing.com', headers: testingHeaders });
    delete firstHeaders['user-agent'];
    verifyHeaders(retryHeader, { ...testingHeaders });
  });

  it('verify custom headers do not overwrite the original headers', () => {
    mockConnectionOptions.httpHeadersCustomizer = [
      ...customHeaders,
      {
        applies: () => true,
        newHeaders: function () {
          return {
            'accept': 'OverwrittenValue',
            'content-type': 'OverwrittenType',
          };
        }   
      }
    ];
    const connectionConfig = new ConnectionConfig(mockConnectionOptions);
    const firstHeaders = getHttpRequestHeaders(connectionConfig, { isRetry: false, url: 'http://fakeaccount.snowflakecomputing.com', headers: testingHeaders });
    delete firstHeaders['user-agent'];
    verifyHeaders(firstHeaders, { ...testingHeaders, ...result });
  });
});

// function verifyHeaders(headers: Record<string,any>, expectedHeaders: Record<string,any>) {
//     assert.strictEqual(Object.keys(headers).length, Object.keys(expectedHeaders).length, 'Headers length mismatch')

//     for (const key in expectedHeaders) {
//         if (headers.hasOwnProperty(key)) {
//             assert.deepStrictEqual(headers[key], expectedHeaders[key], `Header ${key} does not match expected value`);
//         }
//     }
// }

function verifyHeaders(headers, expectedHeaders) {
  assert.strictEqual(Object.keys(headers).length, Object.keys(expectedHeaders).length, 'Headers length mismatch');

  for (const key in expectedHeaders) {
    if (Object.prototype.hasOwnProperty.call(headers, key)) {
      assert.deepStrictEqual(headers[key], expectedHeaders[key], `Header ${key} does not match expected value`);
    }
  }
}