const assert = require('assert');
const fs = require('fs');
const net = require('net');
const axios = require('axios');
const { runWireMockAsync } = require('../../wiremockRunner');
const os = require('os');

async function getPortFree() {
  return new Promise(res => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => res(port));
    });
  });
}

if (os.platform !== 'win32')  {
  describe('Wiremock test', function () {
    let port, wireMock;
    before(async () => {
      port = await getPortFree();
      wireMock = await runWireMockAsync(port);
    });
    after(async () => {
      await wireMock.global.shutdown();
    });
    it('Run Wiremock instance, wait, verify connection and shutdown', async function () {
      assert.doesNotReject(async () => await wireMock.mappings.getAllMappings());
    });
    it('Add mappings', async function () {
      const requests = JSON.parse(fs.readFileSync('wiremock/mappings/testMapping.json', 'utf8'));
      for (const mapping of requests.mappings) {
        await wireMock.mappings.createMapping(mapping);
      }
      const mappings = await wireMock.mappings.getAllMappings();
      assert.strictEqual(mappings.mappings.length, 2);
      const response = await axios.get(`http://localhost:${port}/test/authorize.html`);
      assert.strictEqual(response.status, 200);
    });
  });

}
