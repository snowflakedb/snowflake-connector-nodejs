const net = require('net');

module.exports.sleepAsync = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports.getPortFree = function () {
  return new Promise(res => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => res(port));
    });
  });
};