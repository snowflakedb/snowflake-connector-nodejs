const URLUtil = require('./../../lib/url_util');
const assert = require('assert');

describe('URLUtil', function () {
  it('Valid URL', function () {
    assert.ok(URLUtil.isValidURL('https://ssoTestURL.okta.com'));
    assert.ok(URLUtil.isValidURL('https://ssoTestURL.okta.com:8080'));
    assert.ok(URLUtil.isValidURL('https://ssoTestURL.okta.com/testpathvalue'));
  });

  it('Invalid URL', function () {
    assert.ok(!URLUtil.isValidURL('-a Calculator'));
    assert.ok(!URLUtil.isValidURL('This is random text'));
    assert.ok(!URLUtil.isValidURL('file://TestForFile'));
  });
    
  it('Encode URL', function () {
    assert.equal(URLUtil.urlEncode('Hello @World'), 'Hello+%40World');
    assert.equal(URLUtil.urlEncode('Test//String'), 'Test%2F%2FString');
    assert.equal(URLUtil.urlEncode('Test+Plus'), 'Test%2BPlus');
  });
});


describe('parseAddress function test', function () {
  const testCases = [
    {
      name: 'test - when the address is localhost with a port',
      address: 'localhost:4433',
      result: {
        host: 'localhost',
        port: 4433
      }
    },
    {
      name: 'test - when the address is an ip address with a port',
      address: '52.194.1.73:8080',
      result: {
        host: '52.194.1.73',
        port: 8080
      }
    },
    {
      name: 'test - ipv4 address with no port',
      address: '52.194.1.73',
      result: {
        host: '52.194.1.73',
        port: 0
      }
    },
    {
      name: 'test - ipv6 address without brackets with no port',
      address: '2001:db8:85a3:8d3:1319:8a2e:370:7348',
      result: {
        host: '2001:db8:85a3:8d3:1319:8a2e:370:7348',
        port: 0
      }
    },
    {
      name: 'test - ipv6 address with no port',
      address: '[2001:db8:85a3:8d3:1319:8a2e:370:7348]',
      result: {
        host: '2001:db8:85a3:8d3:1319:8a2e:370:7348',
        port: 0
      }
    },
    {
      name: 'test - ipv6 address with brackets with port',
      address: '[2001:db8:85a3:8d3:1319:8a2e:370:7348]:8080',
      result: {
        host: '2001:db8:85a3:8d3:1319:8a2e:370:7348',
        port: 8080
      }
    },
    {
      name: 'test - ipv6 address without brackets with port',
      address: '2001:db8:85a3:8d3:1319:8a2e:370:7348:8080',
      result: {
        host: '2001:db8:85a3:8d3:1319:8a2e:370:7348',
        port: 8080
      }
    },
    {
      name: 'test - ipv6 address abbreviated with no port',
      address: 'fe00:0:0:1::92',
      result: {
        host: 'fe00:0:0:1::92',
        port: 0
      }
    },
    {
      name: 'test - ipv6 address abbreviated with brackets with port',
      address: '[fe00:0:0:1::92]:8080',
      result: {
        host: 'fe00:0:0:1::92',
        port: 8080
      }
    },
    {
      name: 'test - user better not do this because it is wrong: ipv6 address abbreviated without brackets with port',
      address: 'fe00:0:0:1::92:8080',
      result: {
        host: 'fe00:0:0:1::92:8080',
        port: 0
      }
    },
    {
      name: 'test - hostname with port',
      address: 'example.com:8080',
      result: {
        host: 'example.com',
        port: 8080
      }
    }
  ];

  for (const { name, address, result } of testCases) {
    it(name, function () {
      assert.deepStrictEqual(URLUtil.parseAddress(address), result);
    });
  }
});