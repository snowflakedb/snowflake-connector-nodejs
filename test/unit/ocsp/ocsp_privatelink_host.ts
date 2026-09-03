import assert from 'assert';
import { isPrivateLink } from '../../../lib/url_util';

describe('PrivateLink host detection and OCSP cache URL', () => {
  const genuinePrivateLinkHosts = [
    'account.privatelink.snowflakecomputing.com',
    'ACCOUNT.PRIVATELINK.SNOWFLAKECOMPUTING.COM',
    'account.privatelink.snowflakecomputing.cn',
    'account.privatelink.snowflakecomputing.com.', // fully-qualified trailing dot
    'testacct.us-east-1.aws.privatelink.snowflakecomputing.com', // multi-label regional prefix
    'testacct.privatelink.snowflakecomputing.mil', // alternate TLD
    'my_acct.privatelink.snowflakecomputing.com', // underscore in account label
  ];

  const nonSnowflakeSuffixHosts = [
    'account.privatelink.snowflakecomputing.com.other.example',
    'privatelink.snowflakecomputing.com.unrelated.test',
    'account.privatelink.snowflakecomputing.com.internal',
  ];

  const nonPrivateLinkHosts = [
    'account.snowflakecomputing.com',
    'account.snowflakecomputing.cn',
    // userinfo injection: '@' is rejected by the LDH allow-list
    'account.privatelink.snowflakecomputing.com@attacker.example',
  ];

  genuinePrivateLinkHosts.forEach((host) => {
    it(`treats a genuine PrivateLink host as PrivateLink: ${host}`, () => {
      assert.strictEqual(isPrivateLink(host), true);
    });
  });

  nonSnowflakeSuffixHosts.forEach((host) => {
    it(`does not treat a host without a Snowflake suffix as PrivateLink: ${host}`, () => {
      assert.strictEqual(isPrivateLink(host), false);
    });
  });

  nonPrivateLinkHosts.forEach((host) => {
    it(`does not treat an ordinary host as PrivateLink: ${host}`, () => {
      assert.strictEqual(isPrivateLink(host), false);
    });
  });
});
