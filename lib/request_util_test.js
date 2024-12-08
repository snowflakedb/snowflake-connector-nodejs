const assert = require('assert');
const RequestUtil = require('../lib/http/request_util');

const sfParams = require('../lib/constants/sf_params');

const {
  SF_REQUEST_ID,
  SF_REQUEST_GUID,
  SF_WAREHOUSE_NAME,
  SF_DB_NAME,
  SF_SCHEMA_NAME,
  SF_TOKEN
} = sfParams.paramsNames;

describe('describeRequestFromOptions', () => {
  it('should describe request using default attributes when no overrides', () => {
    const requestOptions = {
      method: 'GET',
      url: 'https://example.com/test?foo=bar',
      params: { extraParam: 'value123' },
    };

    const result = describeRequestFromOptions(requestOptions);
    assert.ok(result.includes(SF_REQUEST_ID + '='), 'expected requestId in the result');
    assert.ok(result.includes(SF_REQUEST_GUID + '='), 'expected request_guid in the result');
    assert.ok(result.includes(SF_WAREHOUSE_NAME + '='), 'expected warehouse in the result');
    assert.ok(result.includes(SF_DB_NAME + '='), 'expected databaseName in the result');
    assert.ok(result.includes(SF_SCHEMA_NAME + '='), 'expected schemaName in the result');
  });

  it('should use overridden attributes if provided', () => {
    const requestOptions = {
      method: 'POST',
      url: 'https://example.org/data?x=y'
    };

    const result = describeRequestFromOptions(requestOptions, {
      overrideAttributesDescribedWithValues: ['method', 'path'],
      overrideAttributesDescribedWithoutValues: [SF_TOKEN]
    });

    assert.ok(result.includes('method='), 'expected method in the result');
    assert.ok(result.includes('path='), 'expected path in the result');
    assert.ok(result.includes(SF_TOKEN + ' is'), 'expected token is in the result');
    assert.ok(!result.includes('baseUrl='), 'baseUrl should not be present');
  });

  it('handles empty requestOptions gracefully', () => {
    const result = describeRequestFromOptions();
    assert.ok(result, 'result should be defined');
  });
});

describe('describeRequestFromResponse', () => {
  it('describes a response requestConfig', () => {
    const response = {
      config: {
        method: 'get',
        url: 'https://api.example.com/resource',
        params: { q: 'search' }
      }
    };

    const result = describeRequestFromResponse(response);
    assert.ok(result.includes(SF_REQUEST_ID + '='), 'expected requestId in the result');
    assert.ok(result.includes(SF_REQUEST_GUID + '='), 'expected request_guid in the result');
    assert.ok(result.includes(SF_WAREHOUSE_NAME + '='), 'expected warehouse in the result');
    assert.ok(result.includes(SF_DB_NAME + '='), 'expected databaseName in the result');
    assert.ok(result.includes(SF_SCHEMA_NAME + '='), 'expected schemaName in the result');
    assert.ok(result.includes('method=GET'), 'expected method=GET in the result');
  });

  it('handles no response.config gracefully', () => {
    const result = describeRequestFromResponse({});
    assert.ok(result, 'result should be defined even without config');
  });

  it('applies overrides properly', () => {
    const response = {
      config: {
        method: 'post',
        url: 'https://api.example.com/update',
      }
    };

    const result = describeRequestFromResponse(response, {
      overrideAttributesDescribedWithValues: ['method'],
      overrideAttributesDescribedWithoutValues: [SF_TOKEN]
    });

    assert.ok(result.includes('method=POST'), 'expected method=POST in the result');
    assert.ok(result.includes(SF_TOKEN + ' is'), 'expected token is in the result');
    assert.ok(!result.includes('baseUrl='), 'baseUrl should not be present');
  });
});

describe('describeURL', () => {
  it('describes a URL using defaults', () => {
    const url = 'https://example.com/path?test=123';
    const result = describeURL(url);

    assert.ok(result.includes(SF_REQUEST_ID + '='), 'expected requestId in the result');
    assert.ok(result.includes(SF_REQUEST_GUID + '='), 'expected request_guid in the result');
    assert.ok(result.includes(SF_WAREHOUSE_NAME + '='), 'expected warehouse in the result');
    assert.ok(result.includes(SF_DB_NAME + '='), 'expected databaseName in the result');
    assert.ok(result.includes(SF_SCHEMA_NAME + '='), 'expected schemaName in the result');
  });

  it('uses overrides for URL description', () => {
    const url = 'https://another.com/route';
    const result = describeURL(url, {
      overrideAttributesDescribedWithValues: ['path'],
      overrideAttributesDescribedWithoutValues: [SF_TOKEN]
    });

    assert.ok(result.includes('path='), 'expected path in the result');
    assert.ok(result.includes(SF_TOKEN + ' is'), 'expected token is in the result');
    assert.ok(!result.includes('baseUrl='), 'baseUrl should not be present');
  });

  it('handles no URL', () => {
    const result = describeURL();
    assert.ok(result, 'result should be defined even without a URL');
  });
});

describe('Constants', () => {
  it('should have the default attributes defined', () => {
    assert.ok(Array.isArray(DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES), 'should be an array');
    assert.ok(DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES.length > 0, 'should contain attributes');

    assert.ok(Array.isArray(DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES), 'should be an array');
    assert.ok(DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES.length > 0, 'should contain attributes');
  });
});
