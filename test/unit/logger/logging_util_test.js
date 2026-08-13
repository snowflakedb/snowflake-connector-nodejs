const assert = require('assert');
const { AxiosHeaders } = require('axios');
const LoggingUtil = require('./../../../lib/logger/logging_util');

describe('LoggingUtil.headerNames', () => {
  it('returns the header names in alphabetical order', () => {
    const headers = {
      'x-amz-id-2': 'some-id',
      'content-type': 'application/xml',
      date: 'Tue, 01 Jul 2025 10:20:30 GMT',
      'accept-ranges': 'bytes',
    };

    assert.strictEqual(
      LoggingUtil.headerNames(headers),
      'accept-ranges, content-type, date, x-amz-id-2',
    );
  });

  it('returns the same names for the same headers added in a different order', () => {
    const first = { 'content-type': 'application/xml', date: 'Tue, 01 Jul 2025 10:20:30 GMT' };
    const second = { date: 'Tue, 01 Jul 2025 10:20:30 GMT', 'content-type': 'application/xml' };

    assert.strictEqual(LoggingUtil.headerNames(first), LoggingUtil.headerNames(second));
    assert.strictEqual(LoggingUtil.headerNames(first), 'content-type, date');
  });

  it('does not include header values', () => {
    const sensitiveValue = 'this-value-must-not-be-described';
    const headers = {
      'x-amz-security-token': sensitiveValue,
      'x-amz-server-side-encryption-customer-key': sensitiveValue,
      'set-cookie': [`session=${sensitiveValue}`],
      'content-type': 'application/xml',
    };

    const described = LoggingUtil.headerNames(headers);

    assert.ok(
      !described.includes(sensitiveValue),
      `Expected no header value in '${described}' but the value was described`,
    );
    assert.strictEqual(
      described,
      'content-type, set-cookie, x-amz-security-token, x-amz-server-side-encryption-customer-key',
    );
  });

  it('describes the response headers of an axios response', () => {
    // Axios exposes response headers as an AxiosHeaders instance, not as a plain
    // object, so the names have to be read from the own enumerable properties.
    const sensitiveValue = 'this-value-must-not-be-described';
    const headers = AxiosHeaders.from({
      'content-type': 'application/xml',
      'x-amz-security-token': sensitiveValue,
      'set-cookie': [`session=${sensitiveValue}`],
    });

    const described = LoggingUtil.headerNames(headers);

    assert.ok(
      !described.includes(sensitiveValue),
      `Expected no header value in '${described}' but the value was described`,
    );
    assert.strictEqual(described, 'content-type, set-cookie, x-amz-security-token');
  });

  it("describes an empty or missing set of headers as 'none'", () => {
    [{}, undefined, null, ''].forEach((headers) => {
      assert.strictEqual(
        LoggingUtil.headerNames(headers),
        'none',
        `Unexpected description for ${JSON.stringify(headers)}`,
      );
    });
  });
});
