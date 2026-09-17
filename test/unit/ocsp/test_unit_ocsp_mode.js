const assert = require('assert');
const sinon = require('sinon');
const https = require('https');
const snowflake = require('../../../lib/snowflake').default;
const GlobalConfig = require('../../../lib/global_config');
const Logger = require('../../../lib/logger');
const ConnectionConfig = require('../../../lib/connection/connection_config');
const { getProxyAgent } = require('../../../lib/http/node');
const HttpsCrlAgent = require('../../../lib/agent/https_crl_agent').default;

function restoreDefaultOff() {
  snowflake.configure({ ocspFailOpen: true });
  snowflake.configure({ disableOCSPChecks: true });
}

function enableOcsp(ocspFailOpen) {
  snowflake.configure({ disableOCSPChecks: false, ocspFailOpen });
}

describe('OCSP mode', function () {
  beforeEach(function () {
    restoreDefaultOff();
  });

  afterEach(function () {
    restoreDefaultOff();
  });

  it('defaults to INSECURE without configure()', function () {
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.INSECURE);
    assert.ok(GlobalConfig.isOCSPChecksDisabled());
  });

  it('later ocspFailOpen re-enables after explicit disable', function () {
    snowflake.configure({ disableOCSPChecks: true });
    snowflake.configure({ ocspFailOpen: false });
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_CLOSED);
    assert.equal(GlobalConfig.getOcspFailOpen(), false);
    assert.ok(!GlobalConfig.isOCSPChecksDisabled());
  });

  it('disableOCSPChecks: false enables fail-open', function () {
    snowflake.configure({ disableOCSPChecks: false });
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_OPEN);
    assert.ok(!GlobalConfig.isOCSPChecksDisabled());
  });

  it('ocspFailOpen: true from default-off enables fail-open', function () {
    snowflake.configure({ ocspFailOpen: true });
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_OPEN);
    assert.ok(!GlobalConfig.isOCSPChecksDisabled());
  });

  it('ocspFailOpen: false from enabled state is fail-closed', function () {
    enableOcsp(false);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_CLOSED);
  });

  it('same-call ocspFailOpen wins over disableOCSPChecks: true', function () {
    snowflake.configure({ disableOCSPChecks: true, ocspFailOpen: false });
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_CLOSED);
    assert.equal(GlobalConfig.getOcspFailOpen(), false);
    assert.ok(!GlobalConfig.isOCSPChecksDisabled());
  });

  it('absent configure() keys persist OCSP state', function () {
    enableOcsp(false);
    snowflake.configure({ keepAlive: true });
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_CLOSED);
  });
});

describe('OCSP leftover knobs', function () {
  beforeEach(function () {
    restoreDefaultOff();
  });

  afterEach(function () {
    restoreDefaultOff();
    delete process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL;
    sinon.restore();
  });

  it('skips useConnectionConfigProxyForOCSP when OCSP is off', function () {
    const config = new ConnectionConfig({
      username: 'user',
      password: 'pass',
      account: 'account',
      proxyHost: 'proxy.example.com',
      proxyPort: 8080,
      useConnectionConfigProxyForOCSP: true,
    });
    assert.equal(config.getProxy().useForOCSP, false);
  });

  it('skips manual setupOcspPrivateLink when OCSP is off', function () {
    const warn = sinon.stub(Logger.getInstance(), 'warn');
    const connection = snowflake.createConnection({
      username: 'user',
      password: 'pass',
      account: 'account',
      host: 'acc.privatelink.snowflakecomputing.com',
    });
    connection.setupOcspPrivateLink('acc.privatelink.snowflakecomputing.com');
    assert.strictEqual(process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL, undefined);
    assert.ok(warn.called);
    assert.match(warn.firstCall.args[0], /setupOcspPrivateLink\(\) has no effect/);
  });

  it('writes PrivateLink cache URL after OCSP is enabled', function () {
    enableOcsp(true);
    const connection = snowflake.createConnection({
      username: 'user',
      password: 'pass',
      account: 'account',
      host: 'acc.privatelink.snowflakecomputing.com',
    });
    connection.setupOcspPrivateLink('acc.privatelink.snowflakecomputing.com');
    assert.strictEqual(
      process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL,
      'http://ocsp.acc.privatelink.snowflakecomputing.com/ocsp_response_cache.json',
    );
  });
});

describe('OCSP agent selection', function () {
  beforeEach(function () {
    restoreDefaultOff();
  });

  afterEach(function () {
    restoreDefaultOff();
  });

  function createConnectionConfig(overrides) {
    return new ConnectionConfig(
      {
        username: 'username',
        password: 'password',
        account: 'account',
        ...overrides,
      },
      true,
      false,
      {
        version: '0.0.0',
        environment: {},
      },
    );
  }

  it('uses a plain https.Agent when OCSP is off and CRL is off', function () {
    restoreDefaultOff();
    const parsedUrl = new URL('https://fakeaccount.snowflakecomputing.com');
    const agent = getProxyAgent({
      proxyOptions: null,
      parsedUrl,
      destination: parsedUrl.href,
      connectionConfig: createConnectionConfig(),
    });
    assert.ok(agent instanceof https.Agent);
    assert.equal(agent.createConnection, https.Agent.prototype.createConnection);
    assert.ok(!(agent instanceof HttpsCrlAgent));
  });

  it('uses HttpsOcspAgent after OCSP is enabled', function () {
    enableOcsp(true);
    const parsedUrl = new URL('https://fakeaccount.snowflakecomputing.com');
    const agent = getProxyAgent({
      proxyOptions: null,
      parsedUrl,
      destination: parsedUrl.href,
      connectionConfig: createConnectionConfig(),
    });
    assert.ok(agent instanceof https.Agent);
    assert.notEqual(agent.createConnection, https.Agent.prototype.createConnection);
  });

  it('keeps CRL agent when both OCSP and CRL are enabled', function () {
    enableOcsp(true);
    const parsedUrl = new URL('https://fakeaccount.snowflakecomputing.com');
    const agent = getProxyAgent({
      proxyOptions: null,
      parsedUrl,
      destination: parsedUrl.href,
      connectionConfig: createConnectionConfig({ certRevocationCheckMode: 'ENABLED' }),
    });
    assert.ok(agent instanceof HttpsCrlAgent);
  });

  it('login OCSP_MODE is INSECURE by default and FAIL_OPEN after opt-in', function () {
    restoreDefaultOff();
    const offConfig = createConnectionConfig();
    assert.equal(offConfig.getClientEnvironment().OCSP_MODE, GlobalConfig.ocspModes.INSECURE);

    enableOcsp(true);
    const onConfig = createConnectionConfig();
    assert.equal(onConfig.getClientEnvironment().OCSP_MODE, GlobalConfig.ocspModes.FAIL_OPEN);

    enableOcsp(false);
    const closedConfig = createConnectionConfig();
    assert.equal(closedConfig.getClientEnvironment().OCSP_MODE, GlobalConfig.ocspModes.FAIL_CLOSED);
  });
});
